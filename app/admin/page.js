'use client';
import {useEffect,useState} from 'react';

async function compressImage(file){
 if(file.size<2*1024*1024)return file;
 return new Promise(resolve=>{
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{
   const max=2400,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');
   c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
   c.getContext('2d').drawImage(img,0,0,c.width,c.height);
   c.toBlob(b=>{URL.revokeObjectURL(url);resolve(b?new File([b],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'}):file)},'image/jpeg',.86)
  };
  img.src=url
 })
}

export default function Admin(){
 const [auth,setAuth]=useState(false),[password,setPassword]=useState(''),[photos,setPhotos]=useState([]),[files,setFiles]=useState([]),[before,setBefore]=useState(null),[after,setAfter]=useState(null),[category,setCategory]=useState('photography'),[title,setTitle]=useState(''),[featured,setFeatured]=useState(false),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const load=()=>fetch('/api/photos').then(r=>r.json()).then(d=>setPhotos(d.photos||[]));
 useEffect(()=>{fetch('/api/session').then(r=>r.json()).then(d=>{setAuth(d.authenticated);if(d.authenticated)load()})},[]);

 async function login(e){e.preventDefault();const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const d=await r.json();if(r.ok){setAuth(true);setMsg('Logged in.');load()}else setMsg(d.error||'Login failed.')}

 async function upload(e){
  e.preventDefault();setBusy(true);setMsg('Optimizing and uploading…');
  const fd=new FormData();fd.append('category',category);fd.append('title',title);fd.append('featured',String(featured));
  if(category==='editing'){
   if(!before||!after){setBusy(false);setMsg('Choose both the before and after image.');return}
   fd.append('before',await compressImage(before));fd.append('after',await compressImage(after));
  }else{
   if(!files.length){setBusy(false);setMsg('Choose at least one image.');return}
   for(const f of files)fd.append('files',await compressImage(f));
  }
  const r=await fetch('/api/upload',{method:'POST',body:fd}),d=await r.json();setBusy(false);
  if(r.ok){setMsg(category==='editing'?'Before → After project published.':(d.uploaded?d.uploaded+' photo(s) published.':'No valid images were uploaded.'));setFiles([]);setBefore(null);setAfter(null);setTitle('');setFeatured(false);e.target.reset();load()}else setMsg(d.error||'Upload failed.')
 }

 async function remove(p){
  if(!confirm('Delete this work?'))return;
  const urls=p.type==='before-after'?[p.beforeUrl,p.afterUrl]:[p.url];
  const r=await fetch('/api/upload',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({urls})});
  if(r.ok)load();else setMsg('Delete failed.')
 }

 if(!auth)return <main className="admin"><div className="login"><p className="eyebrow">PRIVATE AREA</p><h1>Gallery Admin</h1><p>Only the owner can manage the gallery.</p><form onSubmit={login}><input type="password" placeholder="Admin password" value={password} onChange={e=>setPassword(e.target.value)} autoFocus/><button>Enter gallery</button></form>{msg&&<small>{msg}</small>}<a href="/">← Back to gallery</a></div></main>;

 return <main className="admin">
  <header className="adminHead"><div><p className="eyebrow">PRIVATE AREA</p><h1>Gallery Admin</h1></div><div><a href="/">View gallery</a><button className="ghost" onClick={async()=>{await fetch('/api/login',{method:'DELETE'});setAuth(false)}}>Log out</button></div></header>
  <section className="panel"><h2>Upload new work</h2><form onSubmit={upload} className="uploadForm">
   {category==='editing'?<div className="beforeAfterInputs">
    <label className="dropzone"><input type="file" accept="image/*" onChange={e=>setBefore(e.target.files?.[0]||null)}/><span>🖼️ BEFORE<br/><small>{before?before.name:'Choose original photo'}</small></span></label>
    <label className="dropzone"><input type="file" accept="image/*" onChange={e=>setAfter(e.target.files?.[0]||null)}/><span>✨ AFTER<br/><small>{after?after.name:'Choose edited photo'}</small></span></label>
   </div>:<label className="dropzone"><input type="file" accept="image/*" multiple onChange={e=>setFiles([...e.target.files])}/><span>📸 Tap to choose photos<br/><small>{files.length?files.length+' selected':'JPG, PNG, WEBP · up to 15MB each'}</small></span></label>}
   <input placeholder="Project title (optional)" value={title} onChange={e=>setTitle(e.target.value)}/>
   <select value={category} onChange={e=>setCategory(e.target.value)}><option value="photography">Photography</option><option value="editing">Editing — Before / After</option><option value="design">Design</option></select>
   <label className="check"><input type="checkbox" checked={featured} onChange={e=>setFeatured(e.target.checked)}/> Feature this work</label>
   <button disabled={busy}>{busy?'Publishing…':category==='editing'?'Publish Before → After':'Publish photos'}</button>
  </form>{msg&&<p className="notice">{msg}</p>}</section>
  <section><div className="sectionTitle"><h2>Published work</h2><span>{photos.length} projects</span></div><div className="adminGrid">{photos.map(p=><div className="adminCard" key={p.type==='before-after'?p.id:p.url}>
   {p.type==='before-after'?<div className="adminPair"><img src={p.beforeUrl} alt="Before"/><img src={p.afterUrl} alt="After"/></div>:<img src={p.url} alt={p.title}/>}
   <div><b>{p.title}</b><small>{p.type==='before-after'?'Editing · Before / After':p.category}{p.featured?' · Featured':''}</small><button onClick={()=>remove(p)}>Delete</button></div>
  </div>)}</div></section>
 </main>
}
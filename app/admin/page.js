'use client';
import {useEffect,useMemo,useState} from 'react';

async function compressImage(file){
 if(file.size<2*1024*1024)return file;
 return new Promise(resolve=>{
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{
   const max=2400,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');
   c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
   c.getContext('2d').drawImage(img,0,0,c.width,c.height);
   c.toBlob(b=>{
    URL.revokeObjectURL(url);
    resolve(b?new File([b],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'}):file)
   },'image/jpeg',.86)
  };
  img.src=url
 })
}

function Metric({icon,label,value}){return <div className="metric"><span>{icon}</span><div><b>{value.toLocaleString()}</b><small>{label}</small></div></div>}
function StatLine({label,value,max}){return <div className="statLine"><div><span>{label}</span><b>{value.toLocaleString()}</b></div><i><em style={{width:`${max?Math.max(4,value/max*100):0}%`}}/></i></div>}

export default function Admin(){
 const [auth,setAuth]=useState(false),[password,setPassword]=useState(''),[photos,setPhotos]=useState([]),[files,setFiles]=useState([]),[before,setBefore]=useState(null),[after,setAfter]=useState(null),[category,setCategory]=useState('photography'),[title,setTitle]=useState(''),[featured,setFeatured]=useState(false),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[analytics,setAnalytics]=useState({}),[tab,setTab]=useState('dashboard'),[uploadProgress,setUploadProgress]=useState({done:0,total:0});

 const load=async()=>{const d=await fetch('/api/photos').then(r=>r.json());const ps=d.photos||[];setPhotos(ps);const a=await fetch('/api/engagement?admin=1');if(a.ok){const x=await a.json();setAnalytics(x.items||{})}};
 useEffect(()=>{fetch('/api/session').then(r=>r.json()).then(d=>{setAuth(d.authenticated);if(d.authenticated)load()})},[]);
 async function login(e){e.preventDefault();const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const d=await r.json();if(r.ok){setAuth(true);setMsg('Curator access granted.');load()}else setMsg(d.error||'Login failed.')}

 async function uploadOne(file){
  const compressed=await compressImage(file);
  const fd=new FormData();
  fd.append('category',category);
  fd.append('title',title);
  fd.append('featured',String(featured));
  fd.append('files',compressed);
  const r=await fetch('/api/upload',{method:'POST',body:fd});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||`Upload failed for ${file.name}`);
  return d;
 }

 async function upload(e){
  e.preventDefault();
  setBusy(true);
  setMsg('');
  if(category==='editing'){
   if(!before||!after){setBusy(false);setMsg('Choose both the before and after image.');return}
   setMsg('Preparing Before → After exhibit…');
   try{
    const fd=new FormData();fd.append('category',category);fd.append('title',title);fd.append('featured',String(featured));
    fd.append('before',await compressImage(before));fd.append('after',await compressImage(after));
    const r=await fetch('/api/upload',{method:'POST',body:fd}),d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Upload failed.');
    setMsg('Before → After exhibit added.');
   }catch(err){setMsg(err.message||'Upload failed.')}
   setBusy(false);setBefore(null);setAfter(null);setTitle('');setFeatured(false);e.target.reset();load();return
  }

  if(!files.length){setBusy(false);setMsg('Choose at least one image.');return}
  const selected=[...files];
  const concurrency=4;
  let done=0,failed=0;
  setUploadProgress({done:0,total:selected.length});
  setMsg(`Uploading 0 of ${selected.length}…`);

  const queue=[...selected];
  const worker=async()=>{
   while(queue.length){
    const file=queue.shift();
    try{await uploadOne(file)}catch(err){failed++;console.error(err)}
    done++;
    setUploadProgress({done,total:selected.length});
    setMsg(`Uploading ${done} of ${selected.length}…${failed?` ${failed} failed`:''}`);
   }
  };

  await Promise.all(Array.from({length:Math.min(concurrency,selected.length)},()=>worker()));
  setBusy(false);
  setFiles([]);
  setTitle('');
  setFeatured(false);
  e.target.reset();
  setMsg(failed?`${done-failed} exhibit(s) added · ${failed} failed.`:`${done} exhibit(s) added successfully. ⚡`);
  setTimeout(()=>setUploadProgress({done:0,total:0}),2500);
  load();
 }

 async function remove(p){if(!confirm('Remove this exhibit from the museum?'))return;const urls=[],keys=p.type==='before-after'?[p.beforePath,p.afterPath]:[p.pathname];if((p.storage||'')==='r2'||(p.type==='before-after'&&(p.beforeStorage==='r2'||p.afterStorage==='r2')))keys.filter(Boolean);else urls.push(...keys.filter(Boolean));const r=await fetch('/api/upload',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify((p.storage||'')==='r2'||p.type==='before-after'?{keys:keys.filter(Boolean)}:{urls})});if(r.ok)load();else setMsg('Could not remove exhibit.')}
 const rows=photos.map(p=>({p,s:analytics[p.engagementId]||{views:0,likes:0,comments:[]}}));
 const totals=useMemo(()=>rows.reduce((a,x)=>({views:a.views+x.s.views,likes:a.likes+x.s.likes,comments:a.comments+(x.s.commentCount||0)}),{views:0,likes:0,comments:0}),[rows]);
 const mostViewed=[...rows].sort((a,b)=>b.s.views-a.s.views).slice(0,6),maxViews=mostViewed[0]?.s.views||0;
 const allComments=rows.flatMap(x=>(x.s.comments||[]).map(c=>({...c,title:x.p.title}))).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

 if(!auth)return <main className="admin"><div className="login"><p className="eyebrow">CURATOR ACCESS</p><h1>Museum Curator</h1><p>Private collection management.</p><form onSubmit={login}><input type="password" placeholder="Curator password" value={password} onChange={e=>setPassword(e.target.value)} autoFocus/><button>Enter Museum</button></form>{msg&&<small>{msg}</small>}<a href="/">← Back to Museum</a></div></main>;

 return <main className="admin"><header className="adminHead"><div><p className="eyebrow">CURATOR CONTROL ROOM</p><h1>Museum Dashboard</h1><p className="adminMuted">Your private view of the collection and audience activity.</p></div><div><a href="/">View Museum</a><button className="ghost" onClick={async()=>{await fetch('/api/login',{method:'DELETE'});setAuth(false)}}>Exit</button></div></header>
 <nav className="adminTabs"><button className={tab==='dashboard'?'active':''} onClick={()=>setTab('dashboard')}>Dashboard</button><button className={tab==='exhibits'?'active':''} onClick={()=>setTab('exhibits')}>Exhibits</button><button className={tab==='comments'?'active':''} onClick={()=>setTab('comments')}>Comments <span>{allComments.length}</span></button></nav>

 {tab==='dashboard'&&<><section className="metrics"><Metric icon="◉" label="Total Views" value={totals.views}/><Metric icon="♥" label="Total Likes" value={totals.likes}/><Metric icon="◌" label="Comments" value={totals.comments}/><Metric icon="▣" label="Exhibits" value={photos.length}/></section>
 <section className="dashboardGrid"><div className="dashPanel"><div className="dashTitle"><div><p className="eyebrow">AUDIENCE ACTIVITY</p><h2>Most viewed exhibits</h2></div><span>All time</span></div>{mostViewed.length?mostViewed.map(x=><StatLine key={x.p.engagementId} label={x.p.title} value={x.s.views} max={maxViews}/>):<p className="emptyDash">No activity yet.</p>}</div>
 <div className="dashPanel"><div className="dashTitle"><div><p className="eyebrow">ENGAGEMENT</p><h2>Collection pulse</h2></div><span>Live totals</span></div><div className="pulse"><div><b>{totals.likes}</b><small>Likes</small></div><div><b>{totals.comments}</b><small>Comments</small></div><div><b>{totals.views}</b><small>Views</small></div></div><div className="dashboardNote">Every public exhibit has its own engagement record. Visitor names and comments stay visible only through this curator dashboard.</div></div></section>
 <section className="dashPanel recentComments"><div className="dashTitle"><div><p className="eyebrow">LATEST NOTES</p><h2>Recent comments</h2></div><button className="textButton" onClick={()=>setTab('comments')}>View all →</button></div>{allComments.slice(0,5).map(c=><article key={c.id}><div><b>{c.name||'Anonymous'}</b><small>{c.title}</small></div><p>{c.text}</p></article>)}{!allComments.length&&<p className="emptyDash">No comments yet.</p>}</section></>}

 {tab==='exhibits'&&<><section className="panel"><h2>Add New Exhibit</h2><form onSubmit={upload} className="uploadForm">{category==='editing'?<div className="beforeAfterInputs"><label className="dropzone"><input type="file" accept="image/*" onChange={e=>setBefore(e.target.files?.[0]||null)}/><span>🖼️ BEFORE<br/><small>{before?before.name:'Choose original image'}</small></span></label><label className="dropzone"><input type="file" accept="image/*" onChange={e=>setAfter(e.target.files?.[0]||null)}/><span>✨ AFTER<br/><small>{after?after.name:'Choose edited image'}</small></span></label></div>:<label className="dropzone"><input type="file" accept="image/*" multiple onChange={e=>setFiles([...e.target.files])}/><span>📸 Choose images<br/><small>{files.length?files.length+' selected':'JPG, PNG, WEBP · up to 15MB each'}</small></span></label>}<input placeholder="Exhibit title (optional)" value={title} onChange={e=>setTitle(e.target.value)}/><select value={category} onChange={e=>setCategory(e.target.value)}><option value="photography">Photography</option><option value="editing">Editing — Before / After</option><option value="design">Design</option></select><label className="check"><input type="checkbox" checked={featured} onChange={e=>setFeatured(e.target.checked)}/> Feature this exhibit</label><button disabled={busy}>{busy?'Uploading…':category==='editing'?'Add Before → After Exhibit':'Add Exhibit'}</button></form>{uploadProgress.total>0&&<div className="uploadProgress"><div className="uploadProgressTop"><b>Uploading collection</b><span>{uploadProgress.done}/{uploadProgress.total}</span></div><div className="uploadProgressTrack"><i style={{width:`${uploadProgress.done/uploadProgress.total*100}%`}}/></div><small>Uploading up to 4 images at once for a faster batch.</small></div>}{msg&&<p className="notice">{msg}</p>}</section><section><div className="sectionTitle"><h2>Exhibits in the Museum</h2><span>{photos.length} exhibits</span></div><div className="adminGrid">{rows.map(({p,s})=><div className="adminCard" key={p.engagementId}>{p.type==='before-after'?<div className="adminPair"><img src={p.beforeUrl} alt="Before"/><img src={p.afterUrl} alt="After"/></div>:<img src={p.url} alt={p.title}/>}<div><b>{p.title}</b><small>{p.type==='before-after'?'Editing · Before / After':p.category}{p.featured?' · Featured':''}</small><div className="miniStats"><span>♥ {s.likes}</span><span>◉ {s.views}</span><span>◌ {s.comments?.length||0}</span></div><button onClick={()=>remove(p)}>Remove exhibit</button></div></div>)}</div></section></>}

 {tab==='comments'&&<section className="dashPanel allComments"><div className="dashTitle"><div><p className="eyebrow">COMMUNITY NOTES</p><h2>Comments from visitors</h2></div><span>{allComments.length} total</span></div>{allComments.map(c=><article key={c.id}><div><b>{c.name||'Anonymous'}</b><small>{c.title} · {new Date(c.createdAt).toLocaleString()}</small></div><p>{c.text}</p></article>)}{!allComments.length&&<p className="emptyDash">No comments yet.</p>}</section>}
 </main>
}
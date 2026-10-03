'use client';
import {useEffect,useState} from 'react';
export default function Home(){const [photos,setPhotos]=useState([]);const [filter,setFilter]=useState('all');const [open,setOpen]=useState(null);const [loading,setLoading]=useState(true);
useEffect(()=>{fetch('/api/photos').then(r=>r.json()).then(d=>setPhotos(d.photos||[])).finally(()=>setLoading(false))},[]);
const cats=['all','photography','editing','design']; const visible=photos.filter(p=>filter==='all'||p.category===filter);
return <main><header><div className="brand"><span>CREATIVE</span> <b>GALLERY</b></div><p className="sub">Photography · Editing · Multimedia</p></header>
<section className="hero"><p>VISUAL WORKS</p><h1>A collection of moments,<br/>frames & imagination.</h1></section>
<nav>{cats.map(c=><button key={c} onClick={()=>setFilter(c)} className={filter===c?'active':''}>{c}</button>)}</nav>
{loading?<div className="state">Loading gallery…</div>:visible.length===0?<div className="state">No work uploaded yet.</div>:<section className="grid">{visible.map((p,i)=><button className="card" key={p.url} onClick={()=>setOpen(i)}><img src={p.url} alt={p.title||'Creative work'} loading="lazy"/><span>{p.title}</span></button>)}</section>}
{open!==null&&<div className="lightbox" onClick={()=>setOpen(null)}><button className="close">×</button><img src={visible[open].url} alt={visible[open].title||'Creative work'} onClick={e=>e.stopPropagation()}/><div className="caption">{visible[open].title||'Creative work'}</div></div>}
<footer><span>© {new Date().getFullYear()} Creative Gallery</span><a href="/admin">Private admin</a></footer></main>}
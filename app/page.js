'use client';
import {useEffect,useState} from 'react';

function BeforeAfter({before,after,compact=false}){
 const [pos,setPos]=useState(50);
 return <div className={`ba ${compact?'baCompact':''}`} onClick={e=>e.stopPropagation()}>
  <img className="baBase" src={after} alt="After edit"/>
  <div className="baBefore" style={{width:`${pos}%`}}><img src={before} alt="Before edit"/></div>
  <div className="baHandle" style={{left:`${pos}%`}}><span>↔</span></div>
  <input className="baRange" aria-label="Before and after slider" type="range" min="0" max="100" value={pos} onChange={e=>setPos(Number(e.target.value))}/>
  <div className="baLabel baBeforeLabel">BEFORE</div><div className="baLabel baAfterLabel">AFTER</div>
 </div>
}

export default function Home(){
 const [photos,setPhotos]=useState([]),[filter,setFilter]=useState('all'),[open,setOpen]=useState(null),[loading,setLoading]=useState(true);
 useEffect(()=>{fetch('/api/photos').then(r=>r.json()).then(d=>setPhotos(d.photos||[])).finally(()=>setLoading(false))},[]);
 const cats=['all','photography','editing','design'],visible=photos.filter(p=>filter==='all'||p.category===filter),featured=photos.filter(p=>p.featured).slice(0,6),isPair=p=>p.type==='before-after';
 return <main>
  <header><div className="brand"><span>THE CREATIVE</span> <b>MUSEUM</b></div><p className="sub">Photography · Editing · Design</p></header>
  <section className="hero"><p>WELCOME TO THE MUSEUM</p><h1>A collection of moments,<br/>frames & imagination.</h1><p className="heroText">A curated space for photography, creative editing and graphic design.</p><div className="heroLinks"><a href="#work">Enter the exhibits ↓</a><a href="#about">About the Museum</a></div></section>
  {featured.length>0&&<section className="featured"><div className="sectionTitle"><p>FEATURED EXHIBITS</p><span>Selected pieces from the collection</span></div><div className="featuredGrid">{featured.map((p,i)=><button className="featuredCard" key={p.type==='before-after'?p.id:p.url} onClick={()=>setOpen(p)}>{isPair(p)?<BeforeAfter before={p.beforeUrl} after={p.afterUrl} compact/>:<img src={p.url} alt={p.title||'Featured exhibit'} loading={i<2?'eager':'lazy'}/>}<span>{p.title}</span></button>)}</div></section>}
  <section id="work"><nav>{cats.map(c=><button key={c} onClick={()=>setFilter(c)} className={filter===c?'active':''}>{c==='editing'?'Editing · Before / After':c==='all'?'All Exhibits':c}</button>)}</nav>
  {loading?<div className="state">Opening the collection…</div>:visible.length===0?<div className="state">No exhibits have been added yet.</div>:<section className="grid">{visible.map((p,i)=><button className={`card ${isPair(p)?'pairCard':''}`} key={p.type==='before-after'?p.id:p.url} onClick={()=>setOpen(p)}>{isPair(p)?<BeforeAfter before={p.beforeUrl} after={p.afterUrl} compact/>:<img src={p.url} alt={p.title||'Creative exhibit'} loading={i<3?'eager':'lazy'}/>}<span>{p.title}{isPair(p)&&<small>Drag the slider · Before → After</small>}</span></button>)}</section>}
  </section>
  <section id="about" className="about"><p className="eyebrow">ABOUT THE MUSEUM</p><h2>A space for visual creativity.</h2><p>The Creative Museum brings together photography, creative editing and design pieces in one curated visual collection. Explore the exhibits, discover the transformations and experience the work.</p><div className="contactLinks">{process.env.NEXT_PUBLIC_INSTAGRAM_URL&&<a href={process.env.NEXT_PUBLIC_INSTAGRAM_URL} target="_blank" rel="noreferrer">Instagram ↗</a>}{process.env.NEXT_PUBLIC_WHATSAPP_URL&&<a href={process.env.NEXT_PUBLIC_WHATSAPP_URL} target="_blank" rel="noreferrer">WhatsApp ↗</a>}</div></section>
  {open&&<div className="lightbox" onClick={()=>setOpen(null)}><button className="close" aria-label="Close exhibit">×</button><div className="lightboxContent" onClick={e=>e.stopPropagation()}>{isPair(open)?<BeforeAfter before={open.beforeUrl} after={open.afterUrl}/>:<img src={open.url} alt={open.title||'Creative exhibit'}/>}<div className="caption">{open.title||'Untitled exhibit'}</div></div></div>}
  <footer><span>© {new Date().getFullYear()} The Creative Museum</span><div><a href="#about">About</a><a href="/admin">Curator access</a></div></footer>
 </main>
}
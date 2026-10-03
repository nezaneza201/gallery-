'use client';
import {useEffect,useRef,useState} from 'react';

function BeforeAfter({before,after,compact=false}){const [pos,setPos]=useState(50);return <div className={`ba ${compact?'baCompact':''}`} onClick={e=>e.stopPropagation()}><img className="baBase" src={after} alt="After edit"/><div className="baBefore" style={{width:`${pos}%`}}><img src={before} alt="Before edit"/></div><div className="baHandle" style={{left:`${pos}%`}><span>↔</span></div><input className="baRange" aria-label="Before and after slider" type="range" min="0" max="100" value={pos} onChange={e=>setPos(Number(e.target.value))}/><div className="baLabel baBeforeLabel">BEFORE</div><div className="baLabel baAfterLabel">AFTER</div></div>}

function Stats({stats}){return <small className="engagementStats"><span>♡ {stats?.likes||0}</span><span>◉ {stats?.views||0}</span><span>◌ {stats?.comments?.length||0}</span></div>}

function ExhibitCard({p,index,onOpen,stats,onView}){
 const ref=useRef(null);
 useEffect(()=>{const el=ref.current;if(!el||!p.engagementId)return;const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){onView(p.engagementId);io.disconnect()}},{threshold:.45});io.observe(el);return()=>io.disconnect()},[p.engagementId,onView]);
 const pair=p.type==='before-after';
 return <button ref={ref} className={`card ${pair?'pairCard':''}`} onClick={()=>onOpen(p)}>{pair?<BeforeAfter before={p.beforeUrl} after={p.afterUrl} compact/>:<img src={p.url} alt={p.title||'Creative exhibit'} loading={index<3?'eager':'lazy'}/>}<span>{p.title}{pair&&<small>Drag the slider · Before → After</small>}<Stats stats={stats}/></span></button>
}

function Engagement({exhibit,stats,onStats}){
 const [name,setName]=useState(''),[text,setText]=useState(''),[sending,setSending]=useState(false);
 const send=async(type,extra={})=>{setSending(true);try{const r=await fetch('/api/engagement',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:exhibit.engagementId,type,...extra})});const d=await r.json();if(r.ok)onStats(d)}finally{setSending(false)}};
 return <section className="engagement"><div className="engagementActions"><button className={stats?.liked?'liked':''} onClick={()=>send(stats?.liked?'unlike':'like')} disabled={sending}>♥ <b>{stats?.likes||0}</b></button><span>◉ {stats?.views||0} views</span><span>💬 {stats?.comments?.length||0} comments</span></div><div className="commentBox"><h3>Leave a note</h3><div className="commentForm"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name (optional)" maxLength={40}/><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Share your thoughts…" maxLength={500}/><button disabled={sending||text.trim().length<2} onClick={()=>{send('comment',{name,text});setText('')}}>Post comment</button></div>{stats?.comments?.length?<div className="comments">{stats.comments.map(c=><article key={c.id}><b>{c.name||'Anonymous'}</b><p>{c.text}</p></article>)}</div>:<p className="emptyComments">No comments yet. Be the first.</p>}</div></section>
}

export default function Home(){
 const [photos,setPhotos]=useState([]),[filter,setFilter]=useState('all'),[open,setOpen]=useState(null),[loading,setLoading]=useState(true),[stats,setStats]=useState({});
 useEffect(()=>{fetch('/api/photos').then(r=>r.json()).then(async d=>{const ps=d.photos||[];setPhotos(ps);if(ps.length){const ids=ps.map(p=>p.engagementId).filter(Boolean).join(',');const r=await fetch('/api/engagement?ids='+encodeURIComponent(ids));const x=await r.json();setStats(x.items||{})}}).finally(()=>setLoading(false))},[]);
 const cats=['all','photography','editing','design'],visible=photos.filter(p=>filter==='all'||p.category===filter),featured=photos.filter(p=>p.featured).slice(0,6),isPair=p=>p.type==='before-after';
 const onView=id=>{if(!id)return;setStats(s=>({...s,[id]:{...(s[id]||{}),views:(s[id]?.views||0)+1}}));fetch('/api/engagement',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id,type:'view'})}).then(r=>r.json()).then(d=>setStats(s=>({...s,[id]:d}))).catch(()=>{})};
 const openExhibit=p=>{setOpen(p);fetch('/api/engagement?id='+encodeURIComponent(p.engagementId)).then(r=>r.json()).then(d=>setStats(s=>({...s,[p.engagementId]:d}))).catch(()=>{})};
 return <main>
  <header><div className="brand"><span>THE CREATIVE</span> <b>MUSEUM</b></div><p className="sub">Photography · Editing · Design</p></header>
  <section className="hero"><p>WELCOME TO THE MUSEUM</p><h1>A collection of moments,<br/>frames & imagination.</h1><p className="heroText">A curated space for photography, creative editing and graphic design.</p><div className="heroLinks"><a href="#work">Enter the exhibits ↓</a><a href="#about">About the Museum</a></div></section>
  {featured.length>0&&<section className="featured"><div className="sectionTitle"><p>FEATURED EXHIBITS</p><span>Selected pieces from the collection</span></div><div className="featuredGrid">{featured.map((p,i)=><button className="featuredCard" key={p.engagementId} onClick={()=>openExhibit(p)}>{isPair(p)?<BeforeAfter before={p.beforeUrl} after={p.afterUrl} compact/>:<img src={p.url} alt={p.title||'Featured exhibit'} loading={i<2?'eager':'lazy'}/>}<span>{p.title}<Stats stats={stats[p.engagementId]}/></span></button>)}</div></section>}
  <section id="work"><nav>{cats.map(c=><button key={c} onClick={()=>setFilter(c)} className={filter===c?'active':''}>{c==='editing'?'Editing · Before / After':c==='all'?'All Exhibits':c}</button>)}</nav>
  {loading?<div className="state">Opening the collection…</div>:visible.length===0?<div className="state">No exhibits have been added yet.</div>:<section className="grid">{visible.map((p,i)=><ExhibitCard key={p.engagementId} p={p} index={i} onOpen={openExhibit} stats={stats[p.engagementId]} onView={onView}/>)}</section>}</section>
  <section id="about" className="about"><p className="eyebrow">ABOUT THE MUSEUM</p><h2>A space for visual creativity.</h2><p>The Creative Museum brings together photography, creative editing and design pieces in one curated visual collection. Explore the exhibits, discover the transformations and experience the work.</p><div className="contactLinks">{process.env.NEXT_PUBLIC_INSTAGRAM_URL&&<a href={process.env.NEXT_PUBLIC_INSTAGRAM_URL} target="_blank" rel="noreferrer">Instagram ↗</a>}{process.env.NEXT_PUBLIC_WHATSAPP_URL&&<a href={process.env.NEXT_PUBLIC_WHATSAPP_URL} target="_blank" rel="noreferrer">WhatsApp ↗</a>}</div></section>
  {open&&<div className="lightbox" onClick={()=>setOpen(null)}><button className="close" aria-label="Close exhibit">×</button><div className="lightboxContent" onClick={e=>e.stopPropagation()}>{isPair(open)?<BeforeAfter before={open.beforeUrl} after={open.afterUrl}/>:<img src={open.url} alt={open.title||'Creative exhibit'}/>}<div className="caption">{open.title||'Untitled exhibit'}</div><Engagement exhibit={open} stats={stats[open.engagementId]||{}} onStats={d=>setStats(s=>({...s,[open.engagementId]:d}))}/></div></div>}
  <footer><span>© {new Date().getFullYear()} The Creative Museum</span><div><a href="#about">About</a><a href="/admin">Curator access</a></div></footer>
 </main>
}
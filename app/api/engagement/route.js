import {list,put} from '@vercel/blob';
import crypto from 'crypto';
import {authorized} from '../login/route';

const ID_RE=/^[a-zA-Z0-9_-]{1,100}$/;
function validId(id){return typeof id==='string'&&ID_RE.test(id)}
function visitorId(req){
 const m=req.headers.get('cookie')?.match(/(?:^|;\s*)cm_vid=([^;]+)/);
 if(m) return decodeURIComponent(m[1]);
 return crypto.randomUUID();
}
function cookie(id){return `cm_vid=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`}
async function readEvents(id){
 const {blobs}=await list({prefix:`engagement/${id}/`});
 const out=[];
 for(const b of blobs){
  try{
   const r=await fetch(b.url,{cache:'no-store'});
   if(r.ok)out.push(await r.json());
  }catch{}
 }
 return out.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
}
function summarize(events,vid){
 const latestLikes=new Map(),comments=[];
 let views=0;
 for(const e of events){
  if(e.type==='view')views++;
  if(e.type==='like'||e.type==='unlike')latestLikes.set(e.visitorId,e.type==='like');
  if(e.type==='comment')comments.push(e);
 }
 return {views,likes:[...latestLikes.values()].filter(Boolean).length,comments:comments.slice(-100).reverse(),liked:vid?!!latestLikes.get(vid):false};
}
export async function GET(req){
 const {searchParams}=new URL(req.url);
 const admin=searchParams.get('admin')==='1';
 try{
  if(admin){
   if(!authorized(req))return Response.json({error:'Unauthorized'},{status:401});
   const {blobs}=await list({prefix:'engagement/'});
   const byId=new Map();
   for(const b of blobs){
    try{
     const r=await fetch(b.url,{cache:'no-store'}); if(!r.ok)continue;
     const e=await r.json(); const id=b.pathname.split('/')[1];
     if(!byId.has(id))byId.set(id,[]);
     byId.get(id).push(e);
    }catch{}
   }
   const items={};
   for(const [id,events] of byId){
    events.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
    items[id]=summarize(events);
   }
   return Response.json({items});
  }
  const idsParam=searchParams.get('ids');
  if(idsParam){
   const ids=idsParam.split(',').filter(validId).slice(0,100);
   const items={};
   for(const id of ids){
    const events=await readEvents(id);
    items[id]=summarize(events);
   }
   return Response.json({items});
  }
  const id=searchParams.get('id');
  if(!validId(id))return Response.json({error:'Invalid exhibit.'},{status:400});
  const vid=visitorId(req),events=await readEvents(id),s=summarize(events,vid);
  const res=Response.json({views:s.views,likes:s.likes,comments:s.comments.map(({id,name,text,createdAt})=>({id,name,text,createdAt})),liked:s.liked});
  if(!req.headers.get('cookie')?.includes('cm_vid='))res.headers.set('Set-Cookie',cookie(vid));
  return res;
 }catch{return Response.json({items:{},views:0,likes:0,comments:[],liked:false})}
}
export async function POST(req){
 try{
  const body=await req.json(),id=body.id,type=body.type;
  if(!validId(id)||!['view','like','unlike','comment'].includes(type))return Response.json({error:'Invalid engagement.'},{status:400});
  const vid=visitorId(req);
  const events=await readEvents(id);
  if(type==='view'&&events.some(e=>e.type==='view'&&e.visitorId===vid&&Date.now()-new Date(e.createdAt).getTime()<86400000)){
   const res=Response.json(summarize(events,vid));if(!req.headers.get('cookie')?.includes('cm_vid='))res.headers.set('Set-Cookie',cookie(vid));return res;
  }
  if((type==='like'||type==='unlike')){
   const latest=[...events].reverse().find(e=>e.visitorId===vid&&(e.type==='like'||e.type==='unlike'));
   const currentlyLiked=latest?.type==='like';
   if((type==='like'&&currentlyLiked)||(type==='unlike'&&!currentlyLiked)){
    const res=Response.json(summarize(events,vid));if(!req.headers.get('cookie')?.includes('cm_vid='))res.headers.set('Set-Cookie',cookie(vid));return res;
   }
  }
  if(type==='comment'){
   const name=String(body.name||'Anonymous').trim().slice(0,40);
   const text=String(body.text||'').trim().slice(0,500);
   if(text.length<2)return Response.json({error:'Comment is too short.'},{status:400});
   if(events.some(e=>e.type==='comment'&&e.visitorId===vid&&Date.now()-new Date(e.createdAt).getTime()<30000))return Response.json({error:'Please wait a moment before commenting again.'},{status:429});
   const event={id:crypto.randomUUID(),type,name:name||'Anonymous',text,visitorId:vid,createdAt:new Date().toISOString()};
   await put(`engagement/${id}/${event.id}.json`,JSON.stringify(event),{access:'public',addRandomSuffix:false});
  }else{
   const event={id:crypto.randomUUID(),type,visitorId:vid,createdAt:new Date().toISOString()};
   await put(`engagement/${id}/${event.id}.json`,JSON.stringify(event),{access:'public',addRandomSuffix:false});
  }
  const fresh=await readEvents(id),res=Response.json(summarize(fresh,vid));
  if(!req.headers.get('cookie')?.includes('cm_vid='))res.headers.set('Set-Cookie',cookie(vid));
  return res;
 }catch{return Response.json({error:'Engagement service unavailable.'},{status:500})}
}
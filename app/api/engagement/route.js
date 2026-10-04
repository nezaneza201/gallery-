import crypto from 'crypto';

const ID_RE=/^[a-zA-Z0-9_-]{1,100}$/;
const OWNER=process.env.GITHUB_MEDIA_OWNER||'nezaneza201';
const REPO=process.env.GITHUB_MEDIA_REPO||'gallery-';
const BRANCH=process.env.GITHUB_MEDIA_BRANCH||'main';

function validId(id){return typeof id==='string'&&ID_RE.test(id)}
function headers(){return {'Accept':'application/vnd.github+json','Authorization':`Bearer ${process.env.GITHUB_TOKEN}`,'X-GitHub-Api-Version':'2026-03-10','Content-Type':'application/json'}}
function visitorId(req){
 const m=req.headers.get('cookie')?.match(/(?:^|;\\s*)cm_vid=([^;]+)/);
 if(m)return decodeURIComponent(m[1]);
 return crypto.randomUUID();
}
function cookie(id){return `cm_vid=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`}
async function github(path,options={}){
 if(!process.env.GITHUB_TOKEN)throw new Error('GITHUB_TOKEN is not configured');
 const r=await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,{...options,headers:{...headers(),...(options.headers||{})},cache:'no-store'});
 if(!r.ok)throw new Error(`GitHub API ${r.status}`);
 return r.json();
}
async function readEvents(id){
 try{
  const items=await github(`engagement/${id}?ref=${encodeURIComponent(BRANCH)}`);
  const files=Array.isArray(items)?items.filter(x=>x.type==='file'&&x.name.endsWith('.json')):[];
  const out=[];
  for(const f of files){try{const r=await fetch(f.download_url,{cache:'no-store'});if(r.ok)out.push(await r.json())}catch{}}
  return out.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
 }catch(err){
  if(String(err?.message||'').includes('GitHub API 404'))return [];
  throw err;
 }
}
function summarize(events,vid){
 const latestLikes=new Map(),latestRatings=new Map(),comments=[];let views=0,shares=0;
 for(const e of events){
  if(e.type==='view')views++;
  if(e.type==='share')shares++;
  if(e.type==='like'||e.type==='unlike')latestLikes.set(e.visitorId,e.type==='like');
  if(e.type==='rating'&&Number(e.rating)>=1&&Number(e.rating)<=5)latestRatings.set(e.visitorId,Number(e.rating));
  if(e.type==='comment')comments.push(e);
 }
 const ratings=[...latestRatings.values()];
 return {views,shares,likes:[...latestLikes.values()].filter(Boolean).length,commentCount:comments.length,comments:comments.slice(-100).reverse(),ratingCount:ratings.length,ratingAverage:ratings.length?Number((ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1)):0,myRating:vid?latestRatings.get(vid)||0:0,liked:vid?!!latestLikes.get(vid):false};
}
function publicStats(s){return {views:s.views,shares:s.shares,likes:s.likes,comments:s.comments.map(({id,name,text,createdAt})=>({id,name,text,createdAt})),liked:s.liked,ratingCount:s.ratingCount,ratingAverage:s.ratingAverage,myRating:s.myRating}}
async function saveEvent(id,event){
 const path=`engagement/${id}/${event.id}.json`;
 const content=Buffer.from(JSON.stringify(event)).toString('base64');
 await github(path,{method:'PUT',body:JSON.stringify({message:`Record museum ${event.type}`,content,branch:BRANCH})});
}
async function responseFor(req,id,events,vid){
 const res=Response.json(publicStats(summarize(events,vid)));
 if(!req.headers.get('cookie')?.includes('cm_vid='))res.headers.set('Set-Cookie',cookie(vid));
 return res;
}
export async function GET(req){
 const {searchParams}=new URL(req.url),idsParam=searchParams.get('ids'),id=searchParams.get('id');
 try{
  if(idsParam){const ids=idsParam.split(',').filter(validId).slice(0,100),items={};for(const item of ids)items[item]=summarize(await readEvents(item));return Response.json({items})}
  if(!validId(id))return Response.json({error:'Invalid exhibit.'},{status:400});
  const vid=visitorId(req);return responseFor(req,id,await readEvents(id),vid);
 }catch{return Response.json({error:'Engagement service unavailable.'},{status:500})}
}
export async function POST(req){
 try{
  const body=await req.json(),id=body.id,type=body.type;
  if(!validId(id)||!['view','like','unlike','comment','share','rating'].includes(type))return Response.json({error:'Invalid engagement.'},{status:400});
  const vid=visitorId(req),events=await readEvents(id);
  if(type==='view'&&events.some(e=>e.type==='view'&&e.visitorId===vid&&Date.now()-new Date(e.createdAt).getTime()<86400000))return responseFor(req,id,events,vid);
  if(type==='like'||type==='unlike'){
   const latest=[...events].reverse().find(e=>e.visitorId===vid&&(e.type==='like'||e.type==='unlike')),currentlyLiked=latest?.type==='like';
   if((type==='like'&&currentlyLiked)||(type==='unlike'&&!currentlyLiked))return responseFor(req,id,events,vid);
  }
  if(type==='rating'){const rating=Number(body.rating);if(!Number.isInteger(rating)||rating<1||rating>5)return Response.json({error:'Rating must be between 1 and 5.'},{status:400})}
  if(type==='comment'){
   const name=String(body.name||'Anonymous').trim().slice(0,40),text=String(body.text||'').trim().slice(0,500);
   if(text.length<2)return Response.json({error:'Comment is too short.'},{status:400});
   if(events.some(e=>e.type==='comment'&&e.visitorId===vid&&Date.now()-new Date(e.createdAt).getTime()<30000))return Response.json({error:'Please wait a moment before commenting again.'},{status:429});
   body.name=name||'Anonymous';body.text=text;
  }
  const event={id:crypto.randomUUID(),type,visitorId:vid,createdAt:new Date().toISOString(),...(type==='comment'?{name:body.name,text:body.text}:{}),...(type==='rating'?{rating:Number(body.rating)}:{})};
  await saveEvent(id,event);
  return responseFor(req,id,await readEvents(id),vid);
 }catch{return Response.json({error:'Engagement service unavailable.'},{status:500})}
}

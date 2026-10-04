import {list as blobList} from '@vercel/blob';
import crypto from 'crypto';

const OWNER=process.env.GITHUB_MEDIA_OWNER||'nezaneza201';
const REPO=process.env.GITHUB_MEDIA_REPO||'gallery-';
const BRANCH=process.env.GITHUB_MEDIA_BRANCH||'main';

function engagementId(path){return crypto.createHash('sha256').update(path).digest('hex').slice(0,24)}
function imageUrl(path){return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${path.split('/').map(encodeURIComponent).join('/')}`}
async function listDir(dir){
 const r=await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${dir}?ref=${encodeURIComponent(BRANCH)}`,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},cache:'no-store'});
 if(!r.ok)return [];
 const d=await r.json();
 return Array.isArray(d)?d.filter(x=>x.type==='file'&&/\.(jpg|jpeg|png|webp|gif)$/i.test(x.name)).map(x=>({pathname:x.path,url:imageUrl(x.path),uploadedAt:new Date(),storage:'github',sha:x.sha})): [];
}
function parse(items){
 const photos=[],pairs=new Map();
 for(const b of items){
  const parts=b.pathname.split('/');const category=parts[1]||'photography';const file=parts.slice(2).join('/');
  const raw=file.replace(/\.[^.]+$/,'');const featured=raw.startsWith('featured-');const cleanRaw=raw.replace(/^featured-/,'');
  const match=cleanRaw.match(/^([a-z0-9]{8})--(before|after)--(.+)$/);
  if(category==='editing'&&match){
   const [,id,side,slug]=match;
   if(!pairs.has(id))pairs.set(id,{id,type:'before-after',category:'editing',title:slug.replace(/[-_]+/g,' ')||'Editing project',featured:false,uploadedAt:b.uploadedAt,beforeUrl:null,afterUrl:null,beforePath:null,afterPath:null,beforeStorage:null,afterStorage:null,beforeSha:null,afterSha:null});
   const p=pairs.get(id);p[side+'Url']=b.url;p[side+'Path']=b.pathname;p[side+'Storage']=b.storage||'github';p[side+'Sha']=b.sha;p.featured=p.featured||featured;continue;
  }
  const clean=cleanRaw.replace(/^\d+-[a-z0-9]+-/,'');
  photos.push({type:'photo',url:b.url,pathname:b.pathname,sha:b.sha,storage:b.storage||'github',engagementId:engagementId((b.storage||'github')+':'+b.pathname),category,title:clean.replace(/[-_]+/g,' ')||'Creative work',featured,uploadedAt:b.uploadedAt});
 }
 for(const p of pairs.values()){
  if(p.beforeUrl&&p.afterUrl){p.engagementId='edit-'+p.id;photos.push(p)}
  else{const path=p.beforePath||p.afterPath;photos.push({type:'photo',url:p.beforeUrl||p.afterUrl,pathname:path,sha:p.beforeSha||p.afterSha,storage:p.beforeStorage||p.afterStorage||'github',engagementId:engagementId((p.beforeStorage||p.afterStorage||'github')+':'+path),category:'editing',title:p.title,featured:p.featured,uploadedAt:p.uploadedAt})}
 }
 return photos;
}
export async function GET(){
 try{
  const [vb,photography,editing,design]=await Promise.all([
   blobList({prefix:'gallery/'}).then(x=>x.blobs.map(b=>({pathname:b.pathname,url:b.url,uploadedAt:b.uploadedAt,storage:'blob'}))).catch(()=>[]),
   listDir('gallery/photography'),listDir('gallery/editing'),listDir('gallery/design')
  ]);
  const items=parse([...vb,...photography,...design,...editing]);
  items.sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt));
  return Response.json({photos:items});
 }catch(e){console.error('Gallery error:',e);return Response.json({photos:[],error:e?.message||'Gallery storage is unavailable.'},{status:500});}
}

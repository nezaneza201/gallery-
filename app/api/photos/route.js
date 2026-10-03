import {list} from '@vercel/blob';
import crypto from 'crypto';

function engagementId(path){return crypto.createHash('sha256').update(path).digest('hex').slice(0,24)}
export async function GET(){
 try{
  const {blobs}=await list({prefix:'gallery/'});
  const items=[]; const pairs=new Map();
  for(const b of blobs){
   const parts=b.pathname.split('/'); const category=parts[1]||'photography'; const file=parts.slice(2).join('/');
   const raw=file.replace(/\.[^.]+$/,''); const featured=raw.startsWith('featured-'); const cleanRaw=raw.replace(/^featured-/,'');
   const match=cleanRaw.match(/^([a-z0-9]{8})--(before|after)--(.+)$/);
   if(category==='editing'&&match){
    const [,id,side,slug]=match;
    if(!pairs.has(id))pairs.set(id,{id,type:'before-after',category:'editing',title:slug.replace(/[-_]+/g,' ')||'Editing project',featured:false,uploadedAt:b.uploadedAt,beforeUrl:null,afterUrl:null,beforePath:null,afterPath:null});
    const p=pairs.get(id); p[side+'Url']=b.url; p[side+'Path']=b.pathname; p.featured=p.featured||featured;
    if(new Date(b.uploadedAt)>new Date(p.uploadedAt))p.uploadedAt=b.uploadedAt;
    continue;
   }
   const clean=cleanRaw.replace(/^\d+-[a-z0-9]+-/,'');
   items.push({type:'photo',url:b.url,pathname:b.pathname,engagementId:engagementId(b.pathname),category,title:clean.replace(/[-_]+/g,' ')||'Creative work',featured,uploadedAt:b.uploadedAt});
  }
  for(const p of pairs.values()){
   if(p.beforeUrl&&p.afterUrl)p.engagementId='edit-'+p.id,items.push(p);
   else{
    const path=p.beforePath||p.afterPath;
    items.push({type:'photo',url:p.beforeUrl||p.afterUrl,pathname:path,engagementId:engagementId(path),category:'editing',title:p.title,featured:p.featured,uploadedAt:p.uploadedAt});
   }
  }
  items.sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt));
  return Response.json({photos:items});
 }catch{return Response.json({photos:[],error:'Gallery storage is not configured yet.'})}
}
import {list} from '@vercel/blob';
export async function GET(){
 try{
  const {blobs}=await list({prefix:'gallery/'});
  const photos=blobs.map(b=>{
   const parts=b.pathname.split('/'); const category=parts[1]||'photography'; const file=parts.slice(2).join('/');
   const raw=file.replace(/\.[^.]+$/,'');
   const clean=raw.replace(/^featured-/,'').replace(/^\d+-[a-z0-9]+-/,'');
   return {url:b.url,pathname:b.pathname,category,title:clean.replace(/[-_]+/g,' ')||'Creative work',featured:raw.startsWith('featured-'),uploadedAt:b.uploadedAt};
  }).sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt));
  return Response.json({photos});
 }catch(e){return Response.json({photos:[],error:'Gallery storage is not configured yet.'})}
}
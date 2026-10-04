import {list as blobList} from '@vercel/blob';
import {ListObjectsV2Command} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import {r2Client,R2_BUCKET,r2Configured} from '../../../lib/r2';

function engagementId(path){return crypto.createHash('sha256').update(path).digest('hex').slice(0,24)}

async function readR2(){
 if(!r2Configured())return [];
 const s3=r2Client(),out=[];
 let token;
 do{
  const res=await s3.send(new ListObjectsV2Command({Bucket:R2_BUCKET(),Prefix:'gallery/',ContinuationToken:token}));
  for(const o of res.Contents||[]){
   if(!o.Key)continue;
   const url=await getSignedUrl(s3,new (await import('@aws-sdk/client-s3')).GetObjectCommand({Bucket:R2_BUCKET(),Key:o.Key}),{expiresIn:3600});
   out.push({pathname:o.Key,url,uploadedAt:o.LastModified||new Date()});
  }
  token=res.IsTruncated?res.NextContinuationToken:undefined;
 }while(token);
 return out;
}

function parse(items){
 const photos=[],pairs=new Map();
 for(const b of items){
  const parts=b.pathname.split('/');const category=parts[1]||'photography';const file=parts.slice(2).join('/');
  const raw=file.replace(/\\.[^.]+$/,'');const featured=raw.startsWith('featured-');const cleanRaw=raw.replace(/^featured-/,'');
  const match=cleanRaw.match(/^([a-z0-9]{8})--(before|after)--(.+)$/);
  if(category==='editing'&&match){
   const [,id,side,slug]=match;
   if(!pairs.has(id))pairs.set(id,{id,type:'before-after',category:'editing',title:slug.replace(/[-_]+/g,' ')||'Editing project',featured:false,uploadedAt:b.uploadedAt,beforeUrl:null,afterUrl:null,beforePath:null,afterPath:null,beforeStorage:null,afterStorage:null});
   const p=pairs.get(id);p[side+'Url']=b.url;p[side+'Path']=b.pathname;p[side+'Storage']=b.storage||'r2';p.featured=p.featured||featured;
   if(new Date(b.uploadedAt)>new Date(p.uploadedAt))p.uploadedAt=b.uploadedAt;
   continue;
  }
  const clean=cleanRaw.replace(/^\\d+-[a-z0-9]+-/,'');
  photos.push({type:'photo',url:b.url,pathname:b.pathname,storage:b.storage||'r2',engagementId:engagementId((b.storage||'r2')+':'+b.pathname),category,title:clean.replace(/[-_]+/g,' ')||'Creative work',featured,uploadedAt:b.uploadedAt});
 }
 for(const p of pairs.values()){
  if(p.beforeUrl&&p.afterUrl){p.engagementId='edit-'+p.id;photos.push(p)}
  else{
   const path=p.beforePath||p.afterPath;
   photos.push({type:'photo',url:p.beforeUrl||p.afterUrl,pathname:path,storage:p.beforeStorage||p.afterStorage||'r2',engagementId:engagementId((p.beforeStorage||p.afterStorage||'r2')+':'+path),category:'editing',title:p.title,featured:p.featured,uploadedAt:p.uploadedAt});
  }
 }
 return photos;
}

export async function GET(){
 try{
  const [vb,r2]=await Promise.all([
   blobList({prefix:'gallery/'}).then(x=>x.blobs.map(b=>({pathname:b.pathname,url:b.url,uploadedAt:b.uploadedAt,storage:'blob'}))).catch(()=>[]),
   readR2()
  ]);
  const items=parse([...vb,...r2]);
  items.sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt));
  return Response.json({photos:items});
 }catch(e){
  console.error('Gallery error:',e);
  return Response.json({photos:[],error:e?.message||'Gallery storage is unavailable.'},{status:500});
 }
}

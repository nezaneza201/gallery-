import {put as blobPut,del as blobDel} from '@vercel/blob';
import {DeleteObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
import {authorized} from '../login/route';
import {r2Client,R2_BUCKET,r2Configured} from '../../../lib/r2';
import crypto from 'crypto';

function slugify(v){return v.toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'creative-work'}

async function store(file,path){
 if(!r2Configured())throw new Error('R2 storage is not configured. Add the R2 environment variables in Vercel.');
 const bytes=Buffer.from(await file.arrayBuffer());
 await r2Client().send(new PutObjectCommand({
  Bucket:R2_BUCKET(),
  Key:path,
  Body:bytes,
  ContentType:file.type||'application/octet-stream'
 }));
 return path;
}

export async function POST(req){
 if(!authorized(req))return Response.json({error:'Unauthorized'},{status:401});
 try{
  const form=await req.formData();
  const category=(form.get('category')||'photography').toString().toLowerCase().replace(/[^a-z]/g,'')||'photography';
  const title=(form.get('title')||'Creative work').toString().trim();
  const featured=form.get('featured')==='true';
  const slug=slugify(title);

  if(category==='editing'){
   const before=form.get('before'),after=form.get('after');
   if(!(before instanceof File)||!(after instanceof File))return Response.json({error:'Choose both a before and an after image.'},{status:400});
   if(!before.type.startsWith('image/')||!after.type.startsWith('image/'))return Response.json({error:'Before and after files must be images.'},{status:400});
   if(before.size>15*1024*1024||after.size>15*1024*1024)return Response.json({error:'Each image must be 15MB or smaller.'},{status:400});
   const id=crypto.randomUUID().slice(0,8),flag=featured?'featured-':'';
   const be=(before.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';
   const ae=(after.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';
   const beforeKey=`gallery/editing/${flag}${id}--before--${slug}.${be}`;
   const afterKey=`gallery/editing/${flag}${id}--after--${slug}.${ae}`;
   await store(before,beforeKey); await store(after,afterKey);
   return Response.json({uploaded:1,type:'before-after',keys:[beforeKey,afterKey]});
  }

  const files=form.getAll('files');
  if(!files.length)return Response.json({error:'Choose at least one image.'},{status:400});
  let uploaded=0,keys=[];
  for(const file of files){
   if(!(file instanceof File))continue;
   if(!file.type.startsWith('image/'))continue;
   if(file.size>15*1024*1024)continue;
   const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';
   const flag=featured?'featured-':'';
   const key=`gallery/${category}/${flag}${Date.now()}-${crypto.randomUUID().slice(0,8)}-${slug}.${ext}`;
   await store(file,key);keys.push(key);uploaded++;
  }
  if(!uploaded)return Response.json({error:'No valid image files were selected. Use JPG, PNG or WEBP images up to 15MB.'},{status:400});
  return Response.json({uploaded,keys});
 }catch(e){
  console.error('Upload error:',e);
  return Response.json({error:e?.message||'Upload failed.'},{status:500});
 }
}

export async function DELETE(req){
 if(!authorized(req))return Response.json({error:'Unauthorized'},{status:401});
 try{
  const body=await req.json();
  const urls=Array.isArray(body.urls)?body.urls:(body.url?[body.url]:[]);
  const keys=Array.isArray(body.keys)?body.keys:(body.key?[body.key]:[]);
  if(!urls.length&&!keys.length)return Response.json({error:'No files selected.'},{status:400});

  if(keys.length&&r2Configured()){
   await Promise.all(keys.map(key=>r2Client().send(new DeleteObjectCommand({Bucket:R2_BUCKET(),Key:key}))));
  }
  if(urls.length){
   await Promise.all(urls.map(url=>blobDel(url)));
  }
  return Response.json({ok:true});
 }catch(e){
  console.error('Delete error:',e);
  return Response.json({error:e?.message||'Delete failed.'},{status:500});
 }
}

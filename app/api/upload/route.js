import {put,del} from '@vercel/blob';
import {authorized} from '../login/route';
import crypto from 'crypto';

function slugify(v){return v.toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'creative-work'}
async function store(file,path){await put(path,file,{access:'public',addRandomSuffix:false})}

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
   const id=crypto.randomUUID().slice(0,8);
   const flag=featured?'featured-':'';
   const be=(before.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';
   const ae=(after.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';
   await store(before,`gallery/editing/${flag}${id}--before--${slug}.${be}`);
   await store(after,`gallery/editing/${flag}${id}--after--${slug}.${ae}`);
   return Response.json({uploaded:1,type:'before-after'});
  }

  const files=form.getAll('files');
  if(!files.length)return Response.json({error:'Choose at least one image.'},{status:400});
  let uploaded=0;
  for(const file of files){
   if(!(file instanceof File)||!file.type.startsWith('image/')||file.size>15*1024*1024)continue;
   const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';
   const flag=featured?'featured-':'';
   await store(file,`gallery/${category}/${flag}${Date.now()}-${crypto.randomUUID().slice(0,8)}-${slug}.${ext}`);
   uploaded++;
  }
  return Response.json({uploaded});
 }catch(e){console.error('Upload error:',e);return Response.json({error:e?.message||'Upload failed.'},{status:500})}
}

export async function DELETE(req){
 if(!authorized(req))return Response.json({error:'Unauthorized'},{status:401});
 try{
  const body=await req.json();
  const urls=Array.isArray(body.urls)?body.urls:(body.url?[body.url]:[]);
  if(!urls.length)return Response.json({error:'No files selected.'},{status:400});
  await Promise.all(urls.map(url=>del(url)));
  return Response.json({ok:true});
 }catch(e){return Response.json({error:'Delete failed.'},{status:500})}
}
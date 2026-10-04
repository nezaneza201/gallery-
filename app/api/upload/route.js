import {put as blobPut,del as blobDel} from '@vercel/blob';
import {authorized} from '../login/route';
import crypto from 'crypto';

function slugify(v){return v.toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'creative-work'}

const OWNER=process.env.GITHUB_MEDIA_OWNER||'nezaneza201';
const REPO=process.env.GITHUB_MEDIA_REPO||'gallery-';
const BRANCH=process.env.GITHUB_MEDIA_BRANCH||'main';
function ghHeaders(){return {'Accept':'application/vnd.github+json','Authorization':`Bearer ${process.env.GITHUB_TOKEN}`,'X-GitHub-Api-Version':'2026-03-10','Content-Type':'application/json'}}
function ghUrl(path){return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`}
async function store(file,path){
 if(!process.env.GITHUB_TOKEN)throw new Error('GitHub image storage is not configured. Add GITHUB_TOKEN in Vercel.');
 const bytes=Buffer.from(await file.arrayBuffer());
 const content=bytes.toString('base64');
 const r=await fetch(ghUrl(path),{method:'PUT',headers:ghHeaders(),body:JSON.stringify({message:`Add museum exhibit: ${path.split('/').pop()}`,content,branch:BRANCH})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(d.message||`GitHub upload failed (${r.status}).`);
 return d.content||{};
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
   const b=await store(before,beforeKey); const a=await store(after,afterKey);
   return Response.json({uploaded:1,type:'before-after',files:[{path:beforeKey,sha:b.sha},{path:afterKey,sha:a.sha}]});
  }

  const files=form.getAll('files');
  if(!files.length)return Response.json({error:'Choose at least one image.'},{status:400});
  let uploaded=0,items=[];
  for(const file of files){
   if(!(file instanceof File))continue;
   if(!file.type.startsWith('image/'))continue;
   if(file.size>15*1024*1024)continue;
   const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';
   const flag=featured?'featured-':'';
   const key=`gallery/${category}/${flag}${Date.now()}-${crypto.randomUUID().slice(0,8)}-${slug}.${ext}`;
   const c=await store(file,key);items.push({path:key,sha:c.sha});uploaded++;
  }
  if(!uploaded)return Response.json({error:'No valid image files were selected. Use JPG, PNG or WEBP images up to 15MB.'},{status:400});
  return Response.json({uploaded,files:items});
 }catch(e){
  console.error('Upload error:',e);
  return Response.json({error:e?.message||'Upload failed.'},{status:500});
 }
}

export async function DELETE(req){
 if(!authorized(req))return Response.json({error:'Unauthorized'},{status:401});
 try{
  const body=await req.json();
  const files=Array.isArray(body.files)?body.files:[];
  const urls=Array.isArray(body.urls)?body.urls:(body.url?[body.url]:[]);
  if(!files.length&&!urls.length)return Response.json({error:'No files selected.'},{status:400});
  if(files.length){
   if(!process.env.GITHUB_TOKEN)throw new Error('GitHub image storage is not configured.');
   for(const f of files){
    if(!f?.path||!f?.sha)continue;
    const r=await fetch(ghUrl(f.path),{method:'DELETE',headers:ghHeaders(),body:JSON.stringify({message:`Remove museum exhibit: ${f.path.split('/').pop()}`,sha:f.sha,branch:BRANCH})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.message||`GitHub delete failed (${r.status}).`);
   }
  }
  if(urls.length)await Promise.all(urls.map(url=>blobDel(url)));
  return Response.json({ok:true});
 }catch(e){
  console.error('Delete error:',e);
  return Response.json({error:e?.message||'Delete failed.'},{status:500});
 }
}

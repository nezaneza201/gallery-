import crypto from 'crypto';

const COOKIE='gallery_admin';
function secret(){return process.env.ADMIN_PASSWORD||''}
function sign(value){return crypto.createHmac('sha256',secret()).update(value).digest('hex')}
function makeCookie(){
  const exp=Math.floor(Date.now()/1000)+86400;
  const value='1.'+exp+'.'+sign('1.'+exp);
  return COOKIE+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400';
}
export function authorized(req){
  const raw=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
  if(!raw)return false;
  const value=raw.slice(COOKIE.length+1);
  const parts=value.split('.');
  const v=parts[0],exp=parts[1],sig=parts[2];
  if(v!=='1'||!exp||!sig||Number(exp)<Math.floor(Date.now()/1000)||!secret())return false;
  const expected=sign('1.'+exp);
  return sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected));
}
export async function POST(req){
  try{
    const {password}=await req.json();
    const expected=process.env.ADMIN_PASSWORD;
    if(!expected)return Response.json({error:'ADMIN_PASSWORD is not configured.'},{status:500});
    const a=Buffer.from(String(password||'')),b=Buffer.from(expected);
    const ok=a.length===b.length&&crypto.timingSafeEqual(a,b);
    if(!ok)return Response.json({error:'Wrong password.'},{status:401});
    return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Set-Cookie':makeCookie()}});
  }catch(e){return Response.json({error:'Login failed.'},{status:400})}
}
export async function DELETE(){
  return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Set-Cookie':COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'}})
}
// Bookwyrm workshop server v2 — paste this entire file into the Worker editor.
// Required binding: WORKSHOP_BUCKET (R2).
// Required secret: WORKSHOP_UPLOAD_TOKEN. Never put that secret in this file.
const PREFIX = '/workshop/';
const TYPES = {html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',json:'application/json; charset=utf-8',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',mp4:'video/mp4',webm:'video/webm',woff2:'font/woff2'};
const MAX = 25 * 1024 * 1024;
const HOURS = 8;
const baseHeaders = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
function text(message,status=200) { return new Response(message,{status,headers:baseHeaders}); }
function json(value,status=200) { return Response.json(value,{status,headers:baseHeaders}); }
async function hash(value) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function equalSecret(a,b) {
  if (!a || !b) return false;
  const ah=await hash(a), bh=await hash(b);
  let difference=0;
  for(let i=0;i<ah.length;i++) difference |= ah.charCodeAt(i)^bh.charCodeAt(i);
  return difference===0;
}
async function boundedBody(request,limit) {
  if(Number(request.headers.get('Content-Length'))>limit) throw new Error('too-large');
  if(!request.body) return new Uint8Array();
  const reader=request.body.getReader(), chunks=[];
  let size=0;
  while(true) {
    const {done,value}=await reader.read(); if(done) break;
    size+=value.byteLength;
    if(size>limit) {await reader.cancel(); throw new Error('too-large');}
    chunks.push(value);
  }
  const result=new Uint8Array(size); let offset=0;
  for(const chunk of chunks) {result.set(chunk,offset);offset+=chunk.byteLength;}
  return result;
}
async function authorization(request,env) {
  if(!env.WORKSHOP_UPLOAD_TOKEN) return false;
  const header=request.headers.get('Authorization') || '';
  if(!header.startsWith('Bearer ')) return false;
  const token=header.slice(7);
  if(token.length>512) return false;
  if(await equalSecret(token,env.WORKSHOP_UPLOAD_TOKEN)) return {owner:true};
  if(!/^bws_[a-f0-9]{64}$/.test(token)) return false;
  const object=await env.WORKSHOP_BUCKET.get('_auth/sessions/'+await hash(token));
  if(!object) return false;
  const session=await object.json();
  if(session.expiresAt<=Date.now() || session.ownerHash!==await hash(env.WORKSHOP_UPLOAD_TOKEN)) return false;
  return {owner:false,expiresAt:session.expiresAt};
}
function connectionPage(ticket) {
  const valid=/^[a-f0-9]{64}$/.test(ticket);
  if(!valid) return text('Open the connection link supplied in your chat.',400);
  const nonce=crypto.randomUUID();
  const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect workshop publishing</title>
<style nonce="${nonce}">body{font:17px system-ui;max-width:600px;margin:64px auto;padding:24px;background:#f4f5fa;color:#202337}h1{font-size:28px}input,button{box-sizing:border-box;width:100%;padding:14px;margin:12px 0;font:inherit}button{background:#353e8d;color:white;border:0;border-radius:8px;cursor:pointer}code{overflow-wrap:anywhere}#status{white-space:pre-wrap}</style>
<h1>Connect workshop publishing</h1><p>Authorize the session from your chat to upload and replace workshop files for <strong>${HOURS} hours</strong>.</p><p>Only approve a link you just received from your own assistant. This does not grant access to QuestAcademy's database or Cloudflare settings.</p><p>Session fingerprint: <code>${ticket.slice(0,16)}</code></p>
<form id="connect"><label for="secret">Workshop upload secret</label><input id="secret" type="password" autocomplete="off" required placeholder="WORKSHOP_UPLOAD_TOKEN value"><button id="approve">Authorize this session</button></form><p id="status" role="status"></p><p>The secret is sent only to this website over HTTPS. This page does not save it in browser storage or send it to chat.</p>
<script nonce="${nonce}">document.getElementById('connect').addEventListener('submit',async event=>{event.preventDefault();const field=document.getElementById('secret'),button=document.getElementById('approve'),status=document.getElementById('status');button.disabled=true;status.textContent='Connecting…';let secret=field.value;field.value='';try{const response=await fetch('/workshop/_connect',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+secret},body:JSON.stringify({ticket:'${ticket}'})});secret='';const data=await response.json();if(!response.ok)throw new Error(data.error||'Connection failed');status.textContent='Connected until '+new Date(data.expiresAt).toLocaleString()+'. Return to your chat and say “connected”.';document.getElementById('connect').hidden=true;}catch(error){secret='';status.textContent=error.message;button.disabled=false;}});</script></html>`;
  return new Response(html,{headers:{...baseHeaders,'Content-Type':'text/html; charset=utf-8','X-Frame-Options':'DENY','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`}});
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url),path=url.pathname;
    if(path==='/' || path==='/workshop') return Response.redirect(url.origin+PREFIX,302);
    if(!path.startsWith(PREFIX)) return text('Not found',404);
    if(!env.WORKSHOP_BUCKET) return text('WORKSHOP_BUCKET binding is missing.',503);
    try {
      if(path===PREFIX+'_health') return json({service:'Bookwyrm animation workshop',version:2,bucketBound:true,uploadsConfigured:Boolean(env.WORKSHOP_UPLOAD_TOKEN),sessionConnection:true});
      if(path===PREFIX+'_connect') {
        if(request.method==='GET') return connectionPage(url.searchParams.get('ticket')||'');
        if(request.method!=='POST') return text('Method not allowed',405);
        if(request.headers.get('Origin')!==url.origin) return json({error:'Open the connection page on this website.'},403);
        if(!env.WORKSHOP_UPLOAD_TOKEN) return json({error:'Upload secret is not configured.'},503);
        const provided=request.headers.get('Authorization')||'';
        if(provided.length>520 || !provided.startsWith('Bearer ') || !await equalSecret(provided.slice(7),env.WORKSHOP_UPLOAD_TOKEN)) return json({error:'Upload secret was not accepted.'},401);
        let data;
        try {data=JSON.parse(new TextDecoder().decode(await boundedBody(request,1024)));} catch {return json({error:'Invalid connection request.'},400);}
        if(!/^[a-f0-9]{64}$/.test(data?.ticket||'')) return json({error:'Invalid session fingerprint.'},400);
        const expiresAt=Date.now()+HOURS*3600000;
        await env.WORKSHOP_BUCKET.put('_auth/sessions/'+data.ticket,JSON.stringify({expiresAt,ownerHash:await hash(env.WORKSHOP_UPLOAD_TOKEN)}),{httpMetadata:{contentType:'application/json'}});
        return json({connected:true,expiresAt});
      }
      if(path===PREFIX+'_session') {
        if(request.method!=='GET') return text('Method not allowed',405);
        const auth=await authorization(request,env);
        return auth ? json({authorized:true,...auth}) : json({authorized:false},401);
      }
      const upload=path.startsWith(PREFIX+'_upload/');
      let file;
      try {file=decodeURIComponent(path.slice(upload?(PREFIX+'_upload/').length:PREFIX.length));} catch {return text('Invalid file path',400);}
      if(!file && !upload) file='index.html';
      if(!file || file.length>500 || !/^[a-zA-Z0-9_./-]+$/.test(file) || file.split('/').some(p=>!p||p==='.'||p==='..'||p.startsWith('_'))) return text('Invalid file path',400);
      const type=TYPES[file.split('.').pop().toLowerCase()];
      if(!type) return text('Unsupported file type',415);
      const key='workshop/'+file;
      if(upload) {
        if(request.method!=='PUT') return text('Use PUT to upload files.',405);
        if(!env.WORKSHOP_UPLOAD_TOKEN) return text('Upload secret has not been configured.',503);
        if(!await authorization(request,env)) return text('Unauthorized',401);
        let body;
        try {body=await boundedBody(request,MAX);} catch {return text('Maximum file size is 25 MiB.',413);}
        await env.WORKSHOP_BUCKET.put(key,body,{httpMetadata:{contentType:type,cacheControl:'no-store'}});
        return json({uploaded:file,bytes:body.byteLength});
      }
      if(request.method!=='GET' && request.method!=='HEAD') return text('Method not allowed',405);
      const object=request.method==='HEAD' ? await env.WORKSHOP_BUCKET.head(key) : await env.WORKSHOP_BUCKET.get(key);
      if(!object) return text(file==='index.html'?'Workshop server is running. Workshop files have not been uploaded yet.':'File not found',404);
      return new Response(request.method==='HEAD'?null:object.body,{headers:{...baseHeaders,'Content-Type':type,'Content-Length':String(object.size),ETag:object.httpEtag}});
    } catch {
      return text('Workshop storage request failed. Retry or check the R2 binding.',503);
    }
  }
};

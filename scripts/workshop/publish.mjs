import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';
const origin='https://bookwyrminteractive.studio',sessionFile='.workshop-upload-session.json';
const hash=data=>createHash('sha256').update(data).digest('hex');
const command=process.argv[2]||'status';
if(command==='connect') {
 if(!existsSync(sessionFile))writeFileSync(sessionFile,JSON.stringify({token:'bws_'+randomBytes(32).toString('hex')})+'\n',{mode:0o600,flag:'wx'});
 const {token}=JSON.parse(readFileSync(sessionFile,'utf8'));
 console.log(`${origin}/workshop/_connect?ticket=${hash(token)}`);
} else {
 if(!existsSync(sessionFile))throw new Error('Run connect first');
 const {token}=JSON.parse(readFileSync(sessionFile,'utf8'));
 const headers={Authorization:`Bearer ${token}`};
 const response=await fetch(`${origin}/workshop/_session`,{headers});
 const authorization=await response.json();
 if(!response.ok||!authorization.authorized)throw new Error('Workshop connection is not authorized or has expired. Open the connect link.');
 console.log(`Connected until ${new Date(authorization.expiresAt).toISOString()}`);
 if(command==='upload') {
  const preview='previews/static-starters-01.html',entryId='static-starters-01';
  const bytes=readFileSync(`workshop/site/${preview}`);
  const catalogResponse=await fetch(`${origin}/workshop/catalog.js`,{cache:'no-store'});
  if(!catalogResponse.ok)throw new Error('Unable to read workshop catalog');
  const before=await catalogResponse.text();
  const parse=text=>JSON.parse(text.replace(/^\s*window\.WORKSHOP_CATALOG\s*=\s*/,'').trim().replace(/;$/,''));
  const current=parse(before),local=parse(readFileSync('workshop/site/catalog.js','utf8'));
  const entry=local.entries.find(e=>e.id===entryId);if(!entry)throw new Error('Review entry missing');
  const existing=await fetch(`${origin}/workshop/${preview}`,{cache:'no-store'});
  if(existing.ok) {if(hash(Buffer.from(await existing.arrayBuffer()))!==hash(bytes))throw new Error('That preview version already exists with different bytes. Create a new review version.');}
  else if(existing.status!==404)throw new Error('Unable to inspect existing preview');
  async function put(path,body,type) {
   const result=await fetch(`${origin}/workshop/_upload/${path}`,{method:'PUT',headers:{...headers,'Content-Type':type},body});
   if(!result.ok)throw new Error(`Upload failed (${result.status}) for ${path}`);
  }
  await put(preview,bytes,'text/html; charset=utf-8');
  const verify=await fetch(`${origin}/workshop/${preview}?verify=${hash(bytes).slice(0,12)}`,{cache:'no-store'});
  if(!verify.ok||hash(Buffer.from(await verify.arrayBuffer()))!==hash(bytes))throw new Error('Public preview verification failed; catalog was not changed');
  const latest=await fetch(`${origin}/workshop/catalog.js`,{cache:'no-store'});
  if(!latest.ok||await latest.text()!==before)throw new Error('Catalog changed during upload; rerun to merge safely');
  const catalog={...current,revision:local.revision,updated:local.updated,entries:[entry,...current.entries.filter(e=>e.id!==entryId)]};
  const catalogBytes='window.WORKSHOP_CATALOG='+JSON.stringify(catalog)+';\n';
  await put('catalog.js',catalogBytes,'application/javascript; charset=utf-8');
  const published=await fetch(`${origin}/workshop/catalog.js?verify=${Date.now()}`,{cache:'no-store'});
  if(!published.ok||await published.text()!==catalogBytes)throw new Error('Catalog public verification failed');
  console.log(`${origin}/workshop/?asset=${entryId}`);
 } else if(command!=='status')throw new Error('Use connect, status or upload');
}

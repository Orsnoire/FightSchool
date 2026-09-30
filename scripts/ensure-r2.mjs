const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw new Error('Cloudflare deployment credentials are required');
const name='questacademy-objects';const base=`https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets`;
const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
const existing=await fetch(`${base}/${name}`,{headers});
if(existing.ok){console.log('QuestAcademy image bucket is ready');process.exit(0);}
if(existing.status!==404){const body=await existing.json();throw new Error(`Unable to inspect R2 bucket (${existing.status}): ${body.errors?.map(e=>e.message).join('; ')||'Check R2 permissions on the deployment token'}`);}
const created=await fetch(base,{method:'POST',headers,body:JSON.stringify({name})});
if(!created.ok){const body=await created.json();throw new Error(`Unable to create R2 bucket (${created.status}): ${body.errors?.map(e=>e.message).join('; ')||'Check R2 account availability and deployment token permissions'}`);}
console.log('QuestAcademy image bucket created');

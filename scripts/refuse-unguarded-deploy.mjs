// Once clock-preserving maintenance exists, ambient Wrangler vars must not erase its history.
const id=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${id}/workers/scripts/questacademy-staging/settings`,
  {headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(30000)});
const result=await response.json();
if(!response.ok||!result.success||result.result.bindings.some(b=>b.name==='RELEASE_WINDOWS'))
  throw Error('Use the controlled release workflow; this deployment cannot preserve maintenance history.');

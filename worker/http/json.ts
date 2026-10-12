/** Limits apply to received UTF-8 bytes, including chunked bodies with no length. */
export class BodyError extends SyntaxError {
  constructor(public readonly status:400|413, message:string) { super(message); }
}
export async function readJson(request:Request, limit=65_536, allowEmpty=false):Promise<unknown> {
  const declared=request.headers.get('content-length');
  if(declared!==null && Number(declared)>limit) throw new BodyError(413,'Request body too large');
  const reader=request.body?.getReader();
  if(!reader) {if(allowEmpty)return {};throw new BodyError(400,'Invalid JSON');}
  const decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,raw='';
  try {
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      bytes+=value.byteLength;
      if(bytes>limit){void reader.cancel().catch(()=>{});throw new BodyError(413,'Request body too large');}
      raw+=decoder.decode(value,{stream:true});
    }
    raw+=decoder.decode();
    if(!raw&&allowEmpty)return {};
    return JSON.parse(raw);
  } catch(error) {
    if(error instanceof BodyError)throw error;
    throw new BodyError(400,'Invalid JSON');
  } finally {reader.releaseLock();}
}
export function bodyErrorResponse(error:unknown):Response|null {
  return error instanceof BodyError?Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}}):null;
}

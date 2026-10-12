export interface Diagnostic {
  event:'http_request'|'combat_command'|'combat_checkpoint'|'combat_evidence'|'combat_results'|'socket_send';
  requestId?:string;
  roomId?:string;
  revision?:number;
  status?:number;
  durationMs?:number;
  queueMs?:number;
  outcome:'ok'|'rejected'|'failed'|'retry';
}
/** Deliberate allowlist: never accept bodies, headers, error objects or SQL. */
export function diagnostic(value:Diagnostic):void {
  const safe:Record<string,unknown>={event:value.event,outcome:value.outcome};
  for(const key of ['requestId','roomId'] as const) if(value[key]&&/^[A-Za-z0-9_-]{1,100}$/.test(value[key]!))safe[key]=value[key];
  for(const key of ['revision','status','durationMs','queueMs'] as const) if(Number.isFinite(value[key]))safe[key]=Math.max(0,Math.round(value[key]!));
  console.log(JSON.stringify(safe));
}

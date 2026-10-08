import assert from 'node:assert/strict';
import {test} from 'node:test';
import {QueryClient, QueryObserver} from '@tanstack/react-query';
import {saveStudentLoadout} from '../../client/src/lib/studentLoadout.ts';

const studentKey=['/api/student/student'];
const levelsKey=['/api/student/student/job-levels'];
const equipmentKey=['equipment-items',{ids:['same-item']}];
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

test('authoritative class, gear and ability saves refresh active and inactive caches, even with unchanged IDs/counts',async()=>{
 const originalFetch=globalThis.fetch;
 const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false,gcTime:Infinity}}});
 let current:any={id:'student',characterClass:'wizard',weapon:'same-item',crossClassAbility1:null};
 let level=1,stat=1;
 const snapshots:any[]=[];
 const studentObserver=new QueryObserver(client,{queryKey:studentKey,queryFn:async()=>current});
 const levelObserver=new QueryObserver(client,{queryKey:levelsKey,queryFn:async()=>[{jobClass:current.characterClass,level}]});
 const equipmentObserver=new QueryObserver(client,{queryKey:equipmentKey,queryFn:async()=>[{id:'same-item',stats:{mat:stat}}]});
 client.setQueryData(studentKey,current);
 client.setQueryData(levelsKey,[{jobClass:'wizard',level:1}]);
 client.setQueryData(equipmentKey,[{id:'same-item',stats:{mat:1}}]);
 client.setQueryData(['equipment-items',{ids:['inactive-inventory']}],[]);
 const stops=[studentObserver.subscribe(r=>snapshots.push(r.data)),levelObserver.subscribe(()=>{}),equipmentObserver.subscribe(()=>{})];
 globalThis.fetch=async(_url,options)=>{
  current={...current,...JSON.parse(options!.body as string)};level=4;stat=3;
  return Response.json(current);
 };
 try {
  await saveStudentLoadout(client,'student','character',{characterClass:'priest',gender:'A'});
  assert.equal(client.getQueryData<any>(studentKey).characterClass,'priest');
  assert.deepEqual(client.getQueryData(levelsKey),[{jobClass:'priest',level:4}]);
  assert.deepEqual(client.getQueryData(equipmentKey),[{id:'same-item',stats:{mat:3}}]);
  assert.equal(client.getQueryState(['equipment-items',{ids:['inactive-inventory']}])?.isInvalidated,true);
  await saveStudentLoadout(client,'student','equipment',{crossClassAbility1:'mend',arms:'basic_cloth_arms'});
  assert.equal(snapshots.at(-1).crossClassAbility1,'mend');
  assert.equal(snapshots.at(-1).arms,'basic_cloth_arms');
 }finally{stops.forEach(stop=>stop());client.clear();globalThis.fetch=originalFetch;}
});

test('pending old reads cannot overwrite saves, failed edits recover, and rapid edits serialize',async()=>{
 const originalFetch=globalThis.fetch;
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
 let resolveOld!:(value:any)=>void;
 const oldRead=client.fetchQuery({queryKey:studentKey,queryFn:()=>new Promise(resolve=>{resolveOld=resolve;})}).catch(()=>{});
 const calls:any[]=[];
 let finishFirst!:(value:Response)=>void;
 globalThis.fetch=async(_url,options)=>{
  const change=JSON.parse(options!.body as string);calls.push(change);
  if(calls.length===1)return new Promise(resolve=>{finishFirst=resolve;});
  if(calls.length===3)return Response.json({error:'Wrong slot'},{status:400});
  return Response.json({id:'student',...change});
 };
 try{
  const first=saveStudentLoadout(client,'student','equipment',{arms:'first'});
  const second=saveStudentLoadout(client,'student','equipment',{arms:'second'});
  await tick();assert.equal(calls.length,1);
  finishFirst(Response.json({id:'student',arms:'first'}));
  await Promise.all([first,second]);
  resolveOld({id:'student',arms:'obsolete'});await oldRead;
  assert.equal(client.getQueryData<any>(studentKey).arms,'second');
  await assert.rejects(saveStudentLoadout(client,'student','equipment',{arms:'invalid'}),/400/);
  assert.equal(client.getQueryData<any>(studentKey).arms,'second','failed writes are never optimistic');
  await saveStudentLoadout(client,'student','equipment',{arms:'retry'});
  assert.equal(client.getQueryData<any>(studentKey).arms,'retry');
 }finally{client.clear();globalThis.fetch=originalFetch;}
});

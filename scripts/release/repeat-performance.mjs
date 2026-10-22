import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { acceptanceTarget } from '../../tests/staging/fixture-run.mjs';
import { observeRelease } from './gates.mjs';
import { summarizePerformance } from './performance-report.mjs';

const target=acceptanceTarget(process.env);
assert.equal(target.mode,'isolated','Repeated performance tests cannot target the classroom site');
const repetitions=Number(process.env.ACCEPTANCE_REPETITIONS || 5);
assert.ok(Number.isInteger(repetitions) && repetitions>=3 && repetitions<=10);
assert.ok(process.env.ISOLATED_TARGET_FILE && process.env.ISOLATED_DATABASE_URL && process.env.PRODUCTION_DATABASE_HOSTS,'Private target and verified database endpoint inventory required');
const directory=resolve('artifacts/acceptance',`performance-${randomUUID()}`);
mkdirSync(directory,{recursive:true,mode:0o700});
const samples=[], report={schemaVersion:1,startedAt:new Date().toISOString(),node:process.version,
  status:'running',profile:'four starter jobs at level four, distinct avatars, guild quests, 100 prior results per learner, scaled goblins, class actions, reconnect and completion',
  scope:'Provider HTTP/WebSocket timings from this client. No browser rendering, provider CPU or database query-count claim.',samples};
const save=()=>writeFileSync(join(directory,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
save();
try {
  for(const players of [30,60]) for(let repetition=1;repetition<=repetitions;repetition++) {
    const fixtureDirectory=join(directory,`${players}-${repetition}`);
    console.log(`Representative isolated classroom: ${players} players, repetition ${repetition}/${repetitions}`);
    const child=spawnSync(process.execPath,['--import','tsx','tests/staging/operational-acceptance.mjs'],{
      stdio:'inherit',timeout:15*60*1000,env:{...process.env,ACCEPTANCE_PROFILE:'representative',ACCEPTANCE_PLAYERS:String(players),FIXTURE_DIRECTORY:fixtureDirectory},
    });
    // Partial journals survive both an assertion failure and process interruption.
    const files=readdirSync(fixtureDirectory).filter(f=>f.endsWith('.json'));
    assert.equal(files.length,1,'Exactly one operational journal must belong to each repetition');
    const path=join(fixtureDirectory,files[0]),manifest=JSON.parse(readFileSync(path,'utf8'));
    samples.push({players,repetition,path,manifest}); save();
    assert.equal(child.error,undefined,'Acceptance process failed or exceeded its 15-minute bound');
    assert.equal(child.status,0,'A functional failure stops further synthetic load');
    await observeRelease({origin:target.origin,sha:process.env.RELEASE_SHA,workerVersion:process.env.WORKER_VERSION});
  }
  Object.assign(report,summarizePerformance(samples,repetitions));
  report.status=report.proposedTargetMet?'measured':'target-not-met';
  if(!report.proposedTargetMet) process.exitCode=1;
} catch(error) {report.status='incomplete';process.exitCode=1;console.error(error.message);}
finally {report.finishedAt=new Date().toISOString();save();console.log(`Performance evidence: ${join(directory,'report.json')}`);}

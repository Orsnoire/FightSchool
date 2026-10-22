import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { acceptanceTarget } from '../../tests/staging/fixture-run.mjs';
const target = acceptanceTarget(process.env);
assert.equal(target.mode, 'isolated', 'Repeated load is forbidden on classroom resources');
const repetitions = Number(process.env.ACCEPTANCE_REPETITIONS || 5);
assert.ok(Number.isInteger(repetitions) && repetitions >= 3 && repetitions <= 10);
for (const players of [30,60]) for (let repetition=1;repetition<=repetitions;repetition++) {
  console.log(`Isolated functional burst ${players} players, repetition ${repetition}/${repetitions}`);
  execFileSync(process.execPath, ['tests/staging/operational-acceptance.mjs'], {
    stdio:'inherit', env:{...process.env,ACCEPTANCE_PLAYERS:String(players)},
  });
}
console.log('Retain every per-run manifest and compare answerAckMs. This functional fixture does not include seeded guild history or measure browser render/GPU costs.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';
import { PALETTES, STARTER_JOBS } from '../../shared/avatar/appearance.ts';
import { validateIsolation } from '../../scripts/release/fixture-cleanup.mjs';
import { seedHistory } from '../../scripts/release/seed-history.mjs';

export function classroomCharacter(index) {
  assert.ok(Number.isInteger(index) && index >= 0 && index < 61);
  return { job: STARTER_JOBS[index % 4], appearance: {
    modelId: index % 8 < 4 ? 'human-male-v1' : 'human-female-v1',
    hairColorId: PALETTES.hair[index % PALETTES.hair.length].id,
    eyeColorId: PALETTES.eyes[Math.floor(index / PALETTES.hair.length) % PALETTES.eyes.length].id,
    skinColorId: PALETTES.skin[Math.floor(index / (PALETTES.hair.length * PALETTES.eyes.length)) % PALETTES.skin.length].id,
  } };
}

export async function prepareRepresentative(fixtures, env = process.env) {
  assert.equal(env.ACCEPTANCE_PROFILE, 'representative');
  assert.ok(env.ISOLATED_TARGET_FILE, 'Representative runs require the independently verified isolated target file');
  const target = JSON.parse(readFileSync(env.ISOLATED_TARGET_FILE, 'utf8'));
  const productionHosts = JSON.parse(env.PRODUCTION_DATABASE_HOSTS || 'null');
  assert.ok(Array.isArray(productionHosts) && productionHosts.length > 0);
  for (const host of productionHosts) validateIsolation(target, fixtures.manifest, env.ISOLATED_DATABASE_URL, host);
  neonConfig.webSocketConstructor = WebSocket;
  const pool = new Pool({ connectionString: env.ISOLATED_DATABASE_URL, connectionTimeoutMillis:30_000 });
  let client;
  try { client = await pool.connect(); await client.query('SELECT 1'); }
  catch (error) { client?.release(); await pool.end(); throw error; }
  return {
    async seed({ teacher, students, fight, guild }) {
      return seedHistory({ query:(sql,params) => client.query(sql,params), fixtures, target,
        databaseUrl:env.ISOLATED_DATABASE_URL, productionHosts, teacherId:teacher.payload.id,
        guildId:guild.payload.id, fightId:fight.id, studentIds:students.map(s => s.payload.id) });
    },
    async close() { client.release(); await pool.end(); },
  };
}

export async function exerciseClassActions(players, students, state, fixtures) {
  const enemies = state.enemies.filter(e => e.health > 0), choices=[];
  assert.ok(enemies.length);
  const times = await Promise.all(players.map((player,i) => {
    const id = students[i].payload.id, job = classroomCharacter(i).job;
    assert.equal(state.players[id].characterClass, job);
    const ability = {warrior:'attack',wizard:'fireball',scout:state.players[id].comboPoints>=1?'aim':'attack',herbalist:'healing_potion'}[job];
    choices.push(ability);
    return player.ack('action', {round:state.round,ability,targetId:job==='herbalist'?id:enemies[i%enemies.length].id,ready:true});
  }));
  if(state.round>1) assert.ok(choices.includes('aim'),'The measured round must exercise an earned Scout ability');
  fixtures.recordMetric(state.round===1?'openingActions':'classActions', times);
}

export async function exerciseClassSupport(players, students, fixtures, round) {
  const times = await Promise.all(players.map((player,i) => classroomCharacter(i).job === 'warrior'
    ? player.ack('action', {round,ability:'warrior_block',targetId:students[(i+1)%students.length].payload.id,ready:true})
    : player.ack('ready', {round})));
  fixtures.recordMetric(round===1?'openingSupport':'classSupport', times);
}

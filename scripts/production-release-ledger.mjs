import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalCampaignLedger } from './campaign-preview-migration-bridge.mjs';

// Explicit historical checkpoints: new migrations never silently expand a release.
export function productionReleaseLedger(stage) {
  if (stage === 'before') return canonicalCampaignLedger.slice(0, 20);
  if (stage === 'after') return canonicalCampaignLedger.slice(0, 25);
  if (!['question-bank','math-authoring'].includes(stage)) throw Error('Unknown production schema stage');
  const root = new URL('../migrations/cloudflare/', import.meta.url);
  const entries = JSON.parse(readFileSync(new URL('meta/_journal.json', root), 'utf8')).entries;
  const selected = ['0025_campaign_question_bank', ...(stage === 'math-authoring' ? ['0026_math_templates'] : [])];
  return [...canonicalCampaignLedger, ...selected.map((tag, offset) => {
    const entry = entries[25 + offset];
    if (entry?.idx !== 25 + offset || entry.tag !== tag) throw Error('Production release migration changed');
    const sql = readFileSync(new URL(`${tag}.sql`, root), 'utf8');
    return { hash: createHash('sha256').update(sql).digest('hex'), created_at: entry.when };
  })];
}

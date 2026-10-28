import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonicalCampaignLedger } from './campaign-preview-migration-bridge.mjs';

// Explicit historical checkpoints: new migrations never silently expand a release.
export function productionReleaseLedger(stage) {
  if (stage === 'before') return canonicalCampaignLedger.slice(0, 20);
  if (stage === 'after') return canonicalCampaignLedger.slice(0, 25);
  if (stage !== 'question-bank') throw Error('Unknown production schema stage');
  const root = new URL('../migrations/cloudflare/', import.meta.url);
  const entry = JSON.parse(readFileSync(new URL('meta/_journal.json', root), 'utf8')).entries[25];
  if (entry?.idx !== 25 || entry.tag !== '0025_campaign_question_bank') throw Error('Production question-bank migration changed');
  const sql = readFileSync(new URL(`${entry.tag}.sql`, root), 'utf8');
  return [...canonicalCampaignLedger, { hash: createHash('sha256').update(sql).digest('hex'), created_at: entry.when }];
}

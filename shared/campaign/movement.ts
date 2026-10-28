import { dungeonAccessible, pointKey, walkable, type CampaignProgress, type CampaignGate, type CampaignLayout } from './model';

export const MAX_CAMPAIGN_PATH = 8;
export type CampaignStep = { dx: number; dy: number };
type World = { id: string; layout: CampaignLayout; gates: CampaignGate[] };

/** Shared for local feedback and server validation. Only server commits are authoritative. */
export function campaignStep(world: World, progress: CampaignProgress, step: CampaignStep) {
  if (progress.activeSessionId) throw new Error('Finish or leave the active encounter first.');
  if (!Number.isInteger(step.dx) || !Number.isInteger(step.dy) || Math.abs(step.dx) + Math.abs(step.dy) !== 1)
    throw new Error('Move one tile at a time.');
  const position = { x: progress.position.x + step.dx, y: progress.position.y + step.dy };
  if (!walkable(world.layout[progress.zone], position)) throw new Error('That route is blocked.');
  const inTown = progress.zone === 'overworld' && position.x <= 7 && position.y >= 3 && position.y <= 9;
  if (progress.health <= 0 && !inTown) throw new Error('Rest at the inn before adventuring.');
  const next = { ...progress, position, steps: progress.steps + 1,
    explored: [...new Set([...progress.explored, pointKey(progress.zone, position)])] };
  const roll = Array.from(`${world.id}:${next.steps}`).reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  return { progress: next, encounter: !inTown && next.health > 0 && dungeonAccessible(world.gates, next) && roll % 7 === 0 };
}

/** Stop at the first encounter; later steps never evade it or create a second fight. */
export function campaignPath(world: World, progress: CampaignProgress, steps: CampaignStep[]) {
  if (!steps.length || steps.length > MAX_CAMPAIGN_PATH) throw new Error('Choose between one and eight steps.');
  let result = { progress, encounter: false };
  for (const step of steps) {
    result = campaignStep(world, result.progress, step);
    if (result.encounter) break;
  }
  return result;
}

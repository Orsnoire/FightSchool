import { walkable, type CampaignGate, type CampaignLayout, type CampaignMap, type CampaignPoint } from './model';

/** Small, deterministic first-theme generator. Save its output, not just its seed. */
export function generateCampaignLayout(seed: string, gates: CampaignGate[]): CampaignLayout {
  let state = 2166136261;
  for (const c of seed) state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  const overworld: CampaignMap = { width: 21, height: 13, tiles: Array(273).fill('grass'), spawn: { x: 3, y: 6 } };
  const dungeon: CampaignMap = { width: 19, height: 13, tiles: Array(247).fill('wall'), spawn: { x: 2, y: 6 } };
  const put = (map: CampaignMap, x: number, y: number, tile: CampaignMap['tiles'][number]) => { map.tiles[y * map.width + x] = tile; };
  for (let y = 0; y < overworld.height; y++) for (let x = 0; x < overworld.width; x++) {
    if (x === 0 || y === 0 || x === 20 || y === 12) put(overworld, x, y, 'mountain');
    else if (random() < .10) put(overworld, x, y, random() < .5 ? 'water' : 'mountain');
  }
  // The town and primary route are always connected. Decoration never cuts them.
  for (let y = 3; y <= 9; y++) for (let x = 1; x <= 7; x++) put(overworld, x, y, 'path');
  for (let x = 3; x <= 18; x++) put(overworld, x, 6, 'path');
  for (let x = 9; x <= 16; x++) { put(overworld, x, 4, 'path'); put(overworld, x, 8, 'path'); }
  for (let y = 4; y <= 8; y++) { put(overworld, 9, y, 'path'); put(overworld, 16, y, 'path'); }
  // Connected irregular chambers with a guaranteed entrance-to-objective route.
  for (let x = 2; x <= 16; x++) {
    put(dungeon, x, 6, 'floor');
    const top = 3 + Math.floor(random() * 3), bottom = 7 + Math.floor(random() * 3);
    for (let y = top; y <= bottom; y++) put(dungeon, x, y, 'floor');
  }
  const layout: CampaignLayout = {
    version: 1, seed, overworld, dungeon, entrance: { x: 18, y: 6 }, dungeonExit: { x: 2, y: 6 }, objective: { x: 16, y: 6 },
    npcs: [
      { id: 'inn', name: 'Hearthlight Inn', service: 'inn', x: 2, y: 4 },
      { id: 'weapons', name: 'Wayfarer Weapons', service: 'weapons', x: 5, y: 4 },
      { id: 'items', name: 'Hearthlight Item Shop', service: 'items', x: 6, y: 6 },
      { id: 'armor', name: 'Ironleaf Armor', service: 'armor', x: 5, y: 8 },
      ...gates.map((gate, index) => ({ id: `quest:${gate.id}`, name: `${gate.name} Keeper`, service: 'quest' as const, gateId: gate.id, x: 2 + index * 2, y: 8 })),
    ],
  };
  validateCampaignLayout(layout);
  return layout;
}

export function validateCampaignLayout(layout: CampaignLayout) {
  for (const zone of ['overworld', 'dungeon'] as const) {
    const map = layout[zone], visited = new Set<string>();
    if (map.tiles.length !== map.width * map.height || !walkable(map, map.spawn)) throw new Error('Invalid campaign map');
    const queue: CampaignPoint[] = [map.spawn];
    while (queue.length) {
      const p = queue.shift()!, key = `${p.x}:${p.y}`;
      if (visited.has(key) || !walkable(map, p)) continue;
      visited.add(key);
      queue.push({ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 });
    }
    const required = zone === 'overworld' ? [layout.entrance, ...layout.npcs] : [layout.dungeonExit, layout.objective];
    if (required.some(p => !visited.has(`${p.x}:${p.y}`))) throw new Error('Unreachable campaign destination');
  }
}

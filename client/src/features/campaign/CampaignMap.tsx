import { useEffect, useRef, useState } from 'react';
import { near, samePoint, walkable, type CampaignMap as MapData, type CampaignView } from '@shared/campaign/model';
import { EquippedPlayerAvatar } from '@/components/EquippedPlayerAvatar';
import { BORDER_IMAGES, neighbourMask } from './autotiles';
import terrain from '@/assets/campaign-v1/terrain.webp';
import borders from '@/assets/campaign-v1/borders.webp';
import landmarks from '@/assets/campaign-v1/landmarks.webp';

export const MAP_TILE_SIZE = 48;
/** Interior blocked mountain cells become forest visually. The saved logical
 * grid and traversal contract stay intact; mountains frame the overworld. */
export function terrainKind(map: MapData, x: number, y: number): string {
  const tile = map.tiles[y * map.width + x];
  return tile === 'mountain' && x > 0 && y > 0 && x < map.width - 1 && y < map.height - 1 ? 'forest' : tile;
}
const quadrants: Record<string, [number, number]> = { grass: [0,0], path: [1,0], water: [0,1], floor: [1,1], mountain: [0,0], wall: [1,0], forest: [0,1] };
type TextureRegion = { x: number; y: number; size: number };
function texturePosition(kind: string, region: TextureRegion) {
  const [column,row] = quadrants[kind];
  return { backgroundSize: `${region.size*2}px ${region.size*2}px`, backgroundPosition: `${-column*region.size-region.x}px ${-row*region.size-region.y}px` };
}
export function TerrainTile({ kind, mask = 255, region = {x:0,y:0,size:768} }: { kind: string; mask?: number; region?: TextureRegion }) {
  const blocked = ['mountain', 'wall', 'forest'].includes(kind);
  return <span aria-hidden="true" className="terrain-frame"><span className={`terrain-art terrain-${kind}${blocked ? ' terrain-border' : ''}`}>
    <span style={{ backgroundImage: `url(${blocked ? borders : terrain})`, ...texturePosition(kind, region),
      ...(blocked ? { maskImage: BORDER_IMAGES[mask], WebkitMaskImage: BORDER_IMAGES[mask] } : {}) }} />
  </span></span>;
}
const landmarkIndex: Record<string, number> = { inn: 0, weapons: 1, armor: 2, items: 3, cave: 5, stairs: 6, quest: 7, guardian: 7 };
export function LandmarkArt({ kind }: { kind: string }) {
  const i = landmarkIndex[kind];
  return <span aria-hidden="true" className={`landmark-art landmark-${kind}`} style={{ backgroundImage: `url(${landmarks})`, backgroundPosition: `${(i % 4) * 100 / 3}% ${i < 4 ? 0 : 100}%` }} />;
}
export function CampaignMap({ view, disabled, move }: { view: CampaignView; disabled: boolean; move: (dx: number, dy: number) => void }) {
  const { progress: p, layout } = view, map = layout[p.zone], town = p.zone === 'overworld';
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [overview, setOverview] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  const width = map.width * MAP_TILE_SIZE, height = map.height * MAP_TILE_SIZE;
  const scale = overview && size.width ? Math.min(size.width / width, size.height / height) : 1;
  const offset = (available: number, world: number, player: number) => world <= available ? (available - world) / 2 : Math.max(available - world, Math.min(0, available / 2 - (player + .5) * MAP_TILE_SIZE));
  const x = overview ? (size.width - width * scale) / 2 : offset(size.width, width, p.position.x);
  const y = overview ? (size.height - height * scale) / 2 : offset(size.height, height, p.position.y);
  return <>
    <div className="campaign-map-toolbar"><span>{town ? 'Hearthlight & the wilds' : view.dungeonName}</span><button type="button" aria-pressed={overview} onClick={() => setOverview(value => !value)}>{overview ? 'Follow adventurer' : 'World overview'}</button></div>
    <div ref={viewport} style={{ maxWidth: width, marginInline: 'auto' }} className={`campaign-map-viewport ${town ? '' : 'campaign-cave'}`}>
      <div className="campaign-world" role="group" aria-label={town ? 'Overworld map' : 'Cave map'} style={{ width, height, gridTemplateColumns: `repeat(${map.width}, ${MAP_TILE_SIZE}px)`, transform: `translate(${x}px,${y}px) scale(${scale})` }}>
        {map.tiles.map((_, index) => {
          const pos = { x: index % map.width, y: Math.floor(index / map.width) }, here = samePoint(pos, p.position);
          const kind = terrainKind(map, pos.x, pos.y), blocked = ['mountain', 'wall', 'forest'].includes(kind);
          const joins = (nx: number, ny: number) => nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || terrainKind(map, nx, ny) === kind;
          const mask = blocked ? neighbourMask(pos.x, pos.y, joins) : undefined;
          const region = { x: pos.x*MAP_TILE_SIZE, y:pos.y*MAP_TILE_SIZE, size:Math.max(width,height) };
          const npc = town && layout.npcs.find(n => samePoint(n, pos));
          const landmark = npc ? npc.service : town && samePoint(pos, layout.entrance) ? 'cave' : !town && samePoint(pos, layout.dungeonExit) ? 'stairs' : !town && samePoint(pos, layout.objective) ? 'guardian' : undefined;
          const label = here ? 'You' : npc ? npc.name : landmark === 'cave' ? view.dungeonName : landmark === 'stairs' ? 'Cave exit' : landmark === 'guardian' ? p.cleared ? 'Guardian defeated' : 'Cave guardian' : kind;
          const adjacent = near(pos, p.position) && !here && walkable(map, pos);
          return <button type="button" key={index} tabIndex={-1} title={label} aria-label={`${label}, ${pos.x}, ${pos.y}`} disabled={disabled || !adjacent}
            onClick={() => move(pos.x-p.position.x,pos.y-p.position.y)} data-terrain={kind} data-border-mask={mask}
            className={`campaign-tile ${town ? 'map-grass-base' : 'map-floor-base'} ${here ? 'tile-player' : ''} ${landmark ? 'tile-landmark' : ''}`}
            style={{ zIndex: pos.y + 1, ...texturePosition(town ? 'grass' : 'floor', region) }}>
            <TerrainTile kind={kind} mask={mask} region={region} />
            {landmark && <><LandmarkArt kind={landmark} /><span className="landmark-label">{npc ? { inn:'Inn', weapons:'Weapons', armor:'Armor', items:'Items', quest:'Key keeper' }[npc.service] : landmark === 'guardian' ? p.cleared ? 'Cleared' : 'Guardian' : landmark === 'stairs' ? 'Exit' : 'Cave'}</span></>}
          </button>;
        })}
        <div className="campaign-map-player" style={{ transform: `translate(${p.position.x * MAP_TILE_SIZE}px,${p.position.y * MAP_TILE_SIZE}px)`, zIndex: p.position.y + 2 }}>
          <EquippedPlayerAvatar player={view.player} className="campaign-map-avatar" label="Your equipped adventurer" />
        </div>
      </div>
    </div>
  </>;
}

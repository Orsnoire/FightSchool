import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { dungeonAccessible, near, pointKey, samePoint, walkable, type CampaignView } from '@shared/campaign/model';
import { campaignRequest } from './Campaigns';
import './campaign.css';
type ShopItem = { id: string; name: string; slot: string; price: number; shop: string };

export default function CampaignAdventure() {
  const [, params] = useRoute('/student/campaign/:id');
  const [, navigate] = useLocation();
  const id = params?.id, path = `/api/campaigns/${id}`;
  const client = useQueryClient();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const inFlight = useRef(false);
  const query = useQuery({ queryKey: [path], queryFn: () => campaignRequest<CampaignView>(path), enabled: !!id, staleTime: 0, refetchInterval: 3000 });
  const shop = useQuery({ queryKey: [path, 'shop'], queryFn: () => campaignRequest<ShopItem[]>(`${path}/shop`), enabled: !!id, staleTime: 0 });
  const view = query.data;
  function resume(sessionId: string) {
    localStorage.setItem('sessionId', sessionId);
    // Session-specific return destination; never used for permissions or rewards.
    localStorage.setItem(`campaignReturn:${sessionId}`, id!);
    navigate('/student/combat');
  }
  async function act(action: Record<string, unknown>) {
    if (!view || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const next = await campaignRequest<CampaignView>(`${path}/actions`, 'POST', { commandId: crypto.randomUUID(), revision: view.progressRevision, action });
      client.setQueryData([path], next);
      if (next.progress.activeSessionId) resume(next.progress.activeSessionId);
    } catch (e) { setError((e as Error).message); await query.refetch(); } finally { inFlight.current = false; setBusy(false); }
  }
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,select,textarea,button,a') || e.altKey || e.ctrlKey || e.metaKey) return;
      const moves: Record<string, [number, number]> = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
      if (moves[e.key] && !view?.progress.activeSessionId) { e.preventDefault(); void act({ type: 'move', dx: moves[e.key][0], dy: moves[e.key][1] }); }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  });
  if (!view) return <main className="campaign-shell"><Link href="/student/campaigns">← Campaigns</Link><p role={query.error ? 'alert' : 'status'}>{query.error?.message || 'Opening your adventure…'}</p></main>;
  const p = view.progress, map = view.layout[p.zone], town = p.zone === 'overworld';
  const services = town ? view.layout.npcs.filter(n => near(n, p.position)) : [];
  const disabled = busy || !!p.activeSessionId;
  const explored = new Set(p.explored);
  const open = dungeonAccessible(view.gates, p);
  const move = (dx: number, dy: number) => void act({ type: 'move', dx, dy });
  return <main className="campaign-shell">
    <Link href="/student/campaigns" className="campaign-back">← Campaigns</Link>
    <header className="campaign-heading"><span className="campaign-eyebrow">{view.guildName} · Solo adventure</span><h1>{view.name}</h1><p>{town ? 'Hearthlight & the wilds' : view.dungeonName} · {p.cleared ? 'Dungeon cleared' : open ? 'The cave is open' : 'Find the key keepers in town'}</p></header>
    <div className="campaign-resources" aria-live="polite"><strong className="capitalize">{p.job}</strong><span>HP <b>{p.health}/{p.maxHealth}</b></span><span>MP <b>{p.mp}/{p.maxMp}</b></span><span>Potions <b>{p.healingPotions}/5</b></span><span>Gold <b>{view.gold}</b></span></div>
    {(error || query.error) && <p role="alert" className="campaign-error">{error || query.error?.message}</p>}
    {p.activeSessionId && <div className="campaign-panel campaign-warning" role="status"><h2>Encounter in progress</h2><p>Finish or leave this encounter to resume exploring. Your saved HP will return with you.</p><Button onClick={() => resume(p.activeSessionId!)}>Resume encounter</Button><Button variant="outline" onClick={() => query.refetch()}>Refresh results</Button></div>}
    {p.health <= 0 && !p.activeSessionId && <p className="campaign-warning">You are exhausted. Walk to the inn (I) and rest before leaving town.</p>}
    <div className="campaign-adventure-grid">
      <section className="campaign-panel campaign-map-panel" aria-label="Exploration map">
        <div className={`campaign-map ${town ? '' : 'campaign-cave'}`} style={{ gridTemplateColumns: `repeat(${map.width}, minmax(0, 1fr))` }} role="group" aria-label={town ? 'Overworld map' : 'Cave map'}>
          {map.tiles.map((tile, index) => {
            const pos = { x: index % map.width, y: Math.floor(index / map.width) };
            const here = samePoint(pos, p.position), adjacent = near(pos, p.position) && !here && walkable(map, pos);
            const npc = town && view.layout.npcs.find(n => samePoint(n, pos));
            const entrance = town && samePoint(pos, view.layout.entrance), exit = !town && samePoint(pos, view.layout.dungeonExit), goal = !town && samePoint(pos, view.layout.objective);
            const mark = here ? '●' : npc ? ({ inn: 'I', weapons: 'W', armor: 'A', quest: '!' }[npc.service]) : entrance ? 'D' : exit ? '↩' : goal ? p.cleared ? '✓' : '◆' : '';
            const label = here ? 'You' : npc ? npc.name : entrance ? view.dungeonName : exit ? 'Cave exit' : goal ? 'Cave guardian' : tile;
            return <button key={index} tabIndex={-1} title={label} aria-label={`${label}, ${pos.x}, ${pos.y}`} disabled={disabled || !adjacent} onClick={() => move(pos.x - p.position.x, pos.y - p.position.y)} className={`campaign-tile tile-${tile} ${here ? 'tile-player' : ''} ${mark && !here ? 'tile-landmark' : ''} ${explored.has(pointKey(p.zone, pos)) ? 'tile-visited' : ''}`}>{mark}</button>;
          })}
        </div>
        <p className="campaign-legend">● You · I Inn · W Weapons · A Armor · ! Key keeper · D Dungeon · ◆ Guardian</p>
        <div className="campaign-controls" aria-label="Movement controls"><Button aria-label="Move north" disabled={disabled} onClick={() => move(0, -1)}>↑</Button><div><Button aria-label="Move west" disabled={disabled} onClick={() => move(-1, 0)}>←</Button><Button aria-label="Move south" disabled={disabled} onClick={() => move(0, 1)}>↓</Button><Button aria-label="Move east" disabled={disabled} onClick={() => move(1, 0)}>→</Button></div></div>
        <p className="campaign-note">Use the arrows or WASD. Step beside a landmark to interact. Town is safe; the wilds can trigger encounters.</p>
        <div className="campaign-actions">
          {town && near(p.position, view.layout.entrance) && <Button disabled={disabled || !open || p.health <= 0} onClick={() => act({ type: 'enter' })}>Enter {view.dungeonName}</Button>}
          {!town && near(p.position, view.layout.dungeonExit) && <Button disabled={disabled} onClick={() => act({ type: 'exit' })}>Leave cave</Button>}
          {!town && near(p.position, view.layout.objective) && <Button disabled={disabled || !open || p.cleared} onClick={() => act({ type: 'encounter' })}>{p.cleared ? 'Guardian defeated' : 'Challenge guardian'}</Button>}
          <Button variant="outline" disabled={disabled} onClick={() => act({ type: 'return_to_town' })}>Return to town</Button>
        </div>
      </section>
      <aside className="campaign-sidebar">
        <section className="campaign-panel"><h2>Adventure menu</h2><p>HP, MP and consumables carry into your next encounter.</p>
          {view.healingActions.length ? view.healingActions.map(a => <Button className="campaign-heal" key={a.id} variant="outline" disabled={disabled || p.health <= 0 || p.health >= p.maxHealth || p.mp < a.mp || p.healingPotions < a.potions} onClick={() => act({ type: 'heal', ability: a.id })}>{a.name} · +{a.amount} HP{a.mp ? ` · ${a.mp} MP` : ''}{a.potions ? ` · ${a.potions} potion` : ''}</Button>) : <p className="campaign-note">This job has no field healing. Visit the inn to rest or change jobs.</p>}
          <p className="campaign-note">Only supported healing from your current job and equipped cross-class abilities appears here.</p>
        </section>
        <section className="campaign-panel"><h2>Unlock quests</h2>{view.gates.length === 0 && <p>The cave needs no key.</p>}{view.gates.map(g => <p key={g.id}><strong>{g.name}</strong><br />{!g.open ? 'Waiting for your teacher' : p.claimedUnlocks.includes(g.id) ? 'Key collected' : 'Ready — visit its keeper (!)'}</p>)}<p className="campaign-note">Overworld pool: {view.eligibleQuestionCount} questions from unlocked dungeons.</p></section>
        {services.map(n => <section className="campaign-panel" key={n.id}>
          <h2>{n.name}</h2>
          {n.service === 'inn' && <><p>Rest restores HP, MP and five healing charges. Rest is free in this test campaign.</p><Button disabled={disabled} onClick={() => act({ type: 'rest' })}>Rest at the inn</Button><label className="mt-4">Campaign job<select aria-label="Campaign job" disabled={disabled} value={p.job} onChange={e => act({ type: 'job', job: e.target.value })}>{view.unlockedJobs.map(j => <option key={j} value={j}>{j}</option>)}</select></label><p className="campaign-note">Changing jobs does not heal. This adventure uses that job’s saved equipment; your classroom job stays separate.</p><Link href="/student/equipment" className="underline">Manage saved equipment</Link></>}
          {n.service === 'quest' && <><p>“When your teacher opens this path, I will entrust you with the key.”</p><Button disabled={disabled || !view.gates.find(g => g.id === n.gateId)?.open || p.claimedUnlocks.includes(n.gateId!)} onClick={() => act({ type: 'quest', gateId: n.gateId })}>{p.claimedUnlocks.includes(n.gateId!) ? 'Key collected' : 'Collect key'}</Button></>}
          {(n.service === 'weapons' || n.service === 'armor') && <><p>Tier 1 stock · Purchases join your inventory.</p>{shop.error && <p role="alert">{shop.error.message}</p>}<div className="campaign-stock">{shop.data?.filter(i => i.shop === n.service).map(i => <div key={i.id}><span>{i.name}<small>{i.slot} · {i.price} gold</small></span><Button size="sm" disabled={disabled || view.gold < i.price || view.inventory.includes(i.id)} onClick={() => act({ type: 'buy', shop: n.service, itemId: i.id })}>{view.inventory.includes(i.id) ? 'Owned' : 'Buy'}</Button></div>)}</div></>}
        </section>)}
      </aside>
    </div>
  </main>;
}

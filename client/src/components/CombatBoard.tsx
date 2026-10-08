import { isHypnosis, statusSummary } from "@shared/combat/status-effects";
import { useState, type CSSProperties } from "react";
import type { CombatPlayer, CombatSnapshot } from "@shared/combat/model";
import { initialAppearance } from "@shared/avatar/appearance";
import { StaticAvatar } from "./StaticAvatar";
import { Crown, Star, XCircle } from "lucide-react";
import { BattleScenery } from "./BattleScenery";
import "./battlefield.css";

/** Stable insertion-order slots. Resources and damage never reorder the party. */
export function formationSlots(count: number, self = false) {
  const columns = count <= 4 ? 1 : count <= 12 ? 3 : count <= 20 ? 5 : 6;
  const rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, i) => {
    const col = Math.floor(i / rows), row = i % rows;
    return { x: 9 + col * (columns === 1 ? 0 : 36 / (columns - 1)) + Math.sin((row + 1) / (rows + 1) * Math.PI) * 3,
      y: rows === 1 ? 65 : 36 + row / (rows - 1) * (self ? 35 : 52),
      size: count <= 2 ? 170 : count <= 4 ? 138 : count <= 12 ? 110 : count <= 24 ? 88 : 72 };
  });
}
function Bar({ current, max, label }: { current: number; max: number; label: string }) {
  return <div className="battle-health" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={current}>
    <span style={{ width: `${Math.max(0, Math.min(100, current / Math.max(1, max) * 100))}%` }} />
  </div>;
}
export function CombatBoard({ state, selfId, onResurrect, onRemove }: {
  state: CombatSnapshot; selfId?: string | null; onResurrect?: (id: string) => void; onRemove?: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const all = Object.values({ ...state.players, ...state.pendingPlayers });
  const self = all.find(p => p.studentId === selfId);
  const others = all.filter(p => p !== self);
  const slots = formationSlots(others.length, !!self);
  const topDamage = Object.values(state.players).filter(p => p.totals.damageDealt > 0).sort((a,b) => b.totals.damageDealt-a.totals.damageDealt)[0]?.studentId;
  const damageLeader = state.damageLeaderId === undefined ? topDamage : state.damageLeaderId;
  const enemies = state.enemyDisplayMode === "consecutive" ? state.enemies.filter(e => e.health > 0).slice(0,1) : state.enemies;
  const shownEnemies = enemies.length ? enemies : state.enemies.slice(-1);
  const renderPlayer = (p: CombatPlayer, x: number, y: number, size: number, isSelf = false) => {
    const queued = !!state.pendingPlayers?.[p.studentId];
    const canRevive = !!onResurrect && p.isDead && !queued;
    return <div key={p.studentId} data-player-id={p.studentId} data-self={isSelf || undefined}
      className={`battle-player group ${p.isDead ? "is-ko" : ""} ${queued ? "is-queued" : ""} ${selected === p.studentId ? "is-selected" : ""}`}
      style={{ left: `${x}%`, top: `${y}%`, "--avatar-size": `${size}px`, zIndex: Math.round(y) } as CSSProperties}>
      <div className="battle-markers">
        {state.threatLeaderId === p.studentId && <Crown aria-label="Threat leader" className="battle-crown" size={19} />}
        {damageLeader === p.studentId && <Star aria-label="Damage leader" className="battle-star" size={18} />}
      </div>
      {p.health < p.maxHealth && <Bar current={p.health} max={p.maxHealth} label={`${p.nickname} HP`} />}
      <button type="button" className="battle-avatar" aria-label={canRevive ? `Resurrect ${p.nickname} with 1 HP` : `${p.nickname}${isSelf ? " (you)" : ""}, ${p.isDead ? "knocked out" : `${p.health}/${p.maxHealth} HP`}${queued ? ", joining next round" : ""}`}
        onClick={() => { setSelected(selected === p.studentId ? null : p.studentId); if (canRevive) onResurrect(p.studentId); }}>
        <StaticAvatar appearance={p.appearance || initialAppearance(null, p.gender === "B" ? "human-female-v1" : "human-male-v1", () => .35)} job={p.characterClass} loadout={p.equipmentLoadout} className="battle-paperdoll" />
      </button>
      <span className="battle-name">{p.nickname}{isSelf ? " · You" : ""}{queued ? " · Next round" : p.isDead ? " · KO" : ""}</span>
      {!!p.statuses?.length && <span className="rounded bg-black/80 px-1 text-[10px] text-amber-200" title={statusSummary(p).join("; ")} aria-label={`${p.nickname}: ${statusSummary(p).join("; ")}`}>{p.statuses.some(isHypnosis) ? `Hypnotized ${p.statuses.find(isHypnosis)?.correctAnswers || 0}/3` : p.statuses.some(x => x.type === "stun" || x.type === "paralysis") ? `Recovery ${p.recoveryCorrectAnswers || 0}/2` : "Status effect"}</span>}
      {onRemove && <button className="battle-remove" aria-label={`Remove ${p.nickname} from fight`} onClick={event => { event.stopPropagation(); onRemove(p.studentId); }}><XCircle size={23} /></button>}
    </div>;
  };
  return <section aria-label="Battlefield" className={`battlefield ${all.length > 12 ? "is-crowded" : ""}`} data-testid="battlefield">
    <BattleScenery />
    <div className="battle-scene-label"><span>THE PARTY</span><span>{state.currentPhase === "waiting" ? "GATHER YOUR PARTY" : `ROUND ${state.round}`}</span><span>THE ENEMY</span></div>
    {others.map((p, i) => renderPlayer(p, slots[i].x, slots[i].y, slots[i].size))}
    {self && renderPlayer(self, 32, 89, 180, true)}
    {!all.length && <p className="battle-empty">The field is ready.<br/><span>Share the join code to gather your party.</span></p>}
    {shownEnemies.map((e, i) => <div key={e.id} className={`battle-enemy ${e.health <= 0 ? "is-ko" : ""}`} style={{ left: `${shownEnemies.length === 1 ? 76 : 66 + (i % 2) * 20}%`, top: `${shownEnemies.length === 1 ? 72 : 48 + Math.floor(i / 2) * 21}%`, "--enemy-size": shownEnemies.length === 1 ? "230px" : "150px" } as CSSProperties}>
      <div className="battle-enemy-name">{e.name}</div><Bar current={e.health} max={e.maxHealth} label={`${e.name} HP`} />
      <span className="battle-enemy-hp">{e.health} / {e.maxHealth}</span>
      {Object.values(state.players).some(p => !p.isDead && p.statuses?.some(x => isHypnosis(x) && x.sourceId === e.id)) && <span className="rounded bg-black/80 px-2 text-xs text-amber-200">Maintaining hypnosis · cannot act</span>}
      {e.aiState?.buffs.filter(b => b.type !== "flatten" && b.throughRound >= state.round).map((b, index) => <span className="rounded bg-black/80 px-1 text-xs text-amber-200" key={`${b.type}:${index}`}>{b.type === "attack" ? "Soul inflamed · +100% ATK" : b.type === "defense" ? "+50% DEF" : "Faded · immune"}</span>)}
      <img src={e.image} alt={e.name} />
    </div>)}
    <details className="battle-roster"><summary>Party · {all.length}</summary><div className="battle-roster-list">{all.map(p => <button key={p.studentId} onClick={() => setSelected(p.studentId)}>{p.nickname}<span>{p.isDead ? "KO" : `${p.health}/${p.maxHealth} HP`}{state.pendingPlayers?.[p.studentId] ? " · Next round" : ""}</span></button>)}</div></details>
    <div className="battle-legend"><Crown size={13}/> Threat <Star size={13}/> Damage</div>
  </section>;
}

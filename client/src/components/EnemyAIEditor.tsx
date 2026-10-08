import { ENEMY_CATALOG } from "@shared/combat/enemy-catalog";
import { useState } from "react";
import type { Enemy } from "@shared/schema";
import type { CombatEnemy, CombatSnapshot } from "@shared/combat/model";
import {
  CONDITIONS, CONDITION_LABELS, DEFAULT_ENEMY_RULES, ENEMY_MOVES, ENEMY_TYPES, MOVE_IDS,
  TARGETS, TARGET_LABELS, enemyRules, inferEnemyType, ruleFor, ruleProblem, ruleAllowed,
  type EnemyAI, type EnemyMove, type EnemyRule, type EnemyType,
} from "@shared/combat/enemy-ai";

const field = "w-full rounded-md border border-input bg-background px-2 py-2 text-sm";
export function EnemyAIEditor({ enemy, onChange }: { enemy: Partial<Enemy>; onChange: (enemy: Partial<Enemy>) => void }) {
  const type = enemy.enemyType || inferEnemyType(enemy.image);
  const config: EnemyAI = { mode: "default", paralysisSkipChance: 0.3, biome: "grasslands", ...enemy.ai };
  const current = enemyRules({ enemyType: type, ai: config });
  const [previewHp, setPreviewHp] = useState(50);
  const [targetHp, setTargetHp] = useState(60);
  const [previewRound, setPreviewRound] = useState(3);
  const update = (patch: Partial<EnemyAI>) => onChange({ ...enemy, enemyType: type === "basic" ? undefined : type, ai: { ...config, ...patch } });
  const editRule = (index: number, patch: Partial<EnemyRule>) => update({ rules: current.map((r, i) => i === index ? { ...r, ...patch } : r) });
  const previewEnemy: CombatEnemy = { id: "preview", name: "Enemy", image: "", difficultyMultiplier: 10,
    health: previewHp, maxHealth: 100, enemyType: type, ai: config, effects: [], aiState: { readyRounds: {}, buffs: [] } };
  const preview = { round: previewRound, players: Object.fromEntries(["Tank", "Damage", "Healer"].map((name, i) => [name, {
    studentId: name, nickname: name, isDead: false, health: targetHp, maxHealth: 100,
    threat: 30 - i * 10, totals: { damageDealt: i === 1 ? 50 : 5 }, statuses: [],
    availableAbilities: i === 2 ? ["first_aid"] : ["attack"],
  }])) } as unknown as CombatSnapshot;
  const eligible = current.filter(r => !ruleProblem(preview, previewEnemy, r));
  const topPriority = Math.max(...eligible.map(r => r.priority));
  const pool = eligible.filter(r => r.priority === topPriority);
  const totalWeight = pool.reduce((n, r) => n + r.weight, 0);
  const unused = MOVE_IDS.filter(id => (ENEMY_MOVES[id].type === type || id === "attack") && !current.some(r => r.move === id));
  return <fieldset className="space-y-4 rounded-lg border p-4" data-testid="enemy-ai-editor">
    <legend className="px-2 font-medium">Enemy behavior</legend>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm">Enemy type
        <select aria-label="Enemy AI type" className={field} value={type === "basic" ? "" : type} onChange={e => {
          const nextType = e.target.value as typeof ENEMY_TYPES[number];
          const definition = ENEMY_CATALOG[nextType];
          onChange({ ...enemy, enemyType: nextType, species: nextType === "goblin" ? "goblin" : "other",
            quantity: Math.max(definition.minimumQuantity, enemy.quantity || 1),
            image: enemy.image && !/generated_images|\/assets\/|^\/enemies\//.test(enemy.image) ? enemy.image : definition.image,
            ai: { ...config, mode: "default", rules: undefined } });
        }}>
          {type === "basic" && <option value="" disabled>Choose a supported enemy type</option>}
          {ENEMY_TYPES.map(t => <option key={t} value={t}>{ENEMY_CATALOG[t].name}</option>)}
        </select>
      </label>
      {type !== "goblin" && <label className="space-y-1 text-sm">AI preset
        <select aria-label="Enemy AI preset" className={field} value={config.mode} onChange={e => update({ mode: e.target.value as EnemyAI["mode"],
          ...(e.target.value === "custom" ? { rules: structuredClone(DEFAULT_ENEMY_RULES[type]) } : {}) })}>
          <option value="default">Use species behavior</option><option value="custom">Custom priorities</option><option value="basic">Basic attacks only</option>
        </select>
      </label>}
    </div>
    {type === "basic" && <p className="text-sm text-amber-600">This retired enemy needs a supported type before you save. Its existing fight data remains intact.</p>}
    {type === "goblin" && <p className="text-sm text-muted-foreground">Minimum five goblins. Basic attacks use swarm targeting: 50% threat leader, 25% healers, 25% damage leader.</p>}
    <p className="text-sm text-muted-foreground">Highest eligible priority acts first; equal priorities use relative weights. Unavailable moves fall back to Attack. These settings apply when a new fight session opens.</p>
    {config.mode === "custom" && type !== "goblin" ? <div className="space-y-3">
      {current.map((r, index) => <fieldset key={r.move} className="space-y-3 rounded border p-3">
        <legend className="px-1 text-sm font-medium">{ENEMY_MOVES[r.move].name}</legend>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label={`Enable ${ENEMY_MOVES[r.move].name}`} checked={r.enabled} onChange={e => editRule(index, { enabled: e.target.checked })} />Enabled</label>
          <button className="text-sm underline" type="button" aria-label={`Remove ${ENEMY_MOVES[r.move].name}`} onClick={() => update({ rules: current.filter((_, i) => i !== index) })}>Remove</button>
        </div>
        <p className="text-xs text-muted-foreground">{ENEMY_MOVES[r.move].description}</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <label className="text-sm">When<select className={field} aria-label={`${r.move} condition`} value={r.condition} onChange={e => editRule(index, { condition: e.target.value as EnemyRule["condition"] })}>
            {CONDITIONS.filter(c => (r.target !== "self" || !c.startsWith("target_")) && (c !== "target_unafflicted" || !!ENEMY_MOVES[r.move].effect)).map(c => <option value={c} key={c}>{CONDITION_LABELS[c]}</option>)}
          </select></label>
          {!["always", "target_unafflicted"].includes(r.condition) && <label className="text-sm">{r.condition === "after_round" ? "Round" : "HP %"}<input className={field} aria-label={`${r.move} threshold`} type="number" min={1} max={100} value={r.value} onChange={e => editRule(index, { value: Math.max(1, Math.min(100, +e.target.value)) })} /></label>}
          <label className="text-sm">Target<select className={field} aria-label={`${r.move} target`} value={r.target} onChange={e => editRule(index, { target: e.target.value as EnemyRule["target"] })}>
            {TARGETS.filter(t => ruleAllowed(type, { ...r, target: t })).map(t => <option value={t} key={t}>{TARGET_LABELS[t]}</option>)}
          </select></label>
          <label className="text-sm">Priority<input className={field} aria-label={`${r.move} priority`} type="number" min={0} max={100} value={r.priority} onChange={e => editRule(index, { priority: Math.max(0, Math.min(100, +e.target.value)) })} /></label>
          <label className="text-sm">Weight<input className={field} aria-label={`${r.move} weight`} type="number" min={1} max={100} value={r.weight} onChange={e => editRule(index, { weight: Math.max(1, Math.min(100, +e.target.value)) })} /></label>
          <label className="text-sm">Cooldown rounds<input className={field} aria-label={`${r.move} cooldown`} type="number" min={ENEMY_MOVES[r.move].cooldown} max={20} value={r.cooldown} onChange={e => editRule(index, { cooldown: Math.max(ENEMY_MOVES[r.move].cooldown, Math.min(20, +e.target.value)) })} /></label>
        </div>
      </fieldset>)}
      {unused.length > 0 && <label className="block text-sm">Add move<select className={field} aria-label="Add enemy move" value="" onChange={e => { if (e.target.value) update({ rules: [...current, ruleFor(e.target.value as EnemyMove)] }); }}>
        <option value="">Choose a move…</option>{unused.map(id => <option value={id} key={id}>{ENEMY_MOVES[id].name}</option>)}
      </select></label>}
      <button type="button" className="text-sm underline" onClick={() => update({ mode: "default", rules: undefined })}>Restore species defaults</button>
    </div> : <ul className="space-y-2 text-sm">{current.map(r => <li key={r.move}><strong>{ENEMY_MOVES[r.move].name}.</strong> {ENEMY_MOVES[r.move].description}</li>)}</ul>}
    {type === "zombie" && config.mode !== "basic" && <label className="block text-sm">Paralysis action-failure chance (%)
      <input className={field} aria-label="Paralysis action-failure chance" type="number" min={0} max={100} value={Math.round(config.paralysisSkipChance * 100)} onChange={e => update({ paralysisSkipChance: Math.max(0, Math.min(100, +e.target.value)) / 100 })} />
      <span className="text-xs text-muted-foreground">Application chance stays 30%. Two correct answers clear all stun stacks and paralysis; they need not be consecutive.</span>
    </label>}
    {config.mode !== "basic" && type !== "goblin" && <details className="space-y-3 rounded border p-3">
      <summary className="cursor-pointer text-sm font-medium">Preview priorities</summary>
      <p className="text-xs text-muted-foreground">Example with a tank, damage dealer and healer. All moves are ready; no active effects. Live cooldowns, targets and recovery immunity can change the choice.</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs">Enemy HP %<input className={field} aria-label="Preview enemy HP" type="number" min={1} max={100} value={previewHp} onChange={e => setPreviewHp(Math.max(1, Math.min(100, +e.target.value)))} /></label>
        <label className="text-xs">Player HP %<input className={field} aria-label="Preview player HP" type="number" min={1} max={100} value={targetHp} onChange={e => setTargetHp(Math.max(1, Math.min(100, +e.target.value)))} /></label>
        <label className="text-xs">Round<input className={field} aria-label="Preview round" type="number" min={1} max={100} value={previewRound} onChange={e => setPreviewRound(Math.max(1, Math.min(100, +e.target.value)))} /></label>
      </div>
      <ul className="space-y-1 text-xs" aria-label="Enemy priority preview">{current.map(r => <li key={r.move}><strong>{ENEMY_MOVES[r.move].name}:</strong> {ruleProblem(preview, previewEnemy, r) || (r.priority === topPriority ? `Eligible · ${Math.round(100 * r.weight / totalWeight)}% chance` : "Lower priority")}</li>)}</ul>
      {!eligible.length && <p className="text-sm">No eligible rule: uses Attack.</p>}
    </details>}
  </fieldset>;
}

import { activeEnemies, hpLabel } from "@shared/combat/encounters";
import { LootRewardChoices } from "@/components/LootRewardChoices";
import { abilityPreview } from "@shared/combat/abilityValues";
import { AllyTargetGrid } from "@/components/AllyTargetGrid";
import { StaminaBar } from "@/components/StaminaBar";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useCombatSession } from "@/hooks/useCombatSession";
import { CombatBoard } from "@/components/CombatBoard";
import { RichContentRenderer } from "@/components/RichContentRenderer";
import { MathEditor } from "@/components/MathEditor";
import { Button } from "@/components/ui/button";
import { CombatOverlay } from "@/components/CombatOverlay";
import { CombatResources } from "@/components/CombatResources";
import { CombatResolution } from "@/components/CombatResolution";
import { Swords, Sparkles, FlaskConical, Shield, Heart } from "lucide-react";
import { SUPPORT, ALLIES, selectionProblem, actionCost, defaultQuestionAbility } from "@shared/combat/abilities";
import { JOB_TREE } from "@shared/jobSystem";
import { apiRequest, queryClient } from "@/lib/queryClient";
const names: Record<string, string> = {
  wave_break: "Wave cleared — next wave ready",
  waiting: "Waiting for your teacher",
  question: "Question",
  actions: "Combat action selection",
  abilities: "Block, heal, and support",
  question_resolution: "Answer resolution",
  enemy_ai: "Enemy counterattack",
  game_over: "Fight complete",
};
export default function Combat() {
  const [, navigate] = useLocation();
  const sessionId = localStorage.getItem("sessionId"),
    studentId = localStorage.getItem("studentId");
  const { state, question, results, status, error, send, seconds, serverNow, leave, hasLeft, isLeaving, admission, requestRejoin } =
    useCombatSession(sessionId, "student");
  const [answer, setAnswer] = useState(""),
    [ability, setAbility] = useState("attack"),
    [target, setTarget] = useState(""),
    [math, setMath] = useState(false),
    [claimed, setClaimed] = useState(false),
    [claiming, setClaiming] = useState(false),
    [claimError, setClaimError] = useState("");
  const claimInFlight = useRef(false);
  const p = studentId ? state?.players[studentId] || state?.pendingPlayers?.[studentId] : null;
  const queued = !!(studentId && state?.pendingPlayers?.[studentId]);
  const result = results.find((r) => r.studentId === studentId);
  const returnToLobby = () => {
    if (localStorage.getItem("sessionId") === sessionId) localStorage.removeItem("sessionId");
    queryClient.invalidateQueries();
    navigate("/student");
  };
  const requestLeave = () => {
    const message = state?.currentPhase === "game_over"
      ? "Leave this fight and return to your dashboard? Your completed results are kept."
      : "Leave this fight and return to your dashboard? You can rejoin with the fight code while it is active. Your resources and earlier participation will be kept; you must return before completion to receive rewards.";
    if (window.confirm(message)) leave();
  };
  useEffect(() => { if (hasLeft) returnToLobby(); }, [hasLeft]);
  useEffect(() => {
    setAnswer("");
    setAbility(defaultQuestionAbility(p?.characterClass || "warrior"));
    setTarget("");
  }, [state?.round, p?.characterClass]);
  useEffect(() => {
    if (state?.currentPhase === "abilities") {
      setAbility(p?.availableAbilities.includes("warrior_block") ? "warrior_block" : "");
      setTarget("");
    }
  }, [state?.currentPhase]);
  useEffect(() => {
    if (!sessionId || !studentId) navigate("/student");
  }, [sessionId, studentId, navigate]);
  if (!state)
    return (
      <main className="p-6">
        <h1 className="text-xl font-bold">{admission === "ended" ? "This fight has ended" : admission === "removed" ? "You were removed from this fight" : admission === "pending" ? "Waiting for your host’s approval" : admission === "blocked" ? "Rejoin requests are blocked for this fight" : admission === "denied" ? "Your rejoin request was declined" : "Connecting to combat…"}</h1>
        {["removed", "denied"].includes(admission) && <><p className="mt-2 text-sm">{admission === "denied" ? "You can request again after 30 seconds." : "Your host must approve your return."}</p><Button className="mt-4 mr-3" onClick={requestRejoin}>Request to rejoin</Button></>}
        {admission === "pending" && <p className="mt-2">Your host has your request. You will join the next round if approved.</p>}
        <p role="alert">{error}</p>
        <Button className="mt-4" disabled={isLeaving} onClick={() => admission === "pending" ? leave() : returnToLobby()}>
          {isLeaving ? "Leaving…" : "Back to lobby"}
        </Button>
      </main>
    );
  const phase = state.currentPhase;
  const intro =
    phase === "question" &&
    !!state.questionStartTime &&
    serverNow < state.questionStartTime;
  const canAct = status === "connected" && !isLeaving && !queued && !!p && !p.isDead;
  const available =
    p?.availableAbilities.filter(
      (id) => SUPPORT.has(id) === (phase === "abilities") &&
        !(id === "healing_potion" && p.healingPotions === 0),
    ) || [];
  const guard = ["warrior_block", "shield_bash", "healing_guard", "aegis", "deflect"].includes(ability);
  const options = ALLIES.has(ability)
    ? Object.values(state.players)
        .filter((x) => !x.isDead)
        .sort((a, b) => (guard ? b.threat - a.threat : 0) || a.health / a.maxHealth - b.health / b.maxHealth || a.nickname.localeCompare(b.nickname))
        .map((x) => ({
          id: x.studentId,
          name: `${x.nickname} · ${x.health}/${x.maxHealth} HP`,
        }))
    : activeEnemies(state)
        .map((e) => ({ id: e.id, name: `${e.name} · ${hpLabel(e.health)}/${hpLabel(e.maxHealth)} HP` }));
  const chosen = options.some(o => o.id === target) ? target : options[0]?.id || p?.studentId || "";
  const definition = (id: string) =>
    Object.values(JOB_TREE)
      .flatMap((j) => Object.values(j.levelRewards))
      .flatMap((r) => r.abilities || [])
      .find((a) => a.id === id);
  const label = (id: string) => id === "craft_healing_potion" && p?.healingPotions === 0 ? "Create potion" : definition(id)?.name || (id === "attack" ? "Attack" : id.replaceAll("_", " "));
  const preview = (id: string) => p ? abilityPreview(p, id, phase === "actions" || phase === "question") : "";
  const description = (id: string) => definition(id)?.description || "Deal your base damage to an enemy.";
  const costLabel = (id: string) => {
    if (!p) return "";
    const c = actionCost(p, id);
    return [c.mp ? (id === "fireblast" ? `All MP (${c.mp})` : `${c.mp} MP`) : "", c.combo ? `${c.combo} combo` : "", c.healing ? "1 healing potion" : "", c.shield ? "1 shield potion" : ""].filter(Boolean).join(" · ") || "No cost";
  };
  const needsTarget = ALLIES.has(ability) || (!SUPPORT.has(ability) && !["craft_healing_potion", "craft_shield_potion", "pact_surge", "holy_light", "finale"].includes(ability));
  const view = queued && phase !== "game_over" ? "joining" : intro ? "intro" : p?.isDead && ["question", "actions", "abilities"].includes(phase) ? "knocked-out" : p?.ready && ["question", "actions", "abilities"].includes(phase) ? "ready" : phase === "question" && p?.hasAnswered ? "answered" : phase === "actions" ? "action" : phase;
  const title = view === "answered" ? "Answer submitted" : view === "intro" ? (state.round === 1 ? "Question" : "Next question") : view === "knocked-out" ? "Your party is still fighting" : view === "ready" ? "Ready — waiting for your party" : view === "action" ? "Choose your combat action" : phase === "question" ? `Question ${state.currentQuestionIndex + 1}` : names[phase];
  const minimal = ["waiting", "wave_break", "joining", "intro", "answered", "ready", "knocked-out"].includes(view);
  const waitMessage = view === "wave_break" ? "Wave cleared · Waiting for the next wave" : view === "joining" ? "Joining next round" : view === "waiting" ? "Waiting for your teacher" : view === "intro" ? "Get ready…" : view === "knocked-out" ? "Knocked out · Your party is still fighting" : "Waiting for other players";
  const claim = async (itemId?: string) => {
    if (claimInFlight.current || claimed) return;
    claimInFlight.current = true;
    setClaiming(true);
    setClaimError("");
    try {
      await apiRequest(
        "POST",
        `/api/student/${studentId}/${itemId ? "claim-loot" : "claim-gold"}`,
        {
          fightId: state.fightId,
          resultId: result?.id,
          ...(itemId ? { itemId } : {}),
        },
      );
      setClaimed(true);
      await queryClient.invalidateQueries();
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : "Unable to claim reward");
    } finally {
      claimInFlight.current = false;
      setClaiming(false);
    }
  };
  return (
    <main className="battle-shell battle-student">
      <header className="battle-student-top"><span>Round {state.round} · Room {state.sessionId}</span>{minimal && <Button size="sm" variant="ghost" onClick={requestLeave} disabled={isLeaving}>{isLeaving ? "Leaving…" : "Leave fight"}</Button>}</header>
      <CombatBoard state={state} selfId={studentId}/>
      {minimal && <div className="battle-wait" role="status" data-testid="battle-wait"><div><strong>{waitMessage}</strong>{status !== "connected" && <span>Reconnecting…</span>}{error && <p role="alert">{error}</p>}</div>{state.phaseDeadline && <time aria-label={`${seconds} seconds remaining`}>{seconds}s</time>}</div>}
      {p && minimal && <aside className="battle-self-hud" aria-label="Your character"><h2>{p.nickname} · {p.characterClass}</h2><div className="battle-self-bars"><label>HP {p.health}/{p.maxHealth}<progress value={p.health} max={p.maxHealth}/></label>{p.maxMp > 0 && <label className="self-mp">MP {p.mp}/{p.maxMp}<progress value={p.mp} max={p.maxMp}/></label>}{p.maxComboPoints > 0 && <label className="self-cp">COMBO {p.comboPoints}/{p.maxComboPoints}<progress value={p.comboPoints} max={p.maxComboPoints}/></label>}</div><CombatResources player={p}/></aside>}
      {!minimal && <CombatOverlay onLeave={requestLeave} isLeaving={isLeaving} title={title} view={`${state.round}:${view}`} seconds={state.phaseDeadline ? seconds : null} resources={p && <div className="space-y-3"><CombatResources player={p} /><StaminaBar studentId={studentId} refreshKey={result?.id} /></div>} status={status} error={error}>
      {phase === "waiting" && <p>Your teacher will start the fight when everyone has joined.</p>}
      {intro && <p className="text-center py-8 text-lg">Get ready…</p>}
      {view === "answered" && <p>Your answer is saved. Combat action selection will begin when everyone has answered or the question timer ends. You will have a fresh 20 seconds to choose.</p>}
      {view === "ready" && <div className="text-center space-y-3 py-4"><p>Your choices are saved. Waiting for the remaining players or the timer.</p><p className="text-sm text-muted-foreground">Resources update when actions resolve.</p></div>}
      {phase === "question" && !intro && !question && <p>Loading the question…</p>}
      {phase === "question" && !intro && question && p && !p.isDead && !p.hasAnswered && (
        <div className="space-y-4">
          <>
              <RichContentRenderer html={question.question} />
              {question.type === "short_answer" ? (
                <>
                  <Button variant="outline" onClick={() => setMath(!math)}>
                    {math ? "Use text answer" : "Use math answer"}
                  </Button>
                  {math ? (
                    <MathEditor value={answer} onChange={setAnswer} containKeyboard />
                  ) : (
                    <input
                      aria-label="Your answer"
                      className="w-full p-3 border rounded-md bg-background"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      maxLength={5000}
                    />
                  )}
                </>
              ) : (
                <div className="grid gap-2">
                  {(question.type === "true_false"
                    ? ["True", "False"]
                    : question.options || []
                  ).map((option) => (
                    <Button
                      key={option}
                      variant={answer === option ? "default" : "outline"}
                      onClick={() => setAnswer(option)}
                      className="justify-start h-auto min-h-12 whitespace-normal"
                    >
                      <RichContentRenderer html={option} />
                    </Button>
                  ))}
                </div>
              )}
              <Button
                disabled={!canAct || !answer.trim()}
                onClick={() =>
                  send("answer", { answer, questionId: question.id })
                }
              >
                Submit answer
              </Button>
          </>
        </div>
      )}
      {p &&
        !p.isDead &&
        !p.ready &&
        p.hasAnswered &&
        ["actions", "abilities"].includes(phase) && (
          <div className="space-y-4">
            <h2 className="font-semibold">
              {phase === "actions"
                ? "Choose a question ability"
                : "Choose support actions"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {available.map((id) => (
                <Button
                  key={id}
                  variant={ability === id ? "default" : "outline"}
                  disabled={!canAct || !!selectionProblem(p, id)}
                  title={selectionProblem(p, id) || description(id)}
                  className="h-auto min-h-16 justify-start gap-3 whitespace-normal text-left"
                  onClick={() => {
                    setAbility(id);
                    setTarget("");
                  }}
                >
                  {id === "first_aid" ? <Heart aria-hidden size={20} className="shrink-0" /> : id.includes("potion") ? <FlaskConical aria-hidden size={20} className="shrink-0" /> : id.includes("block") || id.includes("shield") ? <Shield aria-hidden size={20} className="shrink-0" /> : actionCost(p, id).mp || id.startsWith("mana") ? <Sparkles aria-hidden size={20} className="shrink-0" /> : <Swords aria-hidden size={20} className="shrink-0" />}
                  <span><span className="block font-semibold">{label(id)}</span><span className="block text-xs font-normal">{costLabel(id)}</span>{preview(id) && <span className="block text-xs font-normal" data-testid={`ability-preview-${id}`}>{preview(id)}</span>}{selectionProblem(p, id) && <span className="block text-xs font-normal">{selectionProblem(p, id)}</span>}</span>
                </Button>
              ))}
            </div>
            {ability && (
              <>
                <p className="text-sm text-muted-foreground">{ability === "craft_healing_potion" && p.healingPotions === 0 ? "Create 1 healing potion. This action does not heal. Requires a correct answer." : description(ability)}</p>
                {needsTarget && ALLIES.has(ability) ? <AllyTargetGrid players={Object.values(state.players)} selectedId={chosen} onSelect={(id) => {
                  setTarget(id);
                  if (phase === "abilities" && !selectionProblem(p, ability)) {
                    send("action", { ability, targetId: id });
                    setAbility("");
                  }
                }} guard={guard} disabled={!canAct} /> : needsTarget && <label className="block">
                  Target
                  <select
                    aria-label="Ability target"
                    value={chosen}
                    onChange={(e) => setTarget(e.target.value)}
                    className="block border bg-background rounded p-2 mt-1 w-full"
                  >
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>}
                <Button
                  variant="secondary"
                  onClick={() => send("action", { ability, targetId: chosen, ready: phase === "actions" })}
                  disabled={
                    !canAct || !!selectionProblem(p, ability)
                  }
                >
                  {phase === "actions" ? `Confirm ${label(ability)} & Ready` : `Add ${label(ability)}`}
                </Button>
              </>
            )}
            <p className="text-sm">
              {phase === "actions"
                ? `Selected: ${label(p.questionAction?.ability || defaultQuestionAbility(p.characterClass))}`
                : `Selected: ${p.supportActions.map((a) => label(a.ability)).join(", ") || "none"}`}
            </p>
            <p className="text-xs text-muted-foreground">Values use current stats and resources. Damage bonuses and earlier actions can change the result; healing is capped by missing HP.</p>
            <p className="text-xs text-muted-foreground">Costs are reserved for your selected actions and spent when they resolve. Question actions require a correct answer.</p>
            {phase === "abilities" && <Button onClick={() => send("ready")} disabled={!canAct}>
              {p.supportActions.length ? "Ready — finish choices" : "Ready — no support actions"}
            </Button>}
          </div>
        )}
      {p?.isDead && phase !== "game_over" && (
        <p>You are knocked out. Your party can revive you.</p>
      )}
      {["question_resolution", "enemy_ai"].includes(phase) && <CombatResolution state={state} studentId={studentId} />}
      {phase === "game_over" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">
            {state.victory ? "Victory!" : "Fight ended"}
          </h2>
          <p>{state.endReason}</p>
          {result ? (
            <>
              <p>
                {result.xpEarned} XP earned · {result.goldReward} gold{" "}
                {result.lootTable.length
                  ? "available as a reward choice"
                  : "awarded"}
              </p>
              {result.xpMultiplier !== undefined && <p className="text-sm text-muted-foreground">{Math.round(result.xpMultiplier * 1000) / 10}% XP rate applied to {Math.round((result.baseXp || 0) * 100) / 100} XP before stamina. Fractional XP carries forward.</p>}
              {result.lootTable.length > 0 && !claimed && (
                <LootRewardChoices studentId={studentId} key={result.id} lootTable={result.lootTable} goldReward={result.goldReward} claiming={claiming} onClaim={claim} />
              )}
              {claimError && <p role="alert">{claimError}</p>}
              {claimed && <p>Reward saved.</p>}
              <Button
                onClick={() => {
                  leave();
                }}
              >
                Return to lobby
              </Button>
            </>
          ) : (
            <p>Saving your results…</p>
          )}
        </div>
      )}
      </CombatOverlay>}
    </main>
  );
}

import { AllyTargetGrid } from "@/components/AllyTargetGrid";
import { StaminaBar } from "@/components/StaminaBar";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useCombatSession } from "@/hooks/useCombatSession";
import { CombatBoard } from "@/components/CombatBoard";
import { RichContentRenderer } from "@/components/RichContentRenderer";
import { MathEditor } from "@/components/MathEditor";
import { Button } from "@/components/ui/button";
import { CombatOverlay } from "@/components/CombatOverlay";
import { CombatResources } from "@/components/CombatResources";
import { CombatResolution } from "@/components/CombatResolution";
import { Swords, Sparkles, FlaskConical, Shield } from "lucide-react";
import { SUPPORT, ALLIES, selectionProblem, actionCost } from "@shared/combat/abilities";
import { JOB_TREE } from "@shared/jobSystem";
import { apiRequest, queryClient } from "@/lib/queryClient";
const names: Record<string, string> = {
  waiting: "Waiting for your teacher",
  question: "Question",
  abilities: "Block, heal, and support",
  question_resolution: "Answer resolution",
  enemy_ai: "Enemy counterattack",
  game_over: "Fight complete",
};
export default function Combat() {
  const [, navigate] = useLocation();
  const sessionId = localStorage.getItem("sessionId"),
    studentId = localStorage.getItem("studentId");
  const { state, question, results, status, error, send, seconds, serverNow } =
    useCombatSession(sessionId, "student");
  const [answer, setAnswer] = useState(""),
    [ability, setAbility] = useState("attack"),
    [target, setTarget] = useState(""),
    [math, setMath] = useState(false),
    [claimed, setClaimed] = useState(false),
    [claimError, setClaimError] = useState("");
  const p = studentId ? state?.players[studentId] : null;
  const result = results.find((r) => r.studentId === studentId);
  useEffect(() => {
    setAnswer("");
    setAbility("attack");
    setTarget("");
  }, [state?.round]);
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
        <h1 className="text-xl font-bold">Connecting to combat…</h1>
        <p role="alert">{error}</p>
        <Button className="mt-4" onClick={() => navigate("/student")}>
          Back to lobby
        </Button>
      </main>
    );
  const phase = state.currentPhase;
  const intro =
    phase === "question" &&
    !!state.questionStartTime &&
    serverNow < state.questionStartTime;
  const canAct = status === "connected" && !!p && !p.isDead;
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
    : state.enemies
        .filter((e) => e.health > 0)
        .slice(0, state.enemyDisplayMode === "consecutive" ? 1 : undefined)
        .map((e) => ({ id: e.id, name: e.name }));
  const chosen = options.some(o => o.id === target) ? target : options[0]?.id || p?.studentId || "";
  const definition = (id: string) =>
    Object.values(JOB_TREE)
      .flatMap((j) => Object.values(j.levelRewards))
      .flatMap((r) => r.abilities || [])
      .find((a) => a.id === id);
  const label = (id: string) => id === "craft_healing_potion" && p?.healingPotions === 0 ? "Create potion" : definition(id)?.name || (id === "attack" ? "Attack" : id.replaceAll("_", " "));
  const costLabel = (id: string) => {
    if (!p) return "";
    const c = actionCost(p, id);
    return [c.mp ? (id === "fireblast" ? `All MP (${c.mp})` : `${c.mp} MP`) : "", c.combo ? `${c.combo} combo` : "", c.healing ? "1 healing potion" : "", c.shield ? "1 shield potion" : ""].filter(Boolean).join(" · ") || "No cost";
  };
  const needsTarget = ALLIES.has(ability) || (!SUPPORT.has(ability) && !["craft_healing_potion", "craft_shield_potion", "pact_surge", "holy_light", "finale"].includes(ability));
  const view = intro ? "intro" : p?.isDead && ["question", "abilities"].includes(phase) ? "knocked-out" : p?.ready && ["question", "abilities"].includes(phase) ? "ready" : phase === "question" && p?.hasAnswered ? "action" : phase;
  const title = view === "intro" ? (state.round === 1 ? "Question" : "Next question") : view === "knocked-out" ? "Your party is still fighting" : view === "ready" ? "Ready — waiting for your party" : view === "action" ? "Choose your combat action" : phase === "question" ? `Question ${state.currentQuestionIndex + 1}` : names[phase];
  const claim = async (itemId?: string) => {
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
    }
  };
  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex flex-wrap justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{names[phase]}</h1>
          <p className="text-muted-foreground">
            Round {state.round} · Room {state.sessionId} · {status}
          </p>
        </div>
        {state.phaseDeadline && (
          <p aria-live="off" className="text-2xl tabular-nums">
            {seconds}s
          </p>
        )}
      </header>
      <CombatBoard state={state} />
      <CombatOverlay title={title} view={`${state.round}:${view}`} seconds={state.phaseDeadline ? seconds : null} resources={p && <div className="space-y-3"><CombatResources player={p} /><StaminaBar studentId={studentId} refreshKey={result?.id} /></div>} status={status} error={error}>
      {phase === "waiting" && <p>Your teacher will start the fight when everyone has joined.</p>}
      {intro && <p className="text-center py-8 text-lg">Get ready…</p>}
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
        ["question", "abilities"].includes(phase) && (
          <div className="space-y-4">
            <h2 className="font-semibold">
              {phase === "question"
                ? "Choose an attack or question ability"
                : "Choose support actions"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {available.map((id) => (
                <Button
                  key={id}
                  variant={ability === id ? "default" : "outline"}
                  disabled={!canAct || !!selectionProblem(p, id)}
                  title={selectionProblem(p, id) || definition(id)?.description || "Deal your base damage to an enemy."}
                  className="h-auto min-h-16 justify-start gap-3 whitespace-normal text-left"
                  onClick={() => {
                    setAbility(id);
                    setTarget("");
                  }}
                >
                  {id.includes("potion") ? <FlaskConical aria-hidden size={20} className="shrink-0" /> : id.includes("block") || id.includes("shield") ? <Shield aria-hidden size={20} className="shrink-0" /> : actionCost(p, id).mp || id.startsWith("mana") ? <Sparkles aria-hidden size={20} className="shrink-0" /> : <Swords aria-hidden size={20} className="shrink-0" />}
                  <span><span className="block font-semibold">{label(id)}</span><span className="block text-xs font-normal">{selectionProblem(p, id) || costLabel(id)}</span></span>
                </Button>
              ))}
            </div>
            {ability && (
              <>
                <p className="text-sm text-muted-foreground">{ability === "craft_healing_potion" && p.healingPotions === 0 ? "Create 1 healing potion. This action does not heal. Requires a correct answer." : definition(ability)?.description || "Deal your base damage to an enemy."}</p>
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
                  onClick={() => send("action", { ability, targetId: chosen, ready: phase === "question" })}
                  disabled={
                    !canAct || !!selectionProblem(p, ability)
                  }
                >
                  {phase === "question" ? `Confirm ${label(ability)} & Ready` : `Add ${label(ability)}`}
                </Button>
              </>
            )}
            <p className="text-sm">
              {phase === "question"
                ? `Selected: ${label(p.questionAction?.ability || "attack")}`
                : `Selected: ${p.supportActions.map((a) => label(a.ability)).join(", ") || "none"}`}
            </p>
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
              {result.xpMultiplier !== undefined && <p className="text-sm text-muted-foreground">{Math.round(result.xpMultiplier * 1000) / 10}% XP rate applied to {result.baseXp} base XP. Fractional XP carries forward.</p>}
              {result.lootTable.length > 0 && !claimed && (
                <>
                  <p>Choose one reward:</p>
                  <Button onClick={() => claim()}>
                    Claim {result.goldReward} gold
                  </Button>
                  {result.lootTable.map((item) => (
                    <Button
                      key={item.itemId}
                      variant="outline"
                      onClick={() => claim(item.itemId)}
                    >
                      Claim equipment
                    </Button>
                  ))}
                </>
              )}
              {claimError && <p role="alert">{claimError}</p>}
              {claimed && <p>Reward saved.</p>}
              <Button
                onClick={() => {
                  queryClient.invalidateQueries();
                  navigate("/student");
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
      </CombatOverlay>
    </main>
  );
}

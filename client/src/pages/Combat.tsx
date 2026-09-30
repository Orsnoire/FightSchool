import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useCombatSession } from "@/hooks/useCombatSession";
import { CombatBoard } from "@/components/CombatBoard";
import { RichContentRenderer } from "@/components/RichContentRenderer";
import { MathEditor } from "@/components/MathEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SUPPORT, ALLIES, abilityProblem } from "@shared/combat/abilities";
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
      setAbility("");
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
      (id) => SUPPORT.has(id) === (phase === "abilities"),
    ) || [];
  const options = ALLIES.has(ability)
    ? Object.values(state.players)
        .filter((x) => !x.isDead)
        .sort((a, b) => b.maxHealth - b.health - (a.maxHealth - a.health))
        .map((x) => ({
          id: x.studentId,
          name: `${x.nickname} · ${x.health}/${x.maxHealth} HP`,
        }))
    : state.enemies
        .filter((e) => e.health > 0)
        .slice(0, state.enemyDisplayMode === "consecutive" ? 1 : undefined)
        .map((e) => ({ id: e.id, name: e.name }));
  const chosen = target || options[0]?.id || p?.studentId || "";
  const label = (id: string) =>
    Object.values(JOB_TREE)
      .flatMap((j) => Object.values(j.levelRewards))
      .flatMap((r) => r.abilities || [])
      .find((a) => a.id === id)?.name || id.replaceAll("_", " ");
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
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <CombatBoard state={state} />
      {intro && (
        <div
          role="status"
          className="fixed inset-0 bg-background/90 z-50 flex items-center justify-center"
        >
          <h2 className="text-4xl font-bold animate-pulse">
            {state.round === 1 ? "Question" : "Next question"}
          </h2>
        </div>
      )}
      {phase === "question" && !intro && question && p && !p.isDead && (
        <Card className="p-5 space-y-4">
          <h2 className="text-xl font-semibold">
            Question {state.currentQuestionIndex + 1}
          </h2>
          {!p.hasAnswered ? (
            <>
              <RichContentRenderer html={question.question} />
              {question.type === "short_answer" ? (
                <>
                  <Button variant="outline" onClick={() => setMath(!math)}>
                    {math ? "Use text answer" : "Use math answer"}
                  </Button>
                  {math ? (
                    <MathEditor value={answer} onChange={setAnswer} />
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
          ) : (
            <p>Answer submitted. Choose your action, then select Ready.</p>
          )}
        </Card>
      )}
      {p &&
        canAct &&
        p.hasAnswered &&
        ["question", "abilities"].includes(phase) && (
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold">
              {phase === "question"
                ? "Choose an attack or question ability"
                : "Choose support actions"}
            </h2>
            <div className="flex flex-wrap gap-2">
              {available.map((id) => (
                <Button
                  key={id}
                  variant={ability === id ? "default" : "outline"}
                  disabled={!!abilityProblem(p, id)}
                  title={abilityProblem(p, id) || label(id)}
                  onClick={() => {
                    setAbility(id);
                    setTarget("");
                  }}
                >
                  {label(id)}
                </Button>
              ))}
            </div>
            {ability && (
              <>
                <label className="block">
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
                </label>
                <Button
                  variant="secondary"
                  onClick={() => send("action", { ability, targetId: chosen })}
                  disabled={
                    phase === "abilities" &&
                    p.supportActions.some((a) => a.ability === ability)
                  }
                >
                  Select {label(ability)}
                </Button>
              </>
            )}
            <p className="text-sm">
              {phase === "question"
                ? `Selected: ${label(p.questionAction?.ability || "attack")}`
                : `Selected: ${p.supportActions.map((a) => label(a.ability)).join(", ") || "none"}`}
            </p>
            <Button onClick={() => send("ready")} disabled={p.ready}>
              {p.ready ? "Ready" : "Ready — finish choices"}
            </Button>
          </Card>
        )}
      {p?.isDead && phase !== "game_over" && (
        <p>You are knocked out. Your party can revive you.</p>
      )}
      {["question_resolution", "enemy_ai", "game_over"].includes(phase) && (
        <Card className="p-5">
          <h2 className="font-semibold mb-3">Combat feedback</h2>
          <ul className="space-y-2" aria-live="polite">
            {state.events.map((e) => (
              <li key={e.id}>{e.message}</li>
            ))}
          </ul>
        </Card>
      )}
      {phase === "game_over" && (
        <Card className="p-6 space-y-4">
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
        </Card>
      )}
    </main>
  );
}

import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCombatSession } from "@/hooks/useCombatSession";
import { useTeacherAuth } from "@/hooks/useTeacherAuth";
import { CombatLog } from "@/components/CombatLog";
import { CombatBoard } from "@/components/CombatBoard";
import { RichContentRenderer } from "@/components/RichContentRenderer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import type { Fight } from "@shared/schema";
export default function HostFight() {
  const [, params] = useRoute("/teacher/host/:id"),
    [, navigate] = useLocation();
  const { isAuthenticated, isChecking } = useTeacherAuth();
  const fightId = params?.id;
  const [sessionId, setSessionId] = useState<string | null>(null),
    [hostingError, setHostingError] = useState("");
  const { state, question, status, error, send, seconds } = useCombatSession(
    sessionId,
    "teacher",
  );
  const { data: fight } = useQuery<Fight>({
    queryKey: [`/api/fights/${fightId}`],
    enabled: !!fightId && isAuthenticated,
  });
  useEffect(() => {
    if (!fightId || !isAuthenticated) return;
    let disposed = false;
    apiRequest("POST", `/api/fights/${fightId}/sessions`)
      .then((r) => r.json())
      .then((room) => {
        if (!disposed) setSessionId(room.sessionId);
      })
      .catch((e) => setHostingError(e.message));
    return () => {
      disposed = true;
    };
  }, [fightId, isAuthenticated]);
  if (isChecking) return <p className="p-6">Checking your session…</p>;
  if (!isAuthenticated) return <p className="p-6">Sign in to host a fight.</p>;
  const players = Object.values(state?.players || {});
  const living = players.filter(player => !player.isDead);
  const phase = state?.currentPhase;
  const phaseNames: Record<string, string> = {
    waiting: "Waiting for players", question: "Question", actions: "Combat action selection",
    abilities: "Block, heal, and support", question_resolution: "Answer resolution",
    enemy_ai: "Enemy counterattack", game_over: "Fight complete",
  };
  const active = !!phase && !["waiting", "game_over"].includes(phase);
  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-4">
      <section aria-label="Host fight controls" className="contents">
        <Card className={`sticky top-0 z-30 p-4 shadow-sm ${question && active ? "rounded-b-none" : ""}`} data-testid="host-controls">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 basis-56">
              <h1 className="text-xl sm:text-2xl font-bold break-words">{fight?.title || "Host fight"}</h1>
              <p className="mt-1 text-sm text-muted-foreground" data-testid="host-status">
                <span className="capitalize">{status}</span> · <strong className="text-foreground">{players.length} {players.length === 1 ? "player" : "players"} joined</strong>
                {state && ` · ${phaseNames[state.currentPhase]} · Round ${state.round}`}
                {phase === "question" && ` · ${living.filter(p => p.hasAnswered).length}/${living.length} answered`}
                {["actions", "abilities"].includes(phase || "") && ` · ${living.filter(p => p.ready).length}/${living.length} ready`}
              </p>
            </div>
            {sessionId && <div className="shrink-0 text-right">
              <p className="text-xs text-muted-foreground">Join code</p>
              <p className="text-2xl sm:text-3xl font-bold tracking-widest leading-tight" data-testid="text-session-code">{sessionId}</p>
            </div>}
            <Button size="sm" variant="ghost" onClick={() => navigate("/teacher")}>Dashboard</Button>
          </header>
          {state && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">{phaseNames[state.currentPhase]}</span>
              {state.phaseDeadline && <span aria-label={`${seconds} seconds remaining`} className={`rounded-lg px-3 py-1 text-2xl font-bold tabular-nums ${seconds <= 5 ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>{seconds}s</span>}
            </div>
            <div className="flex items-center gap-4">
              {phase === "waiting" && <Button disabled={status !== "connected" || !players.length} onClick={() => send("start_fight")}>Start fight</Button>}
              {active && <>
                <Button disabled={status !== "connected"} onClick={() => apiRequest("POST", `/api/combat/${sessionId}/force-question`).catch(e => setHostingError(e.message))}>Advance current phase</Button>
                <Button variant="outline" className="text-destructive border-destructive/30" disabled={status !== "connected"} onClick={() => { if (confirm("End this fight and save the students’ current progress?")) send("end_fight"); }}>End fight</Button>
              </>}
            </div>
          </div>}
          {(error || hostingError) && <p className="mt-3 text-sm text-destructive" role="alert">{error || hostingError}</p>}
        </Card>
        {question && active && <Card className="-mt-4 rounded-t-none border-t-0 p-4 sm:p-5" data-testid="host-question">
          <p className="mb-3 text-sm font-semibold text-muted-foreground">Current question · {state!.currentQuestionIndex + 1}</p>
          <RichContentRenderer html={question.question} />
        </Card>}
      </section>
      {state && <>
        {phase === "game_over" && <Card className="p-5">
          <h2 className="text-xl font-bold">{state.victory ? "Victory!" : "Fight ended"}</h2>
          <p>{state.endReason}</p>
        </Card>}
        <CombatBoard state={state} enemyAside={<CombatLog key={sessionId} events={state.events} />}
          onResurrect={status === "connected" && active ? targetId => send("resurrect", { targetId }) : undefined} />
      </>}
    </main>
  );
}

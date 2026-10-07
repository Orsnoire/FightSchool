import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCombatSession } from "@/hooks/useCombatSession";
import { useTeacherAuth } from "@/hooks/useTeacherAuth";
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
  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{fight?.title || "Host fight"}</h1>
          <p>
            {status}
            {state
              ? ` · ${state.currentPhase.replaceAll("_", " ")} · round ${state.round}`
              : ""}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/teacher")}>
          Back to dashboard
        </Button>
      </header>
      {(error || hostingError) && (
        <p className="text-destructive" role="alert">
          {error || hostingError}
        </p>
      )}
      {sessionId && (
        <Card className="p-6 text-center">
          <p>Students join with this code</p>
          <p
            className="text-4xl font-bold tracking-widest mt-2"
            data-testid="text-session-code"
          >
            {sessionId}
          </p>
        </Card>
      )}
      {state && (
        <>
          <CombatBoard state={state} onResurrect={status === "connected" && !["waiting", "game_over"].includes(state.currentPhase)
            ? (targetId) => send("resurrect", { targetId }) : undefined} />
          {state.phaseDeadline && state.currentPhase !== "question" && <p>{state.currentPhase === "actions" ? "Combat action selection" : state.currentPhase === "abilities" ? "Block, heal, and support" : "Phase"} · {seconds}s remaining</p>}
          {state.currentPhase === "waiting" ? (
            <Button
              disabled={
                status !== "connected" || !Object.keys(state.players).length
              }
              onClick={() => send("start_fight")}
            >
              Start fight
            </Button>
          ) : state.currentPhase !== "game_over" ? (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  apiRequest(
                    "POST",
                    `/api/combat/${sessionId}/force-question`,
                  ).catch((e) => setHostingError(e.message))
                }
              >
                Advance current phase
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (
                    confirm(
                      "End this fight and save the students’ current progress?",
                    )
                  )
                    send("end_fight");
                }}
              >
                End fight
              </Button>
            </div>
          ) : (
            <Card className="p-5">
              <h2 className="text-xl font-bold">
                {state.victory ? "Victory!" : "Fight ended"}
              </h2>
              <p>{state.endReason}</p>
              <Button className="mt-4" onClick={() => navigate("/teacher")}>
                Return to dashboard
              </Button>
            </Card>
          )}
          {question && state.currentPhase === "question" && (
            <Card className="p-5">
              <p className="mb-3">Current question · {seconds}s remaining</p>
              <RichContentRenderer html={question.question} />
            </Card>
          )}
          <Card className="p-5">
            <h2 className="font-semibold mb-3">Combat log</h2>
            {state.events.map((e) => (
              <p key={e.id} className="mb-2">
                {e.message}
              </p>
            ))}
          </Card>
        </>
      )}
    </main>
  );
}

import { useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { Maximize, Minimize, ChevronDown, ChevronUp } from "lucide-react";
import { useCombatSession } from "@/hooks/useCombatSession";
import { useTeacherAuth } from "@/hooks/useTeacherAuth";
import { FloatingCombatLog } from "@/components/FloatingCombatLog";
import { CombatBoard } from "@/components/CombatBoard";
import { RichContentRenderer } from "@/components/RichContentRenderer";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Fight } from "@shared/schema";
export default function HostFight() {
  const [, params] = useRoute("/teacher/host/:id"), [, navigate] = useLocation();
  const { isAuthenticated, isChecking } = useTeacherAuth();
  const fightId = params?.id;
  const [hostingGuild,setHostingGuild]=useState<string>(new URLSearchParams(window.location.search).get("guild")||"");
  const {data:hostGuilds,isError:guildError}=useQuery<Array<{id:string;name:string;limitTier:number}>>({queryKey:[`/api/fights/${fightId}/host-guilds`],enabled:!!fightId&&isAuthenticated});
  const chosenGuild=hostingGuild || (hostGuilds?.length===1?hostGuilds[0].id:"");
  const [requestedSession] = useState(() => new URLSearchParams(window.location.search).get("session"));
  const launchPending = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null), [hostingError, setHostingError] = useState("");
  const [questionOpen, setQuestionOpen] = useState(true), [fullscreen, setFullscreen] = useState(false), [blockRejoin, setBlockRejoin] = useState(false);
  const shell = useRef<HTMLElement>(null);
  const { state, question, status, error, send, seconds, rejoinRequests } = useCombatSession(sessionId, "teacher");
  const request = rejoinRequests[0];
  useEffect(() => setBlockRejoin(false), [request?.studentId]);
  useEffect(() => { const update = () => setFullscreen(document.fullscreenElement === shell.current); document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);
  const { data: fight } = useQuery<Fight>({ queryKey: [`/api/fights/${fightId}`], enabled: !!fightId && isAuthenticated });
  const sessionLookup = useQuery<{sessionId: string; status: string} | null>({
    queryKey: [`/api/fights/${fightId}/sessions${requestedSession ? `?sessionId=${encodeURIComponent(requestedSession)}` : ""}`],
    enabled: !!fightId && isAuthenticated && !sessionId,
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: "always",
  });
  const connect = (id: string) => {
    setSessionId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("session", id);
    window.history.replaceState(window.history.state, "", url);
  };
  useEffect(() => {
    if (!sessionId && !sessionLookup.isFetching && sessionLookup.data?.sessionId) connect(sessionLookup.data.sessionId);
  }, [sessionLookup.data?.sessionId, sessionLookup.isFetching, sessionId]);
  const launch = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/fights/${fightId}/sessions`, chosenGuild ? {guildId: chosenGuild} : {})).json(),
    onSuccess: room => { connect(room.sessionId); queryClient.invalidateQueries({queryKey: ["/api/fights/hosted-sessions"]}); },
    onError: (error: Error) => setHostingError(error.message),
    onSettled: () => { launchPending.current = false; },
  });
  if (isChecking) return <p className="p-6">Checking your session…</p>;
  if (!isAuthenticated) return <p className="p-6">Sign in to host a fight.</p>;
  const players = Object.values(state?.players || {}), queued = Object.values(state?.pendingPlayers || {});
  const living = players.filter(p => !p.isDead), joined = players.length + queued.length;
  const phase = state?.currentPhase;
  const phases: Record<string, string> = { waiting: "Waiting for players", question: "Question", actions: "Combat action selection", abilities: "Block, heal, and support", question_resolution: "Answer resolution", enemy_ai: "Enemy counterattack", game_over: "Fight complete" };
  const active = !!phase && !["waiting", "game_over"].includes(phase);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (shell.current?.requestFullscreen) await shell.current.requestFullscreen();
      else setHostingError("Fullscreen is unavailable in this browser. You can use the browser’s fullscreen command instead.");
    } catch { setHostingError("Fullscreen could not open. Try your browser’s fullscreen command."); }
  };
  return <main ref={shell} className="battle-shell battle-host">
    {!sessionId&&hostGuilds&&hostGuilds.length>1&&<label className="p-4">Hosting guild<select aria-label="Hosting guild" className="ml-3 border rounded p-2" value={hostingGuild} onChange={e=>setHostingGuild(e.target.value)}><option value="">Choose the class for quest credit and limits</option>{hostGuilds.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
    {!sessionId && !sessionLookup.isPending && !sessionLookup.isFetching && !sessionLookup.isError && !requestedSession && <div className="p-4"><Button
      disabled={launch.isPending || !hostGuilds || (hostGuilds.length > 1 && !chosenGuild)}
      onClick={() => { if (!launchPending.current) { launchPending.current = true; setHostingError(""); launch.mutate(); } }}>Launch Host</Button></div>}
    {sessionLookup.isError && <p role="alert" className="p-4">Could not reconnect to this session. <Button variant="outline" onClick={() => sessionLookup.refetch()}>Retry</Button></p>}
    {guildError&&<p role="alert" className="p-4">Could not load hosting guilds. Reload to try again.</p>}
    <section aria-label="Host fight controls" className="battle-host-banner" data-testid="host-controls">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-52"><h1 className="text-xl sm:text-2xl font-bold break-words">{fight?.title || "Host fight"}</h1>
          <p className="mt-1 text-xs text-[#557063]" data-testid="host-status"><span className="capitalize">{status}</span> · <strong>{joined} {joined === 1 ? "player" : "players"} joined</strong>{state && ` · ${phases[state.currentPhase]} · Round ${state.round}`}{queued.length > 0 && ` · ${queued.length} joining next round`}{phase === "question" && ` · ${living.filter(p => p.hasAnswered).length}/${living.length} answered`}{["actions", "abilities"].includes(phase || "") && ` · ${living.filter(p => p.ready).length}/${living.length} ready`}</p>
        </div>
        {sessionId && <div className="shrink-0 text-right"><p className="text-[10px] uppercase tracking-widest text-[#557063]">Join the fight</p><p className="text-2xl sm:text-3xl font-bold tracking-widest leading-tight" data-testid="text-session-code">{sessionId}</p></div>}
        <Button size="sm" variant="ghost" onClick={() => navigate("/teacher")}>Dashboard</Button>
        <Button size="sm" variant="outline" aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen combat"} onClick={toggleFullscreen}>{fullscreen ? <Minimize size={17}/> : <Maximize size={17}/>}</Button>
      </header>
      {state && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#cdd4c0] pt-3">
        <div className="flex items-center gap-3"><span className="text-xs font-semibold">{phases[state.currentPhase]}</span>{state.phaseDeadline && <span aria-label={`${seconds} seconds remaining`} className={`rounded-lg px-3 py-1 text-xl font-bold tabular-nums ${seconds <= 5 ? "bg-red-100 text-red-800" : "bg-[#e5e9d8]"}`}>{seconds}s</span>}
          {question && active && <button className="flex items-center gap-1 text-xs underline underline-offset-4" aria-expanded={questionOpen} onClick={() => setQuestionOpen(!questionOpen)}>{questionOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} {questionOpen ? "Hide question" : "Show question"}</button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">{phase === "waiting" && <Button disabled={status !== "connected" || !players.length} onClick={() => send("start_fight")}>Start fight</Button>}{active && <>
          <Button size="sm" disabled={status !== "connected"} onClick={() => apiRequest("POST", `/api/combat/${sessionId}/force-question`).catch(e => setHostingError(e.message))}>Advance current phase</Button>
          <Button size="sm" variant="outline" className="text-destructive border-destructive/30" disabled={status !== "connected"} onClick={() => { if (window.confirm("End this fight? Students receive activity XP plus base XP proportional to enemy damage and their participation. Victory gold and loot require defeating the enemies.")) send("end_fight"); }}>End fight</Button>
        </>}{phase === "waiting" && <Button size="sm" variant="outline" disabled={status !== "connected"} onClick={() => {
          if (window.confirm("End this waiting session?")) send("end_fight");
        }}>End fight</Button>}</div>
      </div>}
      {(error || hostingError) && <p role="alert" className="mt-2 text-sm text-destructive">{error || hostingError}</p>}
    </section>
    {question && active && questionOpen && <section className="battle-question" data-testid="host-question"><p className="mb-2 text-[10px] uppercase tracking-widest font-bold text-[#61705a]">Current question · {state!.currentQuestionIndex + 1}</p><RichContentRenderer html={question.question}/></section>}
    {state && <>
      {phase === "game_over" && <div className="bg-[#edf0df] px-6 py-3"><h2 className="font-bold">{state.victory ? "Victory!" : "Fight ended"}</h2><p className="text-sm">{state.endReason}</p></div>}
      <CombatBoard state={state} onResurrect={status === "connected" && active ? targetId => send("resurrect", { targetId }) : undefined} onRemove={status === "connected" && phase !== "game_over" ? targetId => {
        const player = state.players[targetId] || state.pendingPlayers?.[targetId];
        if (window.confirm(`Remove ${player?.nickname || "this player"} from the fight? They will need your approval to rejoin.`)) send("remove_player", { targetId });
      } : undefined}/>
      <FloatingCombatLog key={sessionId} events={state.events}/>
    </>}
    <Dialog.Root open={!!request && phase !== "game_over"}>
      <Dialog.Portal container={shell.current}><Dialog.Overlay className="fixed inset-0 z-[180] bg-black/30"/><Dialog.Content aria-describedby="rejoin-description" onEscapeKeyDown={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()} className="fixed left-1/2 top-1/2 z-[190] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-6 text-foreground shadow-xl">
        <Dialog.Title className="text-lg font-bold">Allow {request?.nickname} to rejoin?</Dialog.Title>
        <p id="rejoin-description" className="mt-2 text-sm text-muted-foreground">You removed this player. Allowing them restores their character for the next round.</p>
        <label className="flex items-center gap-2 mt-4 text-sm"><input type="checkbox" checked={blockRejoin} onChange={e => setBlockRejoin(e.target.checked)}/>Block future rejoin requests for this fight</label>
        <div className="flex justify-end gap-2 mt-5"><Button variant="outline" disabled={status !== "connected"} onClick={() => send("review_rejoin", { targetId: request?.studentId, decision: blockRejoin ? "block" : "deny" })}>{blockRejoin ? "Block requests" : "Deny"}</Button><Button disabled={blockRejoin || status !== "connected"} onClick={() => send("review_rejoin", { targetId: request?.studentId, decision: "allow" })}>Allow</Button></div>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </main>;
}

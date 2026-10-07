import { useCallback, useEffect, useRef, useState } from "react";
import type { CombatSnapshot, PublicQuestion } from "@shared/combat/model";
export interface EarnedResult {
  id: string;
  studentId: string;
  xpEarned: number;
  baseXp?: number;
  xpMultiplier?: number;
  staminaFightNumber?: number;
  goldReward: number;
  lootTable: Array<{ itemId: string }>;
}
export function useCombatSession(
  sessionId: string | null,
  role: "teacher" | "student",
) {
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const [admission, setAdmission] = useState<"joining" | "admitted" | "removed" | "pending" | "denied" | "blocked" | "ended">("joining");
  const [rejoinRequests, setRejoinRequests] = useState<Array<{ studentId: string; nickname: string }>>([]);
  const [state, setState] = useState<CombatSnapshot | null>(null),
    [hasLeft, setHasLeft] = useState(false),
    [isLeaving, setIsLeaving] = useState(false),
    [question, setQuestion] = useState<PublicQuestion | null>(null),
    [results, setResults] = useState<EarnedResult[]>([]),
    [status, setStatus] = useState("connecting"),
    [error, setError] = useState<string | null>(null),
    [now, setNow] = useState(Date.now());
  const socket = useRef<WebSocket | null>(null),
    leaveCommand = useRef<Record<string, unknown> | null>(null),
    pending = useRef(new Map<string, Record<string, unknown>>()),
    offset = useRef(0),
    revision = useRef(-1);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset.current), 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setState(null);
    setAdmission("joining");
    setRejoinRequests([]);
    setQuestion(null);
    setResults([]);
    setHasLeft(false);
    setIsLeaving(false);
    leaveCommand.current = null;
    setError(null);
    pending.current.clear();
    revision.current = -1;
    if (!sessionId) return;
    let disposed = false,
      retry: ReturnType<typeof setTimeout>,
      attempt = 0;
    const connect = () => {
      if (disposed) return;
      setStatus("connecting");
      const ws = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws?sessionId=${encodeURIComponent(sessionId)}`,
      );
      let replayed = false;
      socket.current = ws;
      ws.onopen = () => {
        attempt = 0;
        setStatus("connected");
        ws.send(
          JSON.stringify(leaveCommand.current || {
            type: role === "teacher" ? "host" : "join",
            commandId: crypto.randomUUID(),
          }),
        );
      };
      ws.onmessage = (e) => {
        if (disposed) return;
        let message: any;
        try {
          message = JSON.parse(e.data);
        } catch {
          return;
        }
        if ((message.type === "fight_removed" || message.type === "join_status") && message.sessionId === sessionId) {
          const next = message.type === "fight_removed" ? "removed" : message.status;
          if (!["removed", "pending", "denied", "blocked", "ended"].includes(next)) return;
          setAdmission(next);
          setState(null);
          setQuestion(null);
          pending.current.clear();
          if (next !== "pending") {
            leaveCommand.current = null;
            setIsLeaving(false);
            disposed = true;
            clearTimeout(retry);
            ws.close();
          }
          return;
        }
        if (message.type === "fight_left" && message.sessionId === sessionId) {
          disposed = true;
          clearTimeout(retry);
          pending.current.clear();
          leaveCommand.current = null;
          setIsLeaving(false);
          setHasLeft(true);
          ws.close();
          return;
        }
        if (
          message.type === "combat_state" ||
          message.type === "session_created"
        ) {
          if (!message.state || message.state.sessionId !== sessionId ||
              message.state.revision < revision.current) return;
          revision.current = message.state.revision;
          setState(message.state);
          setAdmission("admitted");
          if (role === "teacher" && message.rejoinRequests) setRejoinRequests(message.rejoinRequests);
          if (message.type === "combat_state") {
            setQuestion(message.question);
            if (message.results) setResults(message.results);
            if (message.serverTime)
              offset.current = message.serverTime - Date.now();
            if (!replayed) {
              replayed = true;
              for (const command of pending.current.values())
                ws.send(JSON.stringify(command));
            }
          }
        } else if (message.type === "command_ack") {
          pending.current.delete(message.commandId);
          setError(null);
        } else if (message.type === "protocol_error") {
          if (message.commandId === leaveCommand.current?.commandId) {
            leaveCommand.current = null;
            setIsLeaving(false);
          }
          pending.current.delete(message.commandId);
          setError(message.error);
        } else if (message.type === "game_over" && message.results)
          setResults(message.results);
        else if (message.type === "result_pending") setError(message.message);
      };
      ws.onclose = (e) => {
        if (disposed) return;
        setStatus("disconnected");
        if (e.code === 1008) {
          setError("Your session expired. Sign in again to reconnect.");
          return;
        }
        retry = setTimeout(connect, Math.min(15000, 1000 * 2 ** attempt++));
      };
      ws.onerror = () => setStatus("disconnected");
    };
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      socket.current?.close();
      socket.current = null;
    };
  }, [sessionId, role, connectionEpoch]);
  const send = useCallback(
    (type: string, payload: Record<string, unknown> = {}) => {
      if (leaveCommand.current) return;
      if (socket.current?.readyState !== WebSocket.OPEN) {
        setError("Wait for the connection to recover");
        return;
      }
      const command = {
        type,
        commandId: crypto.randomUUID(),
        round: state?.round,
        ...payload,
      };
      pending.current.set(command.commandId, command);
      socket.current.send(JSON.stringify(command));
    },
    [state?.round],
  );
  const leave = useCallback(() => {
    if (role !== "student" || leaveCommand.current) return;
    const command = { type: "leave_fight", commandId: crypto.randomUUID() };
    leaveCommand.current = command;
    pending.current.clear();
    setError(null);
    setIsLeaving(true);
    // A reconnect retries departure instead of joining the room again.
    if (socket.current?.readyState === WebSocket.OPEN)
      socket.current.send(JSON.stringify(command));
  }, [role]);
  return {
    state,
    admission,
    rejoinRequests,
    requestRejoin: () => setConnectionEpoch(n => n + 1),
    question,
    results,
    status,
    error,
    send,
    leave,
    isLeaving,
    hasLeft,
    serverNow: now,
    seconds: state?.phaseDeadline
      ? Math.max(0, Math.ceil((state.phaseDeadline - now) / 1000))
      : 0,
  };
}

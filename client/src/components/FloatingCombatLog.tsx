import { useEffect, useRef, useState } from "react";
import type { CombatEvent } from "@shared/combat/model";
import { GripHorizontal, Minus } from "lucide-react";
import { CombatLog } from "./CombatLog";
export function FloatingCombatLog({ events }: { events: CombatEvent[] }) {
  const [minimized, setMinimized] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const constrain = (x: number, y: number) => {
    const rect = panel.current?.getBoundingClientRect();
    setPosition({ x: Math.max(8, Math.min(x, window.innerWidth - (rect?.width || 340) - 8)), y: Math.max(8, Math.min(y, window.innerHeight - (rect?.height || 300) - 8)) });
  };
  useEffect(() => {
    constrain(window.innerWidth - 360, window.innerHeight - 320);
    const resize = () => setPosition(p => {
      const rect = panel.current?.getBoundingClientRect();
      return { x: Math.max(8, Math.min(p.x, window.innerWidth - (rect?.width || 340) - 8)), y: Math.max(8, Math.min(p.y, window.innerHeight - (rect?.height || 300) - 8)) };
    });
    window.addEventListener("resize", resize);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    if (panel.current) observer?.observe(panel.current);
    return () => { window.removeEventListener("resize", resize); observer?.disconnect(); };
  }, []);
  return <>
    <div ref={panel} className="battle-log-window" style={{ left: position.x, top: position.y, display: minimized ? "none" : undefined }} data-testid="floating-log">
      <div className="battle-log-title" tabIndex={0} aria-label="Move combat log with arrow keys" onKeyDown={e => {
        const delta: Record<string, number[]> = { ArrowLeft: [-20,0], ArrowRight: [20,0], ArrowUp: [0,-20], ArrowDown: [0,20] };
        if (delta[e.key]) { e.preventDefault(); constrain(position.x + delta[e.key][0], position.y + delta[e.key][1]); }
      }} onPointerDown={e => {
        if ((e.target as HTMLElement).closest("button")) return;
        drag.current = { x: e.clientX, y: e.clientY, originX: position.x, originY: position.y };
        e.currentTarget.setPointerCapture(e.pointerId);
      }} onPointerMove={e => { if (drag.current) constrain(drag.current.originX + e.clientX - drag.current.x, drag.current.originY + e.clientY - drag.current.y); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <span className="flex items-center gap-2"><GripHorizontal size={16} />Combat log</span>
        <button aria-label="Minimize combat log" className="p-1 rounded hover:bg-black/10" onClick={() => setMinimized(true)}><Minus size={17} /></button>
      </div>
      <CombatLog events={events} visible={!minimized} />
    </div>
    {minimized && <button className="battle-log-tab" onClick={() => { setMinimized(false); constrain(position.x, position.y); }}>Combat log ↗</button>}
  </>;
}

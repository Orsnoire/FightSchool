import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { PlaybackCue } from "@shared/combat/presentation";
import "./combat-effects.css";
const colors = {
  fire: "#ff6248",
  ice: "#4baaff",
  curse: "#b270ff",
  heal: "#84f5b3",
  herbalist: "#ffffff",
  block: "#ffe695",
};
function Glyph({ cue }: { cue: PlaybackCue }) {
  const effect = cue.effect,
    color = colors[effect as keyof typeof colors] || "#fff";
  return (
    <svg
      viewBox="0 0 120 120"
      className={`combat-glyph effect-${effect}`}
      aria-hidden="true"
      style={{ color }}
    >
      {effect === "sword" && <path className="slash" d="M22 98 L98 22" />}
      {effect === "claw" &&
        [0, 1, 2].map((i) => (
          <path
            key={i}
            className="slash"
            style={{ animationDelay: `${i * 45}ms` }}
            d={`M${22 + i * 18} 84 L${58 + i * 18} 48`}
          />
        ))}
      {["fire", "ice", "curse", "heal", "herbalist", "block"].includes(
        effect,
      ) &&
        (effect === "herbalist" ? [0] : [0, 1, 2]).map((i) => (
          <circle
            key={i}
            className="spell-ring"
            style={{ animationDelay: `${i * 65}ms` }}
            cx={60 + (i - 1) * (effect === "herbalist" ? 0 : 13)}
            cy={60 + (i % 2) * 12}
            r="19"
          />
        ))}
      {effect === "arrow" && (
        <g className="arrow">
          <path d="M18 85 L91 35" />
          <path d="M91 35 L80 54 M91 35 L69 39 M18 85 L16 72 M18 85 L33 86" />
        </g>
      )}
      {effect === "bard" && (
        <g className={cue.alternate ? "note-down" : "note-up"}>
          <ellipse
            cx="45"
            cy="80"
            rx="14"
            ry="10"
            fill="currentColor"
            transform="rotate(-20 45 80)"
          />
          <path
            d="M57 77 V23 Q85 33 70 48 M57 39 Q85 49 70 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
          />
        </g>
      )}
      {effect === "web" && (
        <g className="web">
          <path d="M60 0 V34 M60 34 L10 108 M60 34 L110 108 M60 34 L35 112 M60 34 L85 112 M60 34 V115 M44 57 Q60 65 76 57 M31 78 Q60 94 89 78 M15 101 Q60 120 105 101" />
        </g>
      )}
      {effect === "bite" && (
        <path
          className="fangs"
          fill="#090912"
          stroke="#fff"
          strokeWidth="1"
          d="M13 27 Q60 40 107 27 L94 69 L80 47 L73 99 L57 50 L43 99 L33 47 L22 69 Z"
        />
      )}
    </svg>
  );
}
export function BattleEffect({
  cue,
  board,
  onComplete,
}: {
  cue: PlaybackCue;
  board: RefObject<HTMLElement>;
  onComplete: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null),
    callback = useRef(onComplete);
  callback.current = onComplete;
  const [position, setPosition] = useState({ x: 0, y: 0, size: 100 });
  useLayoutEffect(() => {
    const scene = board.current,
      node = root.current;
    if (!scene || !node) return;
    const find = (id: string) =>
      scene.querySelector<HTMLElement>(
        `[data-player-id="${CSS.escape(id)}"] .battle-avatar, [data-enemy-id="${CSS.escape(id)}"]`,
      );
    const target = find(cue.event.targetId),
      actor = find(cue.event.actorId);
    if (!target) {
      callback.current(cue.event.id);
      return;
    }
    const rect = target.getBoundingClientRect(),
      bounds = scene.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2 - bounds.left,
      y: rect.top + rect.height / 2 - bounds.top,
      size: Math.max(65, Math.min(160, rect.width * 1.15)),
    });
    if (!node.animate) {
      callback.current(cue.event.id);
      return;
    }
    const animations: Animation[] = [];
    animations.push(
      node.animate(
        [
          { opacity: 0 },
          { opacity: 1, offset: 0.08 },
          { opacity: 1, offset: 0.85 },
          { opacity: 0 },
        ],
        { duration: 700, fill: "both" },
      ),
    );
    if (cue.showEffect && actor)
      animations.push(
        actor.animate(
          [
            { translate: "0 0" },
            { translate: "-4px 0" },
            { translate: "4px 0" },
            { translate: "-3px 0" },
            { translate: "0 0" },
          ],
          { duration: 220 },
        ),
      );
    if (
      ["damage", "enemy_attack"].includes(cue.event.type) &&
      cue.event.amount > 0
    ) {
      const sprite =
        target.querySelector<HTMLElement>(".battle-paperdoll") ||
        target.querySelector<HTMLElement>(":scope > img, :scope > canvas") ||
        target;
      animations.push(
        sprite.animate(
          [
            { filter: "none", translate: "0 0", offset: 0 },
            {
              filter: "sepia(1) saturate(12) hue-rotate(-45deg)",
              translate: "-4px 0",
              offset: 0.05,
            },
            {
              filter: "sepia(1) saturate(12) hue-rotate(-45deg)",
              translate: "4px 0",
              offset: 0.45,
            },
            {
              filter: "sepia(1) saturate(12) hue-rotate(-45deg)",
              translate: "-2px 0",
              offset: 0.8,
            },
            { filter: "none", translate: "0 0", offset: 1 },
          ],
          { delay: 180, duration: 280 },
        ),
      );
    }
    animations.push(...node.getAnimations({ subtree: true }));
    let active = true;
    Promise.allSettled(animations.map((a) => a.finished)).then(() => {
      if (active) callback.current(cue.event.id);
    });
    return () => {
      active = false;
      animations.forEach((a) => a.cancel());
    };
  }, [cue.event.id]);
  const number =
    cue.event.type === "heal"
      ? `+${Number(cue.event.amount.toFixed(2))}`
      : cue.event.type === "block"
        ? `BLOCK ${Number(cue.event.amount.toFixed(2))}`
        : ["damage", "enemy_attack"].includes(cue.event.type)
          ? `−${Number(cue.event.amount.toFixed(2))}`
          : "";
  return (
    <div
      ref={root}
      className="combat-cue"
      data-testid="combat-effect"
      data-effect={cue.effect}
      style={{
        left: position.x,
        top: position.y,
        width: position.size,
        height: position.size,
      }}
    >
      {cue.showEffect && <Glyph cue={cue} />}
      {number && (
        <span
          className={`combat-flying-number number-${cue.event.type}`}
          style={{
            marginLeft: `${((Number(cue.event.id.split(":").at(-1)) % 3) - 1) * 14}px`,
          }}
        >
          {number}
        </span>
      )}
    </div>
  );
}

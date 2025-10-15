import { useEffect, useState } from "react";

interface DamageNumberProps {
  amount: number;
  type: "damage" | "heal";
  onComplete?: () => void;
}

export function DamageNumber({ amount, type, onComplete }: DamageNumberProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 1000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center pointer-events-none z-50 animate-[float_1s_ease-out_forwards]`}
      data-testid={`damage-${type}`}
    >
      <span
        className={`text-4xl font-bold drop-shadow-lg ${
          type === "damage" ? "text-damage" : "text-health"
        }`}
      >
        {type === "heal" ? "+" : "-"}
        {amount}
      </span>
    </div>
  );
}

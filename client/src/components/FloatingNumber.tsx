import { motion } from "framer-motion";

interface FloatingNumberProps {
  value: number;
  type: "damage" | "heal";
  onComplete: () => void;
}

export function FloatingNumber({ value, type, onComplete }: FloatingNumberProps) {
  return (
    <motion.div
      initial={{ y: 0, opacity: 1, scale: 1 }}
      animate={{ y: -80, opacity: 0, scale: 1.5 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      onAnimationComplete={onComplete}
      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 ${
        type === "damage" ? "text-damage" : "text-health"
      } font-bold text-4xl drop-shadow-lg`}
      data-testid={`floating-number-${type}`}
    >
      {type === "damage" ? "-" : "+"}{value}
    </motion.div>
  );
}

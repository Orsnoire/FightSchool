import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { AnimationType } from "@/../../shared/ultimateAbilities";
import type { CharacterClass, Gender } from "@/../../shared/schema";

interface UltimateAnimationProps {
  playerName: string;
  ultimateName: string;
  animationType: AnimationType;
  currentClass: CharacterClass;
  currentGender: Gender;
  onComplete: () => void;
}

export function UltimateAnimation({
  playerName,
  ultimateName,
  animationType,
  currentClass,
  currentGender,
  onComplete,
}: UltimateAnimationProps) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);

  // Generate particles for animation
  useEffect(() => {
    const particleCount = animationType === "wizard" ? 30 : 20;
    const newParticles = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
    }));
    setParticles(newParticles);

    // Auto-complete after 4 seconds
    const timer = setTimeout(onComplete, 4000);
    return () => clearTimeout(timer);
  }, [onComplete, animationType]);

  // Get avatar image path based on current class and gender
  const getAvatarPath = () => {
    return `@assets/generated_images/${currentClass}_${currentGender}.png`;
  };

  // Get animation-specific colors and effects
  const getAnimationConfig = () => {
    switch (animationType) {
      case "warrior":
        return {
          primaryColor: "#ef4444", // red
          secondaryColor: "#f97316", // orange
          glowColor: "rgba(239, 68, 68, 0.5)",
          particleColor: "#fbbf24", // yellow
          effect: "slash",
        };
      case "wizard":
        return {
          primaryColor: "#8b5cf6", // purple
          secondaryColor: "#3b82f6", // blue
          glowColor: "rgba(139, 92, 246, 0.5)",
          particleColor: "#a78bfa", // light purple
          effect: "magic-circle",
        };
      case "scout":
        return {
          primaryColor: "#10b981", // green
          secondaryColor: "#fbbf24", // yellow
          glowColor: "rgba(16, 185, 129, 0.5)",
          particleColor: "#34d399", // light green
          effect: "speed-lines",
        };
      case "herbalist":
        return {
          primaryColor: "#84cc16", // lime
          secondaryColor: "#fbbf24", // gold
          glowColor: "rgba(132, 204, 22, 0.5)",
          particleColor: "#d9f99d", // light lime
          effect: "nature-aura",
        };
    }
  };

  const config = getAnimationConfig();

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      data-testid="ultimate-animation-overlay"
    >
      {/* Background gradient flash */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at center, ${config.primaryColor}22 0%, transparent 70%)`,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.5, 1, 0] }}
        transition={{ duration: 4, times: [0, 0.1, 0.3, 0.7, 1] }}
      />

      {/* Particles */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-2 h-2 rounded-full"
          style={{
            backgroundColor: config.particleColor,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            boxShadow: `0 0 10px ${config.particleColor}`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
            x: [0, (Math.random() - 0.5) * 200],
            y: [0, (Math.random() - 0.5) * 200],
          }}
          transition={{
            duration: 2,
            delay: Math.random() * 0.5,
            ease: "easeOut",
          }}
        />
      ))}

      {/* Top banner with ultimate name */}
      <motion.div
        className="absolute top-16 left-1/2 transform -translate-x-1/2 px-8 py-4 bg-gradient-to-r from-transparent via-background to-transparent"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        data-testid="ultimate-banner"
      >
        <h1 className="text-4xl md:text-6xl font-bold text-center tracking-wider">
          <span className="text-foreground">{playerName}</span>
          <span className="text-muted-foreground mx-4">uses</span>
          <span
            className="font-extrabold"
            style={{ color: config.primaryColor, textShadow: `0 0 20px ${config.glowColor}` }}
          >
            {ultimateName}!
          </span>
        </h1>
      </motion.div>

      {/* Central character avatar with glow */}
      <motion.div
        className="relative"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.8, ease: "backOut" }}
      >
        {/* Outer glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 80px 40px ${config.glowColor}, inset 0 0 40px ${config.glowColor}`,
          }}
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 360],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* Avatar container */}
        <motion.div
          className="relative w-64 h-64 md:w-96 md:h-96 rounded-full overflow-hidden border-4"
          style={{
            borderColor: config.primaryColor,
            boxShadow: `0 0 40px ${config.glowColor}`,
          }}
          animate={{
            boxShadow: [
              `0 0 40px ${config.glowColor}`,
              `0 0 80px ${config.glowColor}`,
              `0 0 40px ${config.glowColor}`,
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {/* Character sprite */}
          <img
            src={getAvatarPath()}
            alt={`${currentClass} ${currentGender}`}
            className="w-full h-full object-cover"
          />

          {/* Overlay effect based on animation type */}
          {config.effect === "slash" && (
            <motion.div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, transparent 30%, ${config.primaryColor}88 50%, transparent 70%)`,
              }}
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 0.5, delay: 0.5 }}
            />
          )}

          {config.effect === "magic-circle" && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, rotate: 0 }}
              animate={{ opacity: [0, 1, 0], rotate: 360 }}
              transition={{ duration: 2, ease: "linear" }}
            >
              <div
                className="w-full h-full border-4 rounded-full"
                style={{ borderColor: config.primaryColor }}
              />
            </motion.div>
          )}

          {config.effect === "speed-lines" && (
            <>
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute top-1/2 left-1/2 w-full h-1"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${config.primaryColor}, transparent)`,
                    transformOrigin: "left center",
                    rotate: `${i * 45}deg`,
                  }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: [0, 1.5, 0] }}
                  transition={{ duration: 0.8, delay: 0.3 + i * 0.05 }}
                />
              ))}
            </>
          )}

          {config.effect === "nature-aura" && (
            <motion.div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle, ${config.primaryColor}44 0%, transparent 70%)`,
              }}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </motion.div>
      </motion.div>

      {/* Screen shake effect for warrior types */}
      {animationType === "warrior" && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            x: [0, -10, 10, -10, 10, 0],
            y: [0, 5, -5, 5, -5, 0],
          }}
          transition={{ duration: 0.5, delay: 0.5 }}
        />
      )}
    </motion.div>
  );
}

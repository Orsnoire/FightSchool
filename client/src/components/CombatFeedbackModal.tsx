import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Check, X, Shield, Heart, Swords, Flame } from "lucide-react";
import type { ResolutionFeedback } from "@shared/schema";
import { useModalTimer } from "@/hooks/useModalTimer";

interface CombatFeedbackModalProps {
  open: boolean;
  feedback: ResolutionFeedback;
  shake?: boolean;
  onClose?: () => void;
}

export function CombatFeedbackModal({ 
  open, 
  feedback,
  shake = false,
  onClose
}: CombatFeedbackModalProps) {
  const { canSkip } = useModalTimer(3, open);

  const getIcon = () => {
    switch (feedback.type) {
      case "correct_damage":
        return <Check className="w-16 h-16 text-primary" />;
      case "incorrect_damage":
        return <X className="w-16 h-16 text-destructive" />;
      case "correct_ability":
      case "ability_damage_phase2":
        return <Flame className="w-16 h-16 text-primary" />;
      case "blocked_for_player":
        return <Shield className="w-16 h-16 text-warrior" />;
      case "got_blocked":
        return <Shield className="w-16 h-16 text-accent" />;
      case "healed_player":
        return <Heart className="w-16 h-16 text-health" />;
      default:
        return <Swords className="w-16 h-16" />;
    }
  };

  const getColor = () => {
    switch (feedback.type) {
      case "correct_damage":
      case "correct_ability":
      case "ability_damage_phase2":
        return "border-primary";
      case "incorrect_damage":
        return "border-destructive";
      case "blocked_for_player":
        return "border-warrior";
      case "got_blocked":
        return "border-accent";
      case "healed_player":
        return "border-health";
      default:
        return "border-foreground";
    }
  };

  const getMessage = () => {
    switch (feedback.type) {
      case "correct_damage":
        return `You dealt ${feedback.damage} damage to ${feedback.enemyName}!`;
      case "incorrect_damage":
        return `You took ${feedback.damage} damage from ${feedback.enemyName}!`;
      case "correct_ability":
        return `You dealt ${feedback.damage} damage to ${feedback.enemyName} with ${feedback.abilityName}!`;
      case "blocked_for_player":
        return `You blocked ${feedback.blockedDamage} damage for ${feedback.blockedPlayer}!`;
      case "got_blocked":
        return `${feedback.blockingPlayer} blocked damage for you!`;
      case "healed_player":
        return `You healed ${feedback.healedPlayer} for ${feedback.healedAmount} HP!`;
      case "ability_damage_phase2":
        return `You dealt ${feedback.damage} damage to ${feedback.enemyName} with ${feedback.abilityName}!`;
      default:
        return "Action completed!";
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent 
        className="max-w-2xl border-0 bg-transparent shadow-none p-0 [&>button]:hidden"
        data-testid={`modal-feedback-${feedback.type}`}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ 
            scale: 1, 
            opacity: 1, 
            y: 0,
            x: shake ? [0, -10, 10, -10, 10, 0] : 0
          }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={`bg-card/95 backdrop-blur-sm border-4 ${getColor()} rounded-lg p-8 shadow-2xl`}
        >
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center justify-center">
              {getIcon()}
            </div>
            <p 
              className="text-3xl font-bold text-center"
              data-testid="text-feedback-message"
            >
              {getMessage()}
            </p>
            
            {/* Skip button */}
            {canSkip && onClose && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-muted-foreground hover:text-foreground underline cursor-pointer"
                onClick={onClose}
                data-testid="button-skip-feedback"
              >
                Next →
              </motion.button>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Check, X, Shield, Heart, Swords, Flame } from "lucide-react";

interface CombatFeedbackModalProps {
  open: boolean;
  type: "correct" | "incorrect" | "blocked" | "healed" | "ability_damage" | "you_blocked" | "you_healed";
  message: string;
  shake?: boolean;
}

export function CombatFeedbackModal({ 
  open, 
  type,
  message,
  shake = false
}: CombatFeedbackModalProps) {
  const getIcon = () => {
    switch (type) {
      case "correct":
        return <Check className="w-16 h-16 text-primary" />;
      case "incorrect":
        return <X className="w-16 h-16 text-destructive" />;
      case "blocked":
      case "you_blocked":
        return <Shield className="w-16 h-16 text-warrior" />;
      case "healed":
      case "you_healed":
        return <Heart className="w-16 h-16 text-health" />;
      case "ability_damage":
        return <Flame className="w-16 h-16 text-primary" />;
      default:
        return <Swords className="w-16 h-16" />;
    }
  };

  const getColor = () => {
    switch (type) {
      case "correct":
      case "ability_damage":
        return "border-primary";
      case "incorrect":
        return "border-destructive";
      case "blocked":
      case "you_blocked":
        return "border-warrior";
      case "healed":
      case "you_healed":
        return "border-health";
      default:
        return "border-foreground";
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent 
        className="max-w-2xl border-0 bg-transparent shadow-none p-0 [&>button]:hidden"
        data-testid={`modal-feedback-${type}`}
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
              {message}
            </p>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

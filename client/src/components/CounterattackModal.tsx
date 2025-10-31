import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { motion } from "framer-motion";
import type { EnemyAIAttackData } from "@shared/schema";
import { useModalTimer } from "@/hooks/useModalTimer";

interface CounterattackModalProps {
  open: boolean;
  attack: EnemyAIAttackData;
  onClose?: () => void;
}

export function CounterattackModal({ open, attack, onClose }: CounterattackModalProps) {
  const { canSkip } = useModalTimer(3, open);
  const isBlocked = attack.blocked;
  
  return (
    <Dialog open={open}>
      <DialogContent 
        className="max-w-md border-0 bg-transparent shadow-none p-0 [&>button]:hidden"
        data-testid="modal-counterattack"
      >
        <VisuallyHidden.Root>
          <DialogTitle>Enemy Counterattack</DialogTitle>
        </VisuallyHidden.Root>
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: -20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.5, opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-4"
        >
          {/* Enemy image at 1/4 size */}
          <div className="relative">
            <motion.img 
              src={attack.enemyImage} 
              alt={attack.enemyName}
              className="w-32 h-32 object-cover rounded-lg shadow-2xl"
              data-testid="img-enemy-counterattack"
              animate={{ 
                rotate: isBlocked ? [0, -5, 5, -5, 5, 0] : [0, -10, 10, -10, 10, 0]
              }}
              transition={{ 
                duration: 0.5,
                repeat: 1
              }}
              style={{ 
                filter: isBlocked 
                  ? 'drop-shadow(0 0 15px rgba(59, 130, 246, 0.7))' 
                  : 'drop-shadow(0 0 15px rgba(220, 38, 38, 0.7))'
              }}
            />
          </div>

          {/* Attack text */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className={`
              px-6 py-4 rounded-lg shadow-2xl backdrop-blur-sm
              ${isBlocked 
                ? 'bg-blue-950/90 border-4 border-blue-500' 
                : 'bg-red-950/90 border-4 border-red-500'
              }
            `}
          >
            <p 
              className={`
                text-xl font-bold text-center
                ${isBlocked ? 'text-blue-200' : 'text-red-200'}
              `}
              data-testid="text-counterattack"
            >
              {isBlocked ? (
                <>
                  <span className="text-blue-300">{attack.blockerName}</span> blocked the attack for{" "}
                  <span className="text-blue-300">{attack.targetPlayer}</span>!
                </>
              ) : (
                <>
                  <span className="text-red-300">{attack.enemyName}</span> counterattacks{" "}
                  <span className="text-red-300">{attack.targetPlayer}</span> for{" "}
                  <span className="text-red-400 text-2xl">{attack.damage}</span> damage!
                  {attack.defendedAmount && attack.defendedAmount > 0 && (
                    <span className="block text-sm text-red-200 mt-1">
                      ({attack.defendedAmount} damage defended)
                    </span>
                  )}
                </>
              )}
            </p>
            
            {/* Skip button */}
            {canSkip && onClose && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-muted-foreground hover:text-foreground underline cursor-pointer mt-4"
                onClick={onClose}
                data-testid="button-skip-counterattack"
              >
                Next →
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

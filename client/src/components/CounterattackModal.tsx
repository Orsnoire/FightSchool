import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import type { EnemyAIAttackData } from "@shared/schema";

interface CounterattackModalProps {
  open: boolean;
  attack: EnemyAIAttackData;
}

export function CounterattackModal({ open, attack }: CounterattackModalProps) {
  const isBlocked = attack.blocked;
  
  return (
    <Dialog open={open}>
      <DialogContent 
        className="max-w-md border-0 bg-transparent shadow-none p-0 [&>button]:hidden"
        data-testid="modal-counterattack"
      >
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
                </>
              )}
            </p>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

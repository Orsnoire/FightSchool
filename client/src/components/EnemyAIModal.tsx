import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { useModalTimer } from "@/hooks/useModalTimer";

interface EnemyAIModalProps {
  open: boolean;
  allEnemies: Array<{ id: string; name: string; image: string }>;
  onClose?: () => void;
}

export function EnemyAIModal({ open, allEnemies, onClose }: EnemyAIModalProps) {
  const { canSkip } = useModalTimer(3, open);
  const isSingleEnemy = allEnemies.length === 1;
  
  return (
    <Dialog open={open}>
      <DialogContent 
        className="max-w-[90vw] max-h-[90vh] border-0 bg-black/70 backdrop-blur-md shadow-none p-0 [&>button]:hidden"
        data-testid="modal-enemy-ai"
      >
        <div className="flex items-center justify-center min-h-[70vh] p-8">
          {isSingleEnemy ? (
            // Single enemy - fills center at ~70% viewport height
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative"
            >
              <img 
                src={allEnemies[0].image} 
                alt={allEnemies[0].name}
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-2xl"
                data-testid={`img-enemy-${allEnemies[0].id}`}
                style={{ 
                  filter: 'drop-shadow(0 0 30px rgba(220, 38, 38, 0.6))'
                }}
              />
            </motion.div>
          ) : (
            // Multiple enemies - divide space equally
            <div className="flex items-center justify-center gap-8 w-full">
              {allEnemies.map((enemy, index) => (
                <motion.div
                  key={enemy.id}
                  initial={{ scale: 0.3, opacity: 0, y: 50 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.3, opacity: 0, y: 50 }}
                  transition={{ 
                    duration: 0.8, 
                    ease: "easeOut",
                    delay: index * 0.1 
                  }}
                  className="relative flex-1 flex items-center justify-center"
                  style={{ maxWidth: `${100 / allEnemies.length}%` }}
                >
                  <img 
                    src={enemy.image} 
                    alt={enemy.name}
                    className="max-h-[50vh] w-auto object-contain rounded-lg shadow-2xl"
                    data-testid={`img-enemy-${enemy.id}`}
                    style={{ 
                      filter: 'drop-shadow(0 0 20px rgba(220, 38, 38, 0.5))'
                    }}
                  />
                </motion.div>
              ))}
            </div>
          )}
          
          {/* Skip button */}
          {canSkip && onClose && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-muted-foreground hover:text-foreground underline cursor-pointer"
              onClick={onClose}
              data-testid="button-skip-enemy-ai"
            >
              Next →
            </motion.button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

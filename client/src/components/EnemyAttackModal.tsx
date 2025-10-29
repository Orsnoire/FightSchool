import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";

interface EnemyAttackModalProps {
  open: boolean;
  enemyImage?: string;
  enemyName: string;
  targetName: string;
  damage: number;
  multipleEnemies?: Array<{ name: string; image?: string }>;
}

export function EnemyAttackModal({ 
  open, 
  enemyImage,
  enemyName,
  targetName,
  damage,
  multipleEnemies
}: EnemyAttackModalProps) {
  const showMultiple = multipleEnemies && multipleEnemies.length > 1;

  return (
    <Dialog open={open}>
      <DialogContent 
        className="max-w-4xl border-0 bg-transparent shadow-none p-0 [&>button]:hidden"
        data-testid="modal-enemy-attack"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-6"
        >
          {/* Enemy Image(s) */}
          <div className={`flex ${showMultiple ? 'gap-4' : ''} items-center justify-center`}>
            {showMultiple ? (
              multipleEnemies.map((enemy, index) => (
                <motion.div
                  key={index}
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ 
                    x: 0, 
                    opacity: 1,
                    rotate: [0, -5, 5, -5, 5, 0]
                  }}
                  transition={{ 
                    delay: index * 0.1,
                    rotate: { delay: 0.2 + index * 0.1, duration: 0.4 }
                  }}
                  className="relative"
                >
                  {enemy.image ? (
                    <img 
                      src={enemy.image} 
                      alt={enemy.name}
                      className="w-32 h-32 object-cover rounded-lg border-4 border-destructive shadow-2xl filter brightness-110"
                      data-testid={`img-enemy-${index}`}
                    />
                  ) : (
                    <div className="w-32 h-32 bg-destructive/20 rounded-lg border-4 border-destructive flex items-center justify-center">
                      <span className="text-2xl font-bold text-destructive">{enemy.name[0]}</span>
                    </div>
                  )}
                </motion.div>
              ))
            ) : (
              <motion.div
                animate={{ 
                  rotate: [0, -5, 5, -5, 5, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{ duration: 0.4 }}
                className="relative"
              >
                {enemyImage ? (
                  <img 
                    src={enemyImage} 
                    alt={enemyName}
                    className="w-64 h-64 object-cover rounded-lg border-4 border-destructive shadow-2xl filter brightness-110"
                    data-testid="img-enemy"
                  />
                ) : (
                  <div className="w-64 h-64 bg-destructive/20 rounded-lg border-4 border-destructive flex items-center justify-center">
                    <span className="text-6xl font-bold text-destructive">{enemyName[0]}</span>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Attack Message */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-card/95 backdrop-blur-sm border-4 border-destructive rounded-lg p-6 shadow-2xl"
          >
            <p 
              className="text-2xl font-bold text-center text-destructive"
              data-testid="text-enemy-attack"
            >
              {enemyName} counterattacks {targetName} for {damage} damage!
            </p>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

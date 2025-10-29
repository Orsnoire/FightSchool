import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";

interface PartyDamageModalProps {
  open: boolean;
  totalDamage: number;
  enemyImage?: string;
  enemyName: string;
  multipleEnemies?: Array<{ id: string; name: string; image?: string; damage: number }>;
}

export function PartyDamageModal({ 
  open, 
  totalDamage,
  enemyImage,
  enemyName,
  multipleEnemies
}: PartyDamageModalProps) {
  const showMultiple = multipleEnemies && multipleEnemies.length > 1;

  return (
    <Dialog open={open}>
      <DialogContent 
        className="max-w-4xl border-0 bg-transparent shadow-none p-0 [&>button]:hidden"
        data-testid="modal-party-damage"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-6"
        >
          {/* Enemy Image(s) with damage shake */}
          <div className={`flex ${showMultiple ? 'gap-4' : ''} items-center justify-center`}>
            {showMultiple ? (
              multipleEnemies.map((enemy, index) => (
                <motion.div
                  key={enemy.id}
                  initial={{ scale: 1 }}
                  animate={{ 
                    x: [0, -10, 10, -10, 10, 0],
                    scale: [1, 0.95, 1]
                  }}
                  transition={{ 
                    delay: index * 0.15,
                    duration: 0.5 
                  }}
                  className="relative"
                >
                  {enemy.image ? (
                    <div className="relative">
                      <img 
                        src={enemy.image} 
                        alt={enemy.name}
                        className="w-32 h-32 object-cover rounded-lg border-4 border-damage shadow-2xl filter brightness-90"
                        data-testid={`img-enemy-${index}`}
                        style={{ 
                          filter: 'brightness(0.9) saturate(1.2) hue-rotate(-10deg)'
                        }}
                      />
                      <div className="absolute inset-0 bg-damage/30 rounded-lg animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-32 h-32 bg-damage/20 rounded-lg border-4 border-damage flex items-center justify-center">
                      <span className="text-2xl font-bold text-damage">{enemy.name[0]}</span>
                    </div>
                  )}
                  {/* Individual damage number */}
                  <motion.div
                    initial={{ y: 0, opacity: 1, scale: 1 }}
                    animate={{ y: -40, opacity: 0, scale: 1.5 }}
                    transition={{ delay: index * 0.15 + 0.2, duration: 1 }}
                    className="absolute top-0 left-1/2 -translate-x-1/2 text-3xl font-bold text-damage drop-shadow-lg"
                  >
                    -{enemy.damage}
                  </motion.div>
                </motion.div>
              ))
            ) : (
              <motion.div
                animate={{ 
                  x: [0, -10, 10, -10, 10, 0],
                  scale: [1, 0.95, 1]
                }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                {enemyImage ? (
                  <div className="relative">
                    <img 
                      src={enemyImage} 
                      alt={enemyName}
                      className="w-64 h-64 object-cover rounded-lg border-4 border-damage shadow-2xl"
                      data-testid="img-enemy"
                      style={{ 
                        filter: 'brightness(0.9) saturate(1.2) hue-rotate(-10deg)'
                      }}
                    />
                    <div className="absolute inset-0 bg-damage/30 rounded-lg animate-pulse" />
                  </div>
                ) : (
                  <div className="w-64 h-64 bg-damage/20 rounded-lg border-4 border-damage flex items-center justify-center">
                    <span className="text-6xl font-bold text-damage">{enemyName[0]}</span>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Total damage message */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-card/95 backdrop-blur-sm border-4 border-damage rounded-lg p-6 shadow-2xl"
          >
            <p 
              className="text-3xl font-bold text-center text-damage"
              data-testid="text-total-damage"
            >
              Your party dealt {totalDamage} damage to {showMultiple ? 'the enemies' : enemyName}!
            </p>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

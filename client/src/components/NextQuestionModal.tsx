import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Swords } from "lucide-react";
import { useModalTimer } from "@/hooks/useModalTimer";

interface NextQuestionModalProps {
  questionNumber: number;
  isOpen: boolean;
  onClose?: () => void;
}

export function NextQuestionModal({ questionNumber, isOpen, onClose }: NextQuestionModalProps) {
  const { canSkip } = useModalTimer(3, isOpen);
  
  return (
    <Dialog open={isOpen}>
      <DialogContent 
        className="max-w-md border-0 bg-transparent shadow-none p-0 [&>button]:hidden"
        data-testid="modal-next-question"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center"
        >
          <div className="bg-card/95 backdrop-blur-md border-2 border-yellow-500/50 rounded-lg p-10 shadow-2xl">
            <div className="flex flex-col items-center gap-4">
              <Swords className="h-12 w-12 text-yellow-500" data-testid="icon-swords" />
              <h1 
                className="text-4xl font-bold text-center text-yellow-500 drop-shadow-lg"
                data-testid="text-next-question"
              >
                Next Question
              </h1>
              <p 
                className="text-2xl font-semibold text-center text-yellow-400/90"
                data-testid="text-question-number"
              >
                Question #{questionNumber}
              </p>
              
              {/* Skip button */}
              {canSkip && onClose && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-muted-foreground hover:text-foreground underline cursor-pointer mt-2"
                  onClick={onClose}
                  data-testid="button-skip-next-question"
                >
                  Next →
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";

interface PhaseTransitionModalProps {
  open: boolean;
  phaseName: string;
  autoClose?: boolean;
  duration?: number;
}

export function PhaseTransitionModal({ 
  open, 
  phaseName,
  autoClose = true,
  duration = 3000
}: PhaseTransitionModalProps) {
  return (
    <Dialog open={open}>
      <DialogContent 
        className="max-w-md border-0 bg-transparent shadow-none p-0 [&>button]:hidden"
        data-testid="modal-phase-transition"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-center"
        >
          <div className="bg-card/95 backdrop-blur-sm border-4 border-primary rounded-lg p-12 shadow-2xl">
            <h1 
              className="text-5xl font-bold text-center text-primary drop-shadow-lg"
              data-testid="text-phase-name"
            >
              {phaseName}
            </h1>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

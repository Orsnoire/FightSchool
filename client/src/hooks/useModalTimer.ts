import { useState, useEffect } from "react";

/**
 * Custom hook to manage minimum display time for modals with skip functionality
 * @param minimumSeconds - Minimum time (in seconds) the modal must display before allowing skip/close
 * @param isOpen - Whether the modal is currently open
 * @returns Object with canSkip flag and remainingTime
 */
export function useModalTimer(minimumSeconds: number, isOpen: boolean) {
  const [canSkip, setCanSkip] = useState(false);
  const [remainingTime, setRemainingTime] = useState(minimumSeconds);

  useEffect(() => {
    if (!isOpen) {
      // Reset when modal closes
      setCanSkip(false);
      setRemainingTime(minimumSeconds);
      return;
    }

    // Start countdown
    setRemainingTime(minimumSeconds);
    setCanSkip(false);

    const interval = setInterval(() => {
      setRemainingTime((prev) => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          setCanSkip(true);
          clearInterval(interval);
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, minimumSeconds]);

  return { canSkip, remainingTime };
}

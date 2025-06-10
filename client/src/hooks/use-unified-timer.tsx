import { useState, useEffect, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";

interface UnifiedTimerState {
  timeLeft: number;
  isActive: boolean;
  stage: "inactive" | "no_interaction" | "processing";
}

export function useUnifiedTimer() {
  const [timerState, setTimerState] = useState<UnifiedTimerState>({
    timeLeft: 0,
    isActive: false,
    stage: "inactive"
  });

  // Main timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (timerState.isActive && timerState.timeLeft > 0) {
      interval = setInterval(() => {
        setTimerState(prev => {
          if (prev.timeLeft <= 1) {
            // Timer expired
            return {
              timeLeft: 0,
              isActive: false,
              stage: "inactive"
            };
          }
          return {
            ...prev,
            timeLeft: prev.timeLeft - 1
          };
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerState.isActive, timerState.timeLeft]);

  // Start 30-second no-interaction timer
  const startNoInteractionTimer = useCallback(() => {
    setTimerState({
      timeLeft: 30,
      isActive: true,
      stage: "no_interaction"
    });
  }, []);

  // Extend to 120-second processing timer when action is taken
  const extendToProcessingTimer = useCallback(() => {
    setTimerState({
      timeLeft: 120,
      isActive: true,
      stage: "processing"
    });
  }, []);

  // Stop timer
  const stopTimer = useCallback(() => {
    setTimerState({
      timeLeft: 0,
      isActive: false,
      stage: "inactive"
    });
  }, []);

  // Force refresh data when timer changes state
  useEffect(() => {
    if (!timerState.isActive && timerState.timeLeft === 0) {
      // Timer expired or stopped - refresh transaction data
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/qr-verification"] });
    }
  }, [timerState.isActive, timerState.timeLeft]);

  return {
    timeLeft: timerState.timeLeft,
    isActive: timerState.isActive,
    stage: timerState.stage,
    startNoInteractionTimer,
    extendToProcessingTimer,
    stopTimer
  };
}
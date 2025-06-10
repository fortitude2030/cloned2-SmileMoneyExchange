import { useState, useEffect, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";

interface UnifiedTimerState {
  timeLeft: number;
  isActive: boolean;
  hasInteraction: boolean;
}

export function useUnifiedTimer() {
  const [timerState, setTimerState] = useState<UnifiedTimerState>({
    timeLeft: 0,
    isActive: false,
    hasInteraction: false
  });

  // Main timer effect - single 120-second countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (timerState.isActive && timerState.timeLeft > 0) {
      interval = setInterval(() => {
        setTimerState(prev => {
          const newTimeLeft = prev.timeLeft - 1;
          
          // If no interaction and reached 30-second mark, stop timer
          if (!prev.hasInteraction && newTimeLeft === 90) {
            return {
              timeLeft: 0,
              isActive: false,
              hasInteraction: false
            };
          }
          
          // If timer reaches 0, stop
          if (newTimeLeft <= 0) {
            return {
              timeLeft: 0,
              isActive: false,
              hasInteraction: false
            };
          }
          
          return {
            ...prev,
            timeLeft: newTimeLeft
          };
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerState.isActive, timerState.timeLeft, timerState.hasInteraction]);

  // Start 120-second timer
  const startTimer = useCallback(() => {
    setTimerState({
      timeLeft: 120,
      isActive: true,
      hasInteraction: false
    });
  }, []);

  // Mark interaction (allows timer to continue past 30 seconds)
  const markInteraction = useCallback(() => {
    setTimerState(prev => ({
      ...prev,
      hasInteraction: true
    }));
  }, []);

  // Stop timer
  const stopTimer = useCallback(() => {
    setTimerState({
      timeLeft: 0,
      isActive: false,
      hasInteraction: false
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
    hasInteraction: timerState.hasInteraction,
    startTimer,
    markInteraction,
    stopTimer
  };
}
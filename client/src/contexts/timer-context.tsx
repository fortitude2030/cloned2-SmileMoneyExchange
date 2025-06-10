import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { queryClient } from "@/lib/queryClient";

interface TimerState {
  timeLeft: number;
  isActive: boolean;
  hasInteraction: boolean;
  sessionId: string; // Unique session to prevent cross-session interference
}

interface TimerContextType {
  timeLeft: number;
  isActive: boolean;
  hasInteraction: boolean;
  startTimer: () => void;
  markInteraction: () => void;
  stopTimer: () => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [timerState, setTimerState] = useState<TimerState>({
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
            setLastFinishTime(Date.now());
            return {
              timeLeft: 0,
              isActive: false,
              hasInteraction: false
            };
          }
          
          // If timer reaches 0, stop
          if (newTimeLeft <= 0) {
            setLastFinishTime(Date.now());
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

  // Track when timer finishes to prevent immediate restart
  const [lastFinishTime, setLastFinishTime] = React.useState(0);

  // Start 120-second timer
  const startTimer = useCallback(() => {
    setTimerState(prev => {
      // Prevent restarting if already active or if just finished (5 second cooldown)
      if (prev.isActive || (prev.timeLeft === 0 && Date.now() - lastFinishTime < 5000)) {
        console.log('Timer start blocked:', { 
          isActive: prev.isActive, 
          timeLeft: prev.timeLeft, 
          timeSinceFinish: Date.now() - lastFinishTime 
        });
        return prev;
      }
      
      console.log('Starting new timer');
      return {
        timeLeft: 120,
        isActive: true,
        hasInteraction: false
      };
    });
  }, [lastFinishTime]);

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

  // Don't automatically refresh queries on timer expiry to prevent flashing

  const value: TimerContextType = {
    timeLeft: timerState.timeLeft,
    isActive: timerState.isActive,
    hasInteraction: timerState.hasInteraction,
    startTimer,
    markInteraction,
    stopTimer
  };

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);
  if (context === undefined) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
}
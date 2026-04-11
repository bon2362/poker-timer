'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

type MinuteTimerState = {
  active: boolean;
  playerName: string;
  timeLeft: number;
};

type MinuteTimerContextValue = {
  state: MinuteTimerState;
  startMinute: (playerName: string) => void;
  stopMinute: () => void;
};

const MinuteTimerContext = createContext<MinuteTimerContextValue | null>(null);

const MINUTE_DURATION = 60;

export function MinuteTimerProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [timeLeft, setTimeLeft] = useState(MINUTE_DURATION);
  const endTsRef = useRef<number>(0);

  const startMinute = useCallback((name: string) => {
    setPlayerName(name);
    setTimeLeft(MINUTE_DURATION);
    endTsRef.current = Date.now() + MINUTE_DURATION * 1000;
    setActive(true);
  }, []);

  const stopMinute = useCallback(() => {
    setActive(false);
    setPlayerName('');
    setTimeLeft(MINUTE_DURATION);
    endTsRef.current = 0;
  }, []);

  // Tick every 200ms for smooth countdown
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const remaining = Math.ceil((endTsRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        setTimeLeft(0);
        // Auto-stop after a brief moment so UI can show 0:00
        setTimeout(() => {
          setActive(false);
          setPlayerName('');
          setTimeLeft(MINUTE_DURATION);
          endTsRef.current = 0;
        }, 2000);
        clearInterval(id);
      } else {
        setTimeLeft(remaining);
      }
    }, 200);
    return () => clearInterval(id);
  }, [active]);

  return (
    <MinuteTimerContext.Provider value={{ state: { active, playerName, timeLeft }, startMinute, stopMinute }}>
      {children}
    </MinuteTimerContext.Provider>
  );
}

export function useMinuteTimer(): MinuteTimerContextValue {
  const ctx = useContext(MinuteTimerContext);
  if (!ctx) throw new Error('useMinuteTimer must be used within MinuteTimerProvider');
  return ctx;
}

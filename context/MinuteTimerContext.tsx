'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { getClient } from '@/supabase/client';
import { fetchMinuteTimerState, saveMinuteTimerState } from '@/lib/supabase/minuteTimerState';

type MinuteTimerState = {
  active: boolean;
  playerName: string;
  playerId: string;
  timeLeft: number;
};

type MinuteTimerContextValue = {
  state: MinuteTimerState;
  startMinute: (playerName: string, playerId: string) => void;
  stopMinute: () => void;
};

const MinuteTimerContext = createContext<MinuteTimerContextValue | null>(null);

const MINUTE_DURATION = 60;

export function MinuteTimerProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [timeLeft, setTimeLeft] = useState(MINUTE_DURATION);
  const endTsRef = useRef<number>(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const persist = useCallback((next: { active: boolean; playerName: string; playerId: string; endTs: number }) => {
    saveQueueRef.current = saveQueueRef.current
      .catch(() => {})
      .then(() => saveMinuteTimerState(next));
  }, []);

  const applyRemoteState = useCallback((next: { active: boolean; playerName: string; playerId: string; endTs: number }) => {
    const remaining = Math.ceil((next.endTs - Date.now()) / 1000);
    if (!next.active || remaining <= 0) {
      setActive(false);
      setPlayerName('');
      setPlayerId('');
      setTimeLeft(MINUTE_DURATION);
      endTsRef.current = 0;
      return;
    }

    setPlayerName(next.playerName);
    setPlayerId(next.playerId);
    endTsRef.current = next.endTs;
    setTimeLeft(remaining);
    setActive(true);
  }, []);

  const startMinute = useCallback((name: string, id: string) => {
    const endTs = Date.now() + MINUTE_DURATION * 1000;
    setPlayerName(name);
    setPlayerId(id);
    setTimeLeft(MINUTE_DURATION);
    endTsRef.current = endTs;
    setActive(true);
    persist({ active: true, playerName: name, playerId: id, endTs });
  }, [persist]);

  const stopMinute = useCallback(() => {
    setActive(false);
    setPlayerName('');
    setPlayerId('');
    setTimeLeft(MINUTE_DURATION);
    endTsRef.current = 0;
    persist({ active: false, playerName: '', playerId: '', endTs: 0 });
  }, [persist]);

  // Restore durable minute timer state on cold start.
  useEffect(() => {
    let cancelled = false;
    fetchMinuteTimerState().then(saved => {
      if (cancelled || !saved) return;
      applyRemoteState(saved);
    });
    return () => { cancelled = true; };
  }, [applyRemoteState]);

  // Subscribe to durable DB changes from other devices.
  useEffect(() => {
    const client = getClient();
    if (!client) return;

    const channel = client
      .channel('minute-timer-state-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'minute_timer_state', filter: 'id=eq.main' },
        (payload) => {
          const row = payload.new as Record<string, unknown> | null;
          if (!row) return;
          applyRemoteState({
            active: row.active as boolean,
            playerName: (row.player_name as string | null) ?? '',
            playerId: (row.player_id as string | null) ?? '',
            endTs: Number(row.end_ts ?? 0),
          });
        }
      )
      .subscribe();

    return () => { client.removeChannel(channel); };
  }, [applyRemoteState]);

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
          setPlayerId('');
          setTimeLeft(MINUTE_DURATION);
          endTsRef.current = 0;
          persist({ active: false, playerName: '', playerId: '', endTs: 0 });
        }, 2000);
        clearInterval(id);
      } else {
        setTimeLeft(remaining);
      }
    }, 200);
    return () => clearInterval(id);
  }, [active]);

  return (
    <MinuteTimerContext.Provider value={{ state: { active, playerName, playerId, timeLeft }, startMinute, stopMinute }}>
      {children}
    </MinuteTimerContext.Provider>
  );
}

export function useMinuteTimer(): MinuteTimerContextValue {
  const ctx = useContext(MinuteTimerContext);
  if (!ctx) throw new Error('useMinuteTimer must be used within MinuteTimerProvider');
  return ctx;
}

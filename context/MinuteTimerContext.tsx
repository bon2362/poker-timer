'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { getClient } from '@/supabase/client';

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
  const fromBroadcastRef = useRef(false);
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getClient>>['channel']> | null>(null);

  // Lazily get or create channel
  function getChannel() {
    if (channelRef.current) return channelRef.current;
    const client = getClient();
    if (!client) return null;
    channelRef.current = client.channel('minute-timer', { config: { broadcast: { self: false } } });
    return channelRef.current;
  }

  // Broadcast helper — send event to other devices
  const broadcast = useCallback((event: 'minute_start' | 'minute_stop', payload: Record<string, unknown>) => {
    const ch = getChannel();
    if (ch && ch.state === 'joined') {
      ch.send({ type: 'broadcast', event, payload });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startMinute = useCallback((name: string, id: string) => {
    const endTs = Date.now() + MINUTE_DURATION * 1000;
    setPlayerName(name);
    setPlayerId(id);
    setTimeLeft(MINUTE_DURATION);
    endTsRef.current = endTs;
    setActive(true);
    broadcast('minute_start', { playerName: name, playerId: id, endTs });
  }, [broadcast]);

  const stopMinute = useCallback(() => {
    setActive(false);
    setPlayerName('');
    setPlayerId('');
    setTimeLeft(MINUTE_DURATION);
    endTsRef.current = 0;
    if (!fromBroadcastRef.current) {
      broadcast('minute_stop', {});
    }
    fromBroadcastRef.current = false;
  }, [broadcast]);

  // Subscribe to broadcast from other devices
  useEffect(() => {
    const ch = getChannel();
    if (!ch) return;

    ch.on('broadcast', { event: 'minute_start' }, ({ payload }: { payload: Record<string, unknown> }) => {
      const { playerName: name, playerId: id, endTs } = payload as {
        playerName: string; playerId: string; endTs: number;
      };
      const remaining = Math.ceil((endTs - Date.now()) / 1000);
      if (remaining <= 0) return; // already expired
      fromBroadcastRef.current = true;
      setPlayerName(name);
      setPlayerId(id);
      endTsRef.current = endTs;
      setTimeLeft(remaining);
      setActive(true);
    });

    ch.on('broadcast', { event: 'minute_stop' }, () => {
      fromBroadcastRef.current = true;
      setActive(false);
      setPlayerName('');
      setPlayerId('');
      setTimeLeft(MINUTE_DURATION);
      endTsRef.current = 0;
    });

    ch.subscribe();

    return () => { ch.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          setPlayerId('');
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

// lib/timerLog.ts
// Diagnostic log of timer changes, written to Supabase table timer_events.
// Goal: find out who/what moved the round during a game (button, auto-advance,
// another device, iOS app, a device waking up from sleep, ...).
import { getClient } from '@/supabase/client';

const DEVICE_ID_KEY = 'pokerTimerDeviceId';

let cachedDeviceId: string | null = null;

export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  let id: string | null = null;
  try {
    id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      window.localStorage.setItem(DEVICE_ID_KEY, id);
    }
  } catch {
    id = id ?? Math.random().toString(36).slice(2, 10);
  }
  cachedDeviceId = id;
  return id;
}

export function describeDevice(): string {
  if (typeof navigator === 'undefined') return 'server';
  const ua = navigator.userAgent;
  const os =
    /iPhone/.test(ua) ? 'iPhone' :
    /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' :
    /Android/.test(ua) ? 'Android' :
    /Macintosh/.test(ua) ? 'Mac' :
    /Windows/.test(ua) ? 'Windows' : 'Other';
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /YaBrowser/.test(ua) ? 'Yandex' :
    /CriOS|Chrome\//.test(ua) ? 'Chrome' :
    /FxiOS|Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' : 'Other';
  const page = typeof window !== 'undefined' ? window.location.pathname : '';
  return `${os} ${browser}, page ${page || '/'}, ${window.innerWidth}x${window.innerHeight}`;
}

export type TimerLogEvent = {
  kind: string;            // 'change' | 'wake' | 'visibility' | 'channel'
  cause?: string;          // e.g. 'user:NEXT_STAGE', 'auto_advance', 'remote:broadcast'
  fromStage?: number | null;
  toStage?: number | null;
  details?: Record<string, unknown>;
};

export function logTimerEvent(event: TimerLogEvent): void {
  if (typeof window === 'undefined') return;
  const details = { ...event.details, clientTs: Date.now() };
  if (process.env.NODE_ENV === 'development') {
    console.info('[timer-log]', event.kind, event.cause ?? '', event.fromStage, '→', event.toStage, details);
  }
  const client = getClient();
  if (!client || typeof client.rpc !== 'function') return;
  try {
    void Promise.resolve(client.rpc('log_timer_event', {
      device_id_arg: getDeviceId(),
      device_arg: describeDevice(),
      kind_arg: event.kind,
      cause_arg: event.cause ?? null,
      from_stage_arg: event.fromStage ?? null,
      to_stage_arg: event.toStage ?? null,
      details_arg: details,
    })).catch(() => {});
  } catch {
    // Logging must never break the timer.
  }
}

import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'bsp_admin';
export const ADMIN_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signAdminCookie(secret: string, nowMs: number): string {
  const payload = String(nowMs);
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyAdminCookie(value: string | undefined, secret: string, nowMs: number): boolean {
  if (!value || !secret) return false;
  const [issuedAtText, receivedSignature, ...extra] = value.split('.');
  if (!issuedAtText || !receivedSignature || extra.length > 0) return false;
  const issuedAt = Number(issuedAtText);
  if (!Number.isFinite(issuedAt) || issuedAt > nowMs || nowMs - issuedAt > ADMIN_COOKIE_MAX_AGE * 1000) return false;
  const expected = Buffer.from(signature(issuedAtText, secret));
  const received = Buffer.from(receivedSignature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

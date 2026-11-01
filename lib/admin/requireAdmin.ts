import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifyAdminCookie } from './cookie';

export async function isAdminRequest(): Promise<boolean> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const cookieStore = await cookies();
  return verifyAdminCookie(cookieStore.get(ADMIN_COOKIE)?.value, secret, Date.now());
}

export async function requireAdmin(): Promise<NextResponse | null> {
  return (await isAdminRequest()) ? null : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

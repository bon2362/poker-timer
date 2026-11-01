import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE, signAdminCookie } from '@/lib/admin/cookie';

const INVALID_LOGIN_DELAY_MS = 500;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { password } = await request.json().catch(() => ({}));
  const expectedPassword = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!expectedPassword || !secret || password !== expectedPassword) {
    await new Promise(resolve => setTimeout(resolve, INVALID_LOGIN_DELAY_MS));
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(ADMIN_COOKIE, signAdminCookie(secret, Date.now()), {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: ADMIN_COOKIE_MAX_AGE, path: '/',
  });
  return response;
}

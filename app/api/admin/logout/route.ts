import { NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/admin/cookie';

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 0, path: '/' });
  return response;
}

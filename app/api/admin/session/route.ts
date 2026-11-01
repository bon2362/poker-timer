import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin/requireAdmin';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ authenticated: await isAdminRequest() });
}

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { getServiceClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const { bucket, files } = await request.json();
  if (!['avatars', 'slideshow'].includes(bucket) || !Array.isArray(files)) return NextResponse.json({ error: 'Invalid upload request' }, { status: 400 });
  const client = getServiceClient();
  const uploads = await Promise.all(files.map(async () => {
    const path = `uploads/${randomUUID()}.jpg`;
    const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error('Could not sign upload');
    return { path, token: data.token };
  }));
  return NextResponse.json({ uploads });
}

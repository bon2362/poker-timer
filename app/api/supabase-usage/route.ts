// app/api/supabase-usage/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Supabase env vars not set' }, { status: 503 });
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/org-usage`, {
      headers: { Authorization: `Bearer ${anonKey}` },
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Edge Function ${res.status}: ${body}` }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

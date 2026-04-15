// app/api/supabase-usage/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ORG_SLUG = 'nkaxdmzhrfetvgymjqyp';

type UsageItem = {
  metric: string;
  usage: number;
  pricing_free_units?: number;
  available_in_plan: boolean;
  unlimited: boolean;
  capped: boolean;
};

const METRICS = [
  'CACHED_EGRESS',
  'EGRESS',
  'STORAGE_SIZE',
  'DATABASE_SIZE',
  'REALTIME_MESSAGE_COUNT',
  'REALTIME_PEAK_CONNECTIONS',
];

export async function GET() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'SUPABASE_ACCESS_TOKEN не задан' }, { status: 503 });
  }

  try {
    const res = await fetch(
      `https://api.supabase.com/v1/organizations/${ORG_SLUG}/usage`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Supabase API ${res.status}: ${body}` }, { status: res.status });
    }

    const json = await res.json() as { usages?: UsageItem[] };
    const usages = (json.usages ?? []).filter((u) => METRICS.includes(u.metric));

    return NextResponse.json({ usages });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

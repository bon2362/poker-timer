/**
 * push-live-activity — Supabase Edge Function
 *
 * Triggered by a Supabase Database Webhook when `timer_state` is updated.
 * Reads all registered push tokens and sends an ActivityKit remote update
 * via APNs to every active iOS Live Activity.
 *
 * ── Setup ────────────────────────────────────────────────────────────────────
 *
 * 1. Deploy this function:
 *      supabase functions deploy push-live-activity
 *
 * 2. Set environment variables (Dashboard → Settings → Edge Functions → Secrets):
 *      APNS_KEY_ID    — 10-char key ID from Apple Developer Portal
 *      APNS_TEAM_ID   — 10-char team ID from Apple Developer Portal
 *      APNS_KEY_P8    — full contents of AuthKey_<KEY_ID>.p8 (including header/footer)
 *      APNS_BUNDLE_ID — your app bundle ID, e.g. com.poker.timer
 *
 * 3. Create a Database Webhook (Dashboard → Database → Webhooks → Create):
 *      Table:  timer_state
 *      Events: UPDATE
 *      URL:    https://<project-ref>.supabase.co/functions/v1/push-live-activity
 *      Headers: Authorization: Bearer <SUPABASE_ANON_KEY>
 *
 * ── Notes ────────────────────────────────────────────────────────────────────
 * - APNs push-type must be "liveactivity"
 * - apns-topic must be "<bundle-id>.push-type.liveactivity"
 * - content-state keys must exactly match PokerTimerAttributes.ContentState
 *   (stageType, levelNum, sb, bb, isPaused, pausedTimeLeft, stageEndDate)
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimerStateRow {
  is_paused: boolean;
  anchor_ts: number;         // Unix ms
  elapsed_before_pause: number;
  stage_duration_secs: number;
  stage_type: string;        // "level" | "break"
  level_num: number;
  sb: number;
  bb: number;
  is_over: boolean;
}

interface WebhookPayload {
  type: "UPDATE";
  table: string;
  record: TimerStateRow;
  old_record: TimerStateRow;
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify webhook secret to reject requests not originating from Supabase Database Webhooks.
  // Set WEBHOOK_SECRET in Edge Function secrets (Dashboard → Settings → Edge Functions → Secrets).
  // Add the same value as a custom header in the Database Webhook config:
  //   Header: x-webhook-secret: <your-secret>
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (webhookSecret) {
    const incoming = req.headers.get("x-webhook-secret");
    if (incoming !== webhookSecret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const payload: WebhookPayload = await req.json();
  const row = payload.record;

  if (!row) {
    return new Response("No record in payload", { status: 400 });
  }

  // Fetch all registered Live Activity push tokens
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: tokens, error } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("platform", "ios_live_activity");

  if (error) {
    console.error("Failed to fetch push tokens:", error);
    return new Response("DB error", { status: 500 });
  }

  if (!tokens?.length) {
    return new Response(JSON.stringify({ sent: 0, note: "no tokens registered" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const timeLeft = calculateTimeLeft(row);
  const stageEndDate = new Date(Date.now() + timeLeft * 1000).toISOString();

  // APNs payload — must match PokerTimerAttributes.ContentState exactly
  const contentState = {
    stageType: row.stage_type,
    levelNum: row.level_num,
    sb: row.sb,
    bb: row.bb,
    isPaused: row.is_paused,
    pausedTimeLeft: timeLeft,
    stageEndDate,
  };

  const apnsBody = JSON.stringify({
    aps: {
      timestamp: Math.floor(Date.now() / 1000),
      event: "update",
      "content-state": contentState,
    },
  });

  const results = await Promise.allSettled(
    tokens.map(({ token }) => sendApnsPush(token, apnsBody))
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`APNs push: ${sent} sent, ${failed} failed`);
  return new Response(JSON.stringify({ sent, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function calculateTimeLeft(row: TimerStateRow): number {
  const { stage_duration_secs, elapsed_before_pause, is_paused, anchor_ts } = row;
  if (is_paused) {
    return Math.max(0, stage_duration_secs - Math.floor(elapsed_before_pause));
  }
  const sinceResumeSecs = (Date.now() - anchor_ts) / 1000;
  return Math.max(0, stage_duration_secs - Math.floor(elapsed_before_pause) - Math.floor(sinceResumeSecs));
}

/**
 * Send a single APNs push via HTTP/2 using JWT auth.
 *
 * Requires env vars: APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_P8, APNS_BUNDLE_ID
 */
async function sendApnsPush(deviceToken: string, body: string): Promise<void> {
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const keyP8 = Deno.env.get("APNS_KEY_P8");
  const bundleId = Deno.env.get("APNS_BUNDLE_ID");

  if (!keyId || !teamId || !keyP8 || !bundleId) {
    console.warn("APNs credentials not configured — skipping push");
    return;
  }

  const jwt = await buildApnsJwt(teamId, keyId, keyP8);
  const url = `https://api.push.apple.com/3/device/${deviceToken}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "apns-push-type": "liveactivity",
      "apns-topic": `${bundleId}.push-type.liveactivity`,
      "apns-priority": "10",
      "Content-Type": "application/json",
    },
    body,
  });

  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`APNs HTTP ${resp.status}: ${detail}`);
  }
}

/** Build a signed JWT for APNs token-based authentication (ES256). */
async function buildApnsJwt(teamId: string, keyId: string, keyP8: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "ES256", kid: keyId };
  const payload = { iss: teamId, iat: now };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  // Import ECDSA P-256 private key from PEM
  const pemBody = keyP8
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const data = new TextEncoder().encode(unsignedToken);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, cryptoKey, data);

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${unsignedToken}.${sigB64}`;
}

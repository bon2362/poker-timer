export const SPOTIFY_AUTH_KEY = 'spotifyAuth';
const PKCE_KEY = 'spotifyPkce';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
// Liked Songs need the library scopes; logins made before 6.24 don't have them.
const LIBRARY_SCOPES = ['user-library-read', 'user-library-modify'];
const SCOPES = ['streaming', 'user-read-email', 'user-read-private', 'user-read-playback-state', 'user-modify-playback-state', ...LIBRARY_SCOPES].join(' ');
const REFRESH_MARGIN_MS = 60_000;

export type SpotifyTokens = { accessToken: string; refreshToken: string; expiresAt: number; scope?: string };

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };

export function getSpotifyClientId(): string | null {
  return process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || null;
}

export function getRedirectUri(): string {
  return `${window.location.origin}/spotify/callback`;
}

export function loadTokens(): SpotifyTokens | null {
  try {
    const raw = window.localStorage.getItem(SPOTIFY_AUTH_KEY);
    return raw ? (JSON.parse(raw) as SpotifyTokens) : null;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: SpotifyTokens): void {
  try { window.localStorage.setItem(SPOTIFY_AUTH_KEY, JSON.stringify(tokens)); } catch {}
}

/** Whether the saved login lets the site read and change Liked Songs. */
export function canUseLibrary(tokens: SpotifyTokens | null = loadTokens()): boolean {
  const granted = tokens?.scope?.split(' ') ?? [];
  return LIBRARY_SCOPES.every(s => granted.includes(s));
}

export function clearTokens(): void {
  try { window.localStorage.removeItem(SPOTIFY_AUTH_KEY); } catch {}
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function startSpotifyLogin(): Promise<void> {
  const clientId = getSpotifyClientId();
  if (!clientId) return;
  const verifier = randomString(64);
  const state = randomString(16);
  const challenge = await sha256Base64Url(verifier);
  window.localStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });
  window.location.assign(`${AUTHORIZE_URL}?${params}`);
}

class TokenRequestError extends Error {
  constructor(public status: number) {
    super(`Spotify token request failed: ${status}`);
  }
}

async function requestTokens(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new TokenRequestError(res.status);
  return res.json();
}

function toTokens(data: TokenResponse, previous: Pick<SpotifyTokens, 'refreshToken' | 'scope'>, now: number): SpotifyTokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? previous.refreshToken,
    expiresAt: now + data.expires_in * 1000,
    scope: data.scope ?? previous.scope,
  };
}

export async function completeSpotifyLogin(params: URLSearchParams): Promise<void> {
  if (params.get('error') === 'access_denied') throw new Error('Вход в Spotify отменён');
  if (params.get('error')) throw new Error('Spotify не разрешил вход');

  const clientId = getSpotifyClientId();
  const code = params.get('code');
  let pkce: { verifier: string; state: string } | null = null;
  try {
    const raw = window.localStorage.getItem(PKCE_KEY);
    pkce = raw ? JSON.parse(raw) : null;
  } catch {}

  if (!clientId || !code || !pkce || pkce.state !== params.get('state')) {
    throw new Error('Не удалось завершить вход в Spotify. Попробуйте подключить ещё раз.');
  }

  let data: TokenResponse;
  try {
    data = await requestTokens({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      client_id: clientId,
      code_verifier: pkce.verifier,
    });
  } catch {
    throw new Error('Spotify не выдал доступ. Попробуйте подключить ещё раз.');
  }
  saveTokens(toTokens(data, { refreshToken: '' }, Date.now()));
  window.localStorage.removeItem(PKCE_KEY);
}

let refreshInFlight: Promise<string | null> | null = null;

export async function getValidAccessToken(now: number = Date.now()): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens) return null;
  if (tokens.expiresAt - now > REFRESH_MARGIN_MS) return tokens.accessToken;

  const clientId = getSpotifyClientId();
  if (!clientId) return null;

  if (!refreshInFlight) {
    refreshInFlight = requestTokens({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: clientId,
    })
      .then(data => {
        const next = toTokens(data, tokens, now);
        saveTokens(next);
        return next.accessToken;
      })
      .catch((e: unknown) => {
        // Only a rejected refresh token means the login is gone; network blips and 5xx are retried on the next call.
        if (e instanceof TokenRequestError && (e.status === 400 || e.status === 401)) clearTokens();
        return null;
      })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

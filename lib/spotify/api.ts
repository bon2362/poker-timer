const API = 'https://api.spotify.com/v1';

export type SpotifyPlaylistItem = { uri: string; name: string; owner: string; imageUrl: string | null };

export class SpotifyApiError extends Error {
  constructor(public status: number) {
    super(`Spotify API error ${status}`);
  }
}

type PlaylistResponse = {
  uri: string;
  name: string;
  owner?: { display_name?: string };
  images?: { url: string }[] | null;
} | null;

export async function searchPlaylists(token: string, query: string): Promise<SpotifyPlaylistItem[]> {
  // Apps in Spotify development mode may request at most 10 search results.
  const params = new URLSearchParams({ q: query, type: 'playlist', limit: '10' });
  const res = await fetch(`${API}/search?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new SpotifyApiError(res.status);
  const data: { playlists?: { items?: PlaylistResponse[] } } = await res.json();
  return (data.playlists?.items ?? [])
    .filter((item): item is NonNullable<PlaylistResponse> => Boolean(item))
    .map(item => ({
      uri: item.uri,
      name: item.name,
      owner: item.owner?.display_name ?? '',
      imageUrl: item.images?.[0]?.url ?? null,
    }));
}

export async function playContext(token: string, deviceId: string, contextUri: string): Promise<void> {
  const res = await fetch(`${API}/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ context_uri: contextUri }),
  });
  if (!res.ok) throw new SpotifyApiError(res.status);
}

export async function setShuffle(token: string, deviceId: string, state: boolean): Promise<void> {
  const params = new URLSearchParams({ state: String(state), device_id: deviceId });
  const res = await fetch(`${API}/me/player/shuffle?${params}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new SpotifyApiError(res.status);
}

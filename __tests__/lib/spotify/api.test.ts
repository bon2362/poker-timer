import { isTrackLiked, setShuffle, setTrackLiked, SpotifyApiError } from '@/lib/spotify/api';

describe('setShuffle', () => {
  afterEach(() => jest.restoreAllMocks());

  it('turns shuffle on for this device', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    await setShuffle('tok', 'dev 1', true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.spotify.com/v1/me/player/shuffle?state=true&device_id=dev+1');
    expect(init).toMatchObject({ method: 'PUT', headers: { Authorization: 'Bearer tok' } });
  });

  it('reports a refused request', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 }) as unknown as typeof fetch;
    await expect(setShuffle('tok', 'dev', false)).rejects.toEqual(new SpotifyApiError(403));
  });
});

describe('Liked Songs', () => {
  it('checks and removes a track by its URI', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [true] })
      .mockResolvedValueOnce({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(isTrackLiked('tok', 'spotify:track:abc')).resolves.toBe(true);
    await setTrackLiked('tok', 'spotify:track:abc', false);

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.spotify.com/v1/me/library/contains?uris=spotify%3Atrack%3Aabc');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.spotify.com/v1/me/library?uris=spotify%3Atrack%3Aabc');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
  });
});

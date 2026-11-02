import { getValidAccessToken, loadTokens, saveTokens } from '@/lib/spotify/auth';

describe('getValidAccessToken', () => {
  beforeEach(() => {
    window.localStorage.clear();
    process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID = 'cid';
  });

  test('refreshes an expiring token and keeps the old refresh token when none is returned', async () => {
    saveTokens({ accessToken: 'old', refreshToken: 'r1', expiresAt: 1_000_000 + 30_000 });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'new', expires_in: 3600 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(getValidAccessToken(1_000_000)).resolves.toBe('new');

    const body = String(fetchMock.mock.calls[0][1].body);
    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('refresh_token=r1');
    expect(loadTokens()).toEqual({ accessToken: 'new', refreshToken: 'r1', expiresAt: 1_000_000 + 3_600_000 });
  });
});

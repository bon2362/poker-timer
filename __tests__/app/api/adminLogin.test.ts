/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/login/route';

function request(password: string) {
  return new NextRequest('http://localhost/api/admin/login', {
    method: 'POST', body: JSON.stringify({ password }), headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/admin/login', () => {
  const original = { ADMIN_PASSWORD: process.env.ADMIN_PASSWORD, ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET };

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'correct-password';
    process.env.ADMIN_SESSION_SECRET = 'cookie-secret';
  });
  afterAll(() => Object.assign(process.env, original));

  test('sets a secure httpOnly lax cookie for the correct password', async () => {
    const response = await POST(request('correct-password'));
    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('bsp_admin=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=lax');
    expect(cookie).toContain('Max-Age=31536000');
  });

  test('rejects incorrect or unavailable passwords without a cookie', async () => {
    expect((await POST(request('wrong'))).status).toBe(401);
    delete process.env.ADMIN_PASSWORD;
    const response = await POST(request('correct-password'));
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});

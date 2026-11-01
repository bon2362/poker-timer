/** @jest-environment node */
import { ADMIN_COOKIE_MAX_AGE, signAdminCookie, verifyAdminCookie } from '@/lib/admin/cookie';

describe('admin cookie signature', () => {
  test('accepts only an unmodified current signature made with the same secret', () => {
    const now = 1_700_000_000_000;
    const value = signAdminCookie('test-secret', now);
    expect(verifyAdminCookie(value, 'test-secret', now)).toBe(true);
    expect(verifyAdminCookie(`${value}x`, 'test-secret', now)).toBe(false);
    expect(verifyAdminCookie(value, 'other-secret', now)).toBe(false);
    expect(verifyAdminCookie(undefined, 'test-secret', now)).toBe(false);
    expect(verifyAdminCookie(value, 'test-secret', now + (ADMIN_COOKIE_MAX_AGE + 1) * 1000)).toBe(false);
  });
});

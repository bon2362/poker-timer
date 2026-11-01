import { getSpecialImageUrl } from '@/lib/supabase/imageVariants';

jest.mock('@/supabase/client', () => ({ getClient: jest.fn(() => null) }));

test('returns null when no current player image exists', async () => {
  await expect(getSpecialImageUrl('winner', 'p1')).resolves.toBeNull();
});

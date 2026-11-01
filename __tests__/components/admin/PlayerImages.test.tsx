import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerManager } from '@/components/PlayerManager/PlayerManager';
const mockRemoveImage = jest.fn();
jest.mock('@/context/GameContext', () => ({ useGame: () => ({ players: [{ id: 'p1', name: 'Тестовый игрок', avatarUrl: null }], activeSession: null }) }));
jest.mock('@/lib/supabase/winnerImage', () => ({ getWinnerThumbUrl: async () => '/neutral.jpg', deleteWinnerImage: () => mockRemoveImage(), uploadWinnerImage: jest.fn() }));
jest.mock('@/lib/supabase/loserImage', () => ({ getLoserThumbUrl: async () => null, deleteLoserImage: jest.fn(), uploadLoserImage: jest.fn() }));
test('image deletion failure is shown and the thumbnail is preserved', async () => {
  mockRemoveImage.mockRejectedValue(new Error('unavailable')); jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<PlayerManager />); fireEvent.click(await screen.findByTitle('Удалить изображение'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось удалить изображение');
  expect(screen.getByTitle('Заменить изображение победителя')).toBeInTheDocument();
});

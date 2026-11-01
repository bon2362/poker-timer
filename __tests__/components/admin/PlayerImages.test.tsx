import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerManager } from '@/components/PlayerManager/PlayerManager';
const mockRemoveImage = jest.fn();
jest.mock('@/context/GameContext', () => ({ useGame: () => ({ players: [{ id: 'p1', name: 'Тестовый игрок', avatarUrl: null }], activeSession: null }) }));
jest.mock('@/lib/supabase/winnerImage', () => ({ getWinnerThumbUrl: async () => '/neutral.jpg', getWinnerImageUrl: async () => '/neutral.jpg', deleteWinnerImage: () => mockRemoveImage(), uploadWinnerImage: jest.fn() }));
jest.mock('@/lib/supabase/loserImage', () => ({ getLoserThumbUrl: async () => null, getLoserImageUrl: async () => null, deleteLoserImage: jest.fn(), uploadLoserImage: jest.fn() }));
test('image deletion failure is shown and the thumbnail is preserved', async () => {
  mockRemoveImage.mockRejectedValue(new Error('unavailable')); jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<PlayerManager />); fireEvent.click(screen.getByRole('button', { name: 'Открыть карточку: Тестовый игрок' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Удалить: Победитель' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось удалить изображение');
  expect(screen.getByAltText('Победитель: Тестовый игрок')).toBeInTheDocument();
});
test('player card labels both images as being for future games', async () => {
  render(<PlayerManager />); fireEvent.click(screen.getByRole('button', { name: 'Открыть карточку: Тестовый игрок' }));
  expect(await screen.findByRole('button', { name: 'Заменить' })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Загрузить' })).toBeInTheDocument();
  expect(screen.getAllByText('для будущих игр')).toHaveLength(2);
  expect(screen.getAllByText('Будет показана в следующих играх, прошедшие не изменятся.')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Свернуть' }));
  expect(screen.getByRole('button', { name: 'Открыть карточку: Тестовый игрок' })).toBeInTheDocument();
});

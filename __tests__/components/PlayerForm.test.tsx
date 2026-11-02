import { render, screen, fireEvent, act } from '@testing-library/react';
import { useGame } from '@/context/GameContext';
import { PlayerForm } from '@/components/PlayerManager/PlayerForm';
import type { Player } from '@/types/game';

jest.mock('@/context/GameContext', () => ({ useGame: jest.fn() }));
jest.mock('@/lib/supabase/storage', () => ({ uploadAvatar: jest.fn() }));
jest.mock('@/components/PlayerManager/AvatarCropper', () => ({
  AvatarCropper: ({ onSave, onCancel }: { onSave: (b: Blob) => void; onCancel: () => void }) => (
    <div data-testid="avatar-cropper">
      <button onClick={() => onSave(new Blob(['img']))}>Crop Save</button>
      <button onClick={onCancel}>Crop Cancel</button>
    </div>
  ),
}));

const mockPlayer: Player = {
  id: 'player-1',
  name: 'Alice',
  avatarUrl: null,
  createdAt: '2024-01-01',
};


function setupMocks() {
  const mockAddPlayer = jest.fn().mockResolvedValue({ id: 'new-player', name: 'Test', avatarUrl: null, createdAt: '' });
  const mockUpdatePlayer = jest.fn().mockResolvedValue(undefined);
  (useGame as jest.Mock).mockReturnValue({ addPlayer: mockAddPlayer, updatePlayer: mockUpdatePlayer });
  return { mockAddPlayer, mockUpdatePlayer };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('shows actual avatar upload progress and keeps the form open after failure', async () => {
  setupMocks();
  const { uploadAvatar } = jest.requireMock('@/lib/supabase/storage');
  let complete: (result: null) => void = () => {};
  uploadAvatar.mockImplementation((_id: string, _blob: Blob, progress: (percent: number) => void) => {
    progress?.(37);
    return new Promise<null>(resolve => { complete = resolve; });
  });
  render(<PlayerForm player={mockPlayer} onDone={jest.fn()} />);
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['photo'], 'avatar.jpg')] } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Crop Save' })); });
  expect(screen.getByRole('progressbar', { name: 'Загрузка аватарки' })).toHaveAttribute('value', '37');
  expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  await act(async () => complete(null));
  expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить аватарку');
  expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled();
});

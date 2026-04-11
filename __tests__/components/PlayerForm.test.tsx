import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useGame } from '@/context/GameContext';
import { PlayerForm } from '@/components/PlayerManager/PlayerForm';
import type { Player } from '@/types/game';

jest.mock('@/context/GameContext', () => ({ useGame: jest.fn() }));
jest.mock('@/lib/supabase/storage', () => ({ uploadAvatar: jest.fn() }));
jest.mock('@/components/PlayerManager/AvatarCropper', () => ({ AvatarCropper: () => null }));

const mockPlayer: Player = {
  id: 'player-1',
  name: 'Alice',
  avatarUrl: null,
  createdAt: '2024-01-01',
};

const mockPlayerWithAvatar: Player = {
  ...mockPlayer,
  avatarUrl: 'https://example.com/avatar.jpg',
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

describe('PlayerForm', () => {
  test('renders "Добавить" button when no player prop', () => {
    setupMocks();
    render(<PlayerForm onDone={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeInTheDocument();
  });

  test('renders "Сохранить" button when player prop provided', () => {
    setupMocks();
    render(<PlayerForm player={mockPlayer} onDone={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
  });

  test('Save button is disabled when name is empty', () => {
    setupMocks();
    render(<PlayerForm onDone={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeDisabled();
  });

  test('Save button is enabled when name has text', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<PlayerForm onDone={jest.fn()} />);
    await user.type(screen.getByPlaceholderText('Имя игрока'), 'Bob');
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeEnabled();
  });

  test('clicking Отмена calls onDone', async () => {
    setupMocks();
    const onDone = jest.fn();
    const user = userEvent.setup();
    render(<PlayerForm onDone={onDone} />);
    await user.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('typing name and clicking Добавить calls addPlayer with name, then onDone on success', async () => {
    const { mockAddPlayer } = setupMocks();
    const onDone = jest.fn();
    const user = userEvent.setup();
    render(<PlayerForm onDone={onDone} />);
    await user.type(screen.getByPlaceholderText('Имя игрока'), 'Bob');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(mockAddPlayer).toHaveBeenCalledWith('Bob');
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  test('pressing Enter in name field triggers save', async () => {
    const { mockAddPlayer } = setupMocks();
    const onDone = jest.fn();
    const user = userEvent.setup();
    render(<PlayerForm onDone={onDone} />);
    const input = screen.getByPlaceholderText('Имя игрока');
    await user.type(input, 'Charlie');
    await user.keyboard('{Enter}');
    expect(mockAddPlayer).toHaveBeenCalledWith('Charlie');
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  test('when player provided, shows avatar upload button', () => {
    setupMocks();
    render(<PlayerForm player={mockPlayer} onDone={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Загрузить аватарку/i })).toBeInTheDocument();
  });

  test('when no player, does not show avatar button', () => {
    setupMocks();
    render(<PlayerForm onDone={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /аватарку/i })).not.toBeInTheDocument();
  });

  test('shows "Заменить аватарку" when player.avatarUrl is set', () => {
    setupMocks();
    render(<PlayerForm player={mockPlayerWithAvatar} onDone={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Заменить аватарку/i })).toBeInTheDocument();
  });
});

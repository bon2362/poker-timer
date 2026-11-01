import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ResultsEditor } from '@/components/admin/ResultsEditor';
import { PhotoUploader } from '@/components/admin/PhotoUploader';
import { PhotoGallery } from '@/components/admin/PhotoGallery';
import { DeleteGame } from '@/components/admin/DeleteGame';
import { uploadPhoto } from '@/lib/admin/photoUpload';
import type { Session, SessionPlayer } from '@/types/game';
jest.mock('@/lib/admin/photoUpload', () => ({ uploadPhoto: jest.fn() }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }));
jest.mock('next/image', () => ({ __esModule: true, default: (props: Record<string, unknown>) => <img {...props} /> }));
const session = { id: 'game', slug: 'game-slug', buyIn: 1000, rebuyCost: 1000, addonCost: 1000, maxRebuys: 1, prizeSpots: 1, prizePcts: [100], status: 'finished' } as Session;
const players = [{ id: 'one', sessionId: 'game', playerId: 'p1', finishPosition: 1, rebuys: 1, hasAddon: false, payout: 3000 }, { id: 'two', sessionId: 'game', playerId: 'p2', finishPosition: 2, rebuys: 0, hasAddon: false, payout: 0 }] as SessionPlayer[];
const names = { p1: 'Тестовый игрок', p2: 'Другой игрок' };
beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn(); });
test('rebuy controls cannot exceed maxRebuys and payouts update before save', () => {
  render(<ResultsEditor session={session} players={players} names={names} />);
  expect(screen.getByRole('button', { name: 'Добавить ребай: Тестовый игрок' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Добавить ребай: Другой игрок' }));
  expect(screen.getByRole('button', { name: 'Добавить ребай: Другой игрок' })).toBeDisabled();
  expect(screen.getByText(/3 000 → 4 000/)).toBeInTheDocument();
});
test('results save uses the protected endpoint and shows a Russian error', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ error: 'Вход истёк. Войдите снова.' }) });
  render(<ResultsEditor session={session} players={players} names={names} />);
  fireEvent.click(screen.getByRole('button', { name: 'Добавить ребай: Другой игрок' }));
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Вход истёк');
  expect(fetch).toHaveBeenCalledWith('/api/admin/games/game/results', expect.objectContaining({ method: 'PATCH' }));
});
test('five uploads with two failures retain successes and retry only failures', async () => {
  const mocked = jest.mocked(uploadPhoto); mocked.mockImplementation(async file => { if (file.name.startsWith('bad')) throw new Error('Не удалось загрузить фото'); });
  render(<PhotoUploader sessionId="game" onUploaded={jest.fn()} />);
  const files = ['good1.jpg', 'bad1.jpg', 'good2.jpg', 'bad2.jpg', 'good3.jpg'].map(name => new File(['x'], name, { type: 'image/jpeg' }));
  fireEvent.change(screen.getByLabelText('Загрузить фото'), { target: { files } });
  await waitFor(() => expect(screen.getAllByText('готово')).toHaveLength(3));
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  expect(mocked).toHaveBeenCalledTimes(5);
  mocked.mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole('button', { name: 'Повторить неудачные' }));
  await waitFor(() => expect(screen.getAllByText('готово')).toHaveLength(5));
  expect(mocked).toHaveBeenCalledTimes(7);
  expect(mocked.mock.calls.slice(5).map(call => call[0].name).sort()).toEqual(['bad1.jpg', 'bad2.jpg']);
});
test('the upload queue never sends more than three files at the same time', async () => {
  let active = 0; let peak = 0; const release: (() => void)[] = [];
  jest.mocked(uploadPhoto).mockImplementation(() => new Promise<void>(resolve => { active++; peak = Math.max(peak, active); release.push(() => { active--; resolve(); }); }));
  render(<PhotoUploader sessionId="game" onUploaded={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Загрузить фото'), { target: { files: Array.from({ length: 5 }, (_, i) => new File(['x'], `${i}.jpg`)) } });
  await waitFor(() => expect(release).toHaveLength(3));
  release.shift()!(); await waitFor(() => expect(jest.mocked(uploadPhoto)).toHaveBeenCalledTimes(4));
  while (release.length) release.shift()!();
  await waitFor(() => expect(jest.mocked(uploadPhoto)).toHaveBeenCalledTimes(5));
  while (release.length) release.shift()!();
  await waitFor(() => expect(screen.getAllByText('готово')).toHaveLength(5)); expect(peak).toBe(3);
});
test('photo deletion names both places and does nothing before confirmation', async () => {
  render(<PhotoGallery initialPhotos={[{ id: 'photo', session_id: 'game', path: 'full.jpg', thumb_path: 'thumb.jpg', taken_at: null, width: 100, height: 100 }]} total={1} sessionId="game" games={[]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Действия с фото' }));
  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
  expect(screen.getByText('Фото исчезнет и со страницы игры, и из карусели.')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
test('deleting a game requires confirmation and explains preservation of photos', () => {
  render(<DeleteGame id="game" date="31 октября 2026" />);
  fireEvent.click(screen.getByRole('button', { name: 'Удалить игру…' }));
  expect(screen.getByText('Игра будет удалена навсегда, её фото останутся в карусели.')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

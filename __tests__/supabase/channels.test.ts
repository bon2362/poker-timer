import type { RealtimeChannel } from '@supabase/supabase-js';

let finishRemoval: () => void = () => {};
const removeChannel = jest.fn(() => new Promise<'ok'>(resolve => { finishRemoval = () => resolve('ok'); }));
jest.mock('@/supabase/client', () => ({ getClient: () => ({ removeChannel }) }));

import { subscribeChannel } from '@/supabase/channels';

test('a page opened while the previous one is still leaving subscribes only after the removal finishes', async () => {
  const subscribe = jest.fn();
  const create = () => ({ subscribe }) as unknown as RealtimeChannel;

  const leave = subscribeChannel('app-config-sync', create);
  expect(subscribe).toHaveBeenCalledTimes(1);

  leave();
  subscribeChannel('app-config-sync', create);
  expect(subscribe).toHaveBeenCalledTimes(1);

  finishRemoval();
  await Promise.resolve();
  await Promise.resolve();
  expect(subscribe).toHaveBeenCalledTimes(2);
});

'use client';
import { GameProvider } from '@/context/GameContext';
import { TimerProvider, useTimer } from '@/context/TimerContext';
import { DisplayTab, TournamentTab } from '@/components/SettingsScreen';

export type AdminTimerTabName = 'tournament' | 'display';

function TabContent({ tab }: { tab: AdminTimerTabName }) {
  const { state, dispatch, configReady } = useTimer();
  // The forms copy the config once, so they wait for the saved settings instead of the local cache.
  if (!configReady) return <p className="py-10 text-center text-sm text-[#888]">Загружаем настройки…</p>;
  if (tab === 'display') return <DisplayTab config={state.config} onDisplaySave={config => dispatch({ type: 'SAVE_DISPLAY_CONFIG', config })} />;
  return <>
    <div className="flex justify-end px-6 pt-2"><button onClick={() => dispatch({ type: 'JUMP_TO_END' })} title="Перемотать к последней минуте (для теста)" className="rounded border border-[#333] px-[7px] py-[3px] text-[11px] text-[#555] hover:border-[#555] hover:text-[#888]">1:05</button></div>
    <TournamentTab config={state.config} onSave={config => dispatch({ type: 'SAVE_SETTINGS', config })} />
  </>;
}

// Connects like any other device: changes reach the timer through the shared state. Sounds stay on the timer screen.
export default function AdminTimerTab({ tab }: { tab: AdminTimerTabName }) {
  return <GameProvider><TimerProvider silent><div className="-mx-3 -mt-5 sm:-mx-6 sm:-mt-6"><TabContent tab={tab} /></div></TimerProvider></GameProvider>;
}

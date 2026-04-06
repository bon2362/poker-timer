// components/SettingsScreen.tsx
'use client';
import { useState, Fragment } from 'react';
import type { Config, BlindLevel, SoundEvent } from '@/types/timer';
import { DEFAULT_CONFIG } from '@/lib/storage';
import { playSound } from '@/lib/audio';
import { PlayerManager } from './PlayerManager/PlayerManager';
import { SessionSetup } from './SessionSetup/SessionSetup';

const CHANGELOG = [
  {
    version: '4.7',
    date: "06 April '26",
    notes: 'Фикс порядка игроков: теперь порядок не меняется после ребаев/аддонов при перезагрузке страницы.',
  },
  {
    version: '4.6',
    date: "06 April '26",
    notes: 'Мобильная панель администратора: двойной тап по блайндам открывает управление игрой (ребаи, аддоны, вылеты, победитель). При перезагрузке сбрасывается.',
  },
  {
    version: '4.5',
    date: "06 April '26",
    notes: 'Публичная мобильная страница: таймер, блайнды и кнопка Play/Pause для зрителей с телефона. Без настроек и панели управления.',
  },
  {
    version: '4.4',
    date: "06 April '26",
    notes: 'Корректировка ребаев/аддонов (кнопки ±). Отмена вылета игрока. Упрощённое меню вылета. Залипающая кнопка сохранения настроек. Ненавязчивая иконка настроек.',
  },
  {
    version: '4.3',
    date: "06 April '26",
    notes: 'Anchor-based таймер: точное восстановление после перезагрузки, синхронизация между устройствами без прыжков. Панель Фонд — кликабельная область. Заблокированные настройки при активной сессии.',
  },
  {
    version: '4.2',
    date: "05 April '26",
    notes: 'Управление игроками с аватарками. Настройка игровой сессии (взносы, стеки, ребай, аддон, призы). Live-трекинг: вылеты, ребаи, аддоны. Авторасчёт банка и выплат. Экран победителя.',
  },
  {
    version: '4.1',
    date: "05 April '26",
    notes: 'Авто-скрытие управления при неактивности мыши. Крупные блайнды. Следующие блайнды внизу экрана. Кнопка 1:05 перенесена в настройки.',
  },
  {
    version: '4.0',
    date: "05 April '26",
    notes: 'Переезд на Next.js 15 App Router + TypeScript + Tailwind. Supabase Realtime. Полная декомпозиция на компоненты, 38 unit-тестов.',
  },
  {
    version: '3.19',
    date: "04 April '26",
    notes: 'Голосовые уведомления, таблица покерных комбинаций, overtime-режим, предупреждение за 1 минуту.',
  },
];

function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#1e1e1e] border border-[#333] rounded-xl p-6 w-[340px] max-w-[90vw] shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[14px] font-semibold text-[#ccc] tracking-[1px] uppercase">История версий</h2>
          <button onClick={onClose} className="text-[#555] text-[18px] hover:text-[#999] bg-transparent border-none cursor-pointer leading-none">✕</button>
        </div>
        <div className="flex flex-col gap-4">
          {CHANGELOG.map(({ version, date, notes }) => (
            <div key={version}>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-violet-400 font-bold text-[13px]">v{version}</span>
                <span className="text-[#444] text-[11px]">{date}</span>
              </div>
              <p className="text-[#888] text-[12px] leading-[1.6]">{notes}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Tab = 'tournament' | 'players' | 'display';

type Props = {
  config: Config;
  onSave: (config: Config) => void;
  onClose: () => void;
  onJumpToEnd?: () => void;
};

type FormErrors = {
  levelDuration?: string;
  breakDuration?: string;
  breakEvery?: string;
  blinds?: string;
};

export function SettingsScreen({ config, onSave, onClose, onJumpToEnd }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('tournament');
  const [showChangelog, setShowChangelog] = useState(false);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'tournament', label: 'Турнир' },
    { id: 'players',    label: 'Игроки' },
    { id: 'display',    label: 'Оформление' },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a] text-white">
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}

      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-[#2a2a2a] shrink-0">
        <div className="flex items-center gap-2">
          <button className="text-violet-500 text-[14px] bg-transparent border-none cursor-pointer" onClick={onClose}>
            ← Назад
          </button>
          {onJumpToEnd && (
            <button
              className="text-[#555] text-[11px] bg-transparent border border-[#333] rounded px-[7px] py-[3px] cursor-pointer hover:text-[#888] hover:border-[#555]"
              onClick={onJumpToEnd}
              title="Перемотать к последней минуте (для теста)"
            >
              1:05
            </button>
          )}
        </div>
        <div className="text-center">
          <h1 className="text-[16px] font-semibold text-[#ccc] tracking-[1px]">НАСТРОЙКИ</h1>
          <div className="text-[11px] text-[#444] mt-[2px] cursor-pointer" onClick={() => setShowChangelog(true)}>v4.7</div>
        </div>
        <button
          className="bg-violet-700 text-white border-none rounded-lg px-[18px] py-[7px] text-[14px] font-semibold cursor-pointer hover:bg-violet-800"
          onClick={onClose}
        >
          Готово
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#2a2a2a] shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-[13px] font-medium border-none cursor-pointer transition-colors
              ${activeTab === tab.id
                ? 'text-violet-400 border-b-2 border-violet-500 bg-transparent'
                : 'text-[#555] bg-transparent hover:text-[#888]'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tournament' && (
          <TournamentTab config={config} onSave={onSave} onClose={onClose} />
        )}
        {activeTab === 'players' && <PlayerManager />}
        {activeTab === 'display' && <DisplayTab />}
      </div>
    </div>
  );
}

// ── Tournament Tab ────────────────────────────────────────────────────────

function TournamentTab({ config, onSave, onClose }: { config: Config; onSave: (c: Config) => void; onClose: () => void }) {
  const [levelDuration, setLevelDuration] = useState(String(config.levelDuration));
  const [breakDuration, setBreakDuration] = useState(String(config.breakDuration));
  const [breakEvery, setBreakEvery] = useState(String(config.breakEvery));
  const [blinds, setBlinds] = useState<BlindLevel[]>(config.blindLevels.map(l => ({ sb: l.sb, bb: l.bb })));
  const [errors, setErrors] = useState<FormErrors>({});

  const isDirty =
    levelDuration !== String(config.levelDuration) ||
    breakDuration !== String(config.breakDuration) ||
    breakEvery !== String(config.breakEvery) ||
    JSON.stringify(blinds) !== JSON.stringify(config.blindLevels.map(l => ({ sb: l.sb, bb: l.bb })));

  const breakEveryNum = Math.max(1, parseInt(breakEvery, 10) || 1);

  function validate(): Config | null {
    const errs: FormErrors = {};
    const ld = parseInt(levelDuration, 10);
    const bd = parseInt(breakDuration, 10);
    const be = parseInt(breakEvery, 10);
    if (!ld || ld < 1 || ld > 999) errs.levelDuration = 'Введите целое число от 1 до 999';
    if (!bd || bd < 1 || bd > 999) errs.breakDuration = 'Введите целое число от 1 до 999';
    if (!be || be < 1) errs.breakEvery = 'Введите целое число ≥ 1';
    if (blinds.length === 0) errs.blinds = 'Добавьте хотя бы один уровень';
    if (blinds.some(b => !b.sb || b.sb <= 0 || !b.bb || b.bb <= 0)) errs.blinds = 'Все SB и BB должны быть положительными числами';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return null;
    return { levelDuration: ld, breakDuration: bd, breakEvery: be, showCombos: config.showCombos, blindLevels: blinds };
  }

  function handleSave() { const cfg = validate(); if (cfg) onSave(cfg); }

  function handleReset() {
    setLevelDuration(String(DEFAULT_CONFIG.levelDuration));
    setBreakDuration(String(DEFAULT_CONFIG.breakDuration));
    setBreakEvery(String(DEFAULT_CONFIG.breakEvery));
    setBlinds(DEFAULT_CONFIG.blindLevels.map(l => ({ sb: l.sb, bb: l.bb })));
    setErrors({});
  }

  function updateBlind(i: number, field: 'sb' | 'bb', value: string) {
    setBlinds(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: parseInt(value, 10) || 0 } : b));
  }

  function removeBlind(i: number) { setBlinds(prev => prev.filter((_, idx) => idx !== i)); }

  function addBlind() {
    const last = blinds[blinds.length - 1];
    setBlinds(prev => [...prev, { sb: (last?.sb || 0) * 2, bb: (last?.bb || 0) * 2 }]);
  }

  const inputBase = 'bg-[#333] border border-[#444] rounded-[6px] text-white px-[10px] py-[6px] text-[18px] font-bold w-[72px] text-center focus:outline-none focus:border-violet-600';
  const blindInputBase = 'bg-[#242424] border border-[#333] rounded-[6px] text-white px-[10px] py-[6px] text-[15px] w-[90px] text-right tabular-nums focus:outline-none focus:border-violet-600 focus:bg-[#2a2a2a]';

  const timeFields = [
    { label: 'Длительность уровня', id: 'level', val: levelDuration, set: setLevelDuration, unit: 'мин', err: errors.levelDuration },
    { label: 'Перерыв', id: 'break', val: breakDuration, set: setBreakDuration, unit: 'мин', err: errors.breakDuration },
    { label: 'Перерыв каждые', id: 'every', val: breakEvery, set: setBreakEvery, unit: 'уровня', err: errors.breakEvery },
  ];

  return (
    <div className="px-6 py-5 flex flex-col gap-5">
      {/* Time section */}
      <div>
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-[10px]">Время</div>
        <div className="flex gap-3">
          {timeFields.map(({ label, id, val, set, unit, err }) => (
            <div key={id} className="flex-1 bg-[#242424] rounded-lg p-[12px_14px]">
              <label className="block text-[11px] text-[#666] uppercase tracking-[1px] mb-[6px]">{label}</label>
              <div className="flex items-center gap-2">
                <input type="number" min="1" max="999" value={val} onChange={e => set(e.target.value)}
                  className={`${inputBase} ${err ? 'border-red-500' : ''}`} />
                <span className="text-[#555] text-[13px]">{unit}</span>
              </div>
              {err && <div className="text-red-500 text-[11px] mt-1">{err}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Blinds section */}
      <div>
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-[10px] flex justify-between items-center">
          <span>Блайнды</span>
          <button onClick={handleReset} className="bg-transparent border-none text-[#444] text-[12px] cursor-pointer underline hover:text-red-500">
            сбросить к умолчаниям
          </button>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['#', 'SB', 'BB', ''].map((h, i) => (
                <th key={i} className="text-[#555] text-[11px] uppercase tracking-[1px] text-left px-2 pb-2 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {blinds.map((level, i) => {
              const levelNum = i + 1;
              const showBreakDivider = levelNum % breakEveryNum === 0 && levelNum < blinds.length;
              return (
                <Fragment key={i}>
                  <tr>
                    <td className="px-2 py-[3px] text-[#444] text-[12px] text-center">{levelNum}</td>
                    <td className="px-2 py-[3px]">
                      <input type="number" min="1" value={level.sb || ''} onChange={e => updateBlind(i, 'sb', e.target.value)} className={blindInputBase} />
                    </td>
                    <td className="px-2 py-[3px]">
                      <input type="number" min="1" value={level.bb || ''} onChange={e => updateBlind(i, 'bb', e.target.value)} className={blindInputBase} />
                    </td>
                    <td className="px-2 py-[3px]">
                      <button onClick={() => removeBlind(i)} className="bg-transparent border-none text-[#444] cursor-pointer text-[16px] px-2 py-1 rounded hover:text-red-500 hover:bg-[#2a1a1a]">✕</button>
                    </td>
                  </tr>
                  {showBreakDivider && (
                    <tr>
                      <td colSpan={4} className="px-2 py-[6px] text-[#4a4a7a] text-[11px] tracking-[1px] border-y border-[#2a2a3a]">
                        ── ☕ Перерыв ──────────────────────
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {errors.blinds && <div className="text-red-500 text-[13px] mt-2">{errors.blinds}</div>}
        <button onClick={addBlind} className="bg-transparent border border-dashed border-[#2a2a2a] text-[#555] w-full py-2 rounded-[6px] mt-[6px] cursor-pointer text-[13px] hover:border-violet-700 hover:text-violet-500">
          + добавить уровень
        </button>
      </div>

      {/* Session setup */}
      <SessionSetup />

      {/* Save timer settings button — sticky bottom, disabled when no changes */}
      <div className="sticky bottom-0 bg-[#1a1a1a] pt-2 pb-1 -mx-6 px-6">
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className="bg-violet-700 text-white border-none rounded-lg px-[18px] py-[10px] text-[15px] font-semibold w-full transition-opacity
            enabled:cursor-pointer enabled:hover:bg-violet-800
            disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Сохранить настройки таймера
        </button>
      </div>
    </div>
  );
}

// ── Display Tab ───────────────────────────────────────────────────────────

function DisplayTab() {
  return (
    <div className="px-6 py-5 flex flex-col gap-5">
      <div>
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-[10px]">Звук</div>
        <div className="grid grid-cols-2 gap-[8px]">
          {([
            { event: 'warnBlinds',   label: '1 мин до смены блайндов' },
            { event: 'blindsUp',     label: 'Блайнды повышаются' },
            { event: 'warnBreak',    label: '1 мин до перерыва' },
            { event: 'breakStart',   label: 'Перерыв начался' },
            { event: 'warnEndBreak', label: '1 мин до конца перерыва' },
            { event: 'breakOver',    label: 'Перерыв закончился' },
          ] as { event: SoundEvent; label: string }[]).map(({ event, label }) => (
            <button key={event} onClick={() => playSound(event)}
              className="flex items-center gap-[10px] bg-[#242424] border border-[#333] rounded-lg px-[14px] py-[10px] text-left cursor-pointer hover:border-violet-700 hover:bg-[#2a2040] hover:text-white transition-colors">
              <span className="text-[18px]">🔔</span>
              <span className="text-[12px] text-[#aaa]">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

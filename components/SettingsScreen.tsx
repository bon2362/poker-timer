// components/SettingsScreen.tsx
'use client';
import { useState, useEffect, useRef, Fragment } from 'react';
import type { Config, BlindLevel, SoundEvent } from '@/types/timer';
import { DEFAULT_CONFIG } from '@/lib/storage';
import { playSound } from '@/lib/audio';
import { listSlideshowPhotos, uploadSlideshowPhoto, deleteAllSlideshowPhotos } from '@/lib/supabase/slideshow';
import { PlayerManager } from './PlayerManager/PlayerManager';
import { SessionSetup } from './SessionSetup/SessionSetup';
import { FinalGameSlideshowOverlay } from './FinalGameSlideshowOverlay';

type ChangelogEntry =
  | { version: string; date: string; notes: string; divider?: false }
  | { divider: true; label: string };

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '4.53',
    date: "05 May '26",
    notes: 'Поддержка презентационного USB-кликера: Page Up / Page Down → пауза/возобновление таймера.',
  },
  {
    version: '4.52',
    date: "24 April '26",
    notes: 'Дата фотографии на экране перерыва перемещена в правый нижний угол.',
  },
  {
    version: '4.51',
    date: "24 April '26",
    notes: 'На экране перерыва появились титры песни (синхронно с «Потной Раздачей»), а дата фотографии переехала под таймер и уменьшилась.',
  },
  {
    version: '4.50',
    date: "24 April '26",
    notes: 'Иконка 🔊/🔇 в ряду кнопок управления таймером на перерыве — исчезает вместе с остальными контролами при бездействии мыши.',
  },
  {
    version: '4.48',
    date: "24 April '26",
    notes: 'Песня «Потная Раздача» теперь может проигрываться на каждом перерыве — новый переключатель во вкладке «Экран» настроек.',
  },
  {
    version: '4.47',
    date: "18 April '26",
    notes: 'Оптимизация: изображения победителя и выбывшего теперь запрашиваются через Supabase Image Transformations (1920px, quality 80) — меньший размер файла без заметной потери качества.',
  },
  {
    version: '4.46',
    date: "17 April '26",
    notes: 'CI/CD вкладка: коммит-хэши окрашиваются одним цветом когда совпадают, и разными — когда разные. Наглядно показывает, что пайплайн ещё не завершён.',
  },
  {
    version: '4.45',
    date: "16 April '26",
    notes: 'Оптимизация: убран cache-buster ?t=Date.now() из URL loser-изображений + preload winner/loser фото при старте сессии — изображения загружаются мгновенно.',
  },
  {
    version: '4.45',
    date: "16 April '26",
    notes: 'CI/CD вкладка: виджет Supabase Usage — Storage size, DB size (прогресс-бары) + cached vs uncached запросы за сегодня. Ссылка на дашборд для egress.',
  },
  {
    version: '4.44',
    date: "16 April '26",
    notes: 'CI/CD вкладка: виджет Supabase Usage — первая версия (убрана, т.к. billing API недоступен без сессии).',
  },
  {
    version: '4.43',
    date: "16 April '26",
    notes: 'Фикс: убран ?t=Date.now() из URL чтения изображений победителей — CDN-кэш Supabase теперь работает и egress значительно снизится.',
  },
  {
    version: '4.42',
    date: "16 April '26",
    notes: 'Фикс: кнопки управления таймером перенесены ниже блока "Далее" — больше не перекрывают информацию о следующих блайндах.',
  },
  {
    version: '4.41',
    date: "16 April '26",
    notes: 'Рефакторинг: миниатюры winner/loser теперь генерирует Supabase Image Transformations на лету — двойная загрузка и клиентская генерация thumb-файлов удалены.',
  },
  {
    version: '4.40',
    date: "14 April '26",
    notes: 'Оформление: кнопка "Потная Раздача" запускает финальное слайдшоу прямо из настроек.',
  },
  {
    version: '4.39',
    date: "13 Apr '26",
    notes: 'Тракторный момент: звук и видео за финальную минуту перед уровнем 150/300.',
  },
  {
    version: '4.38',
    date: "12 April '26",
    notes: 'Оптимизация изображений: автоматическая генерация миниатюр для winner/loser картинок в списке игроков.',
  },
  {
    version: '4.36',
    date: "12 April '26",
    notes: 'CI/CD: виджет Codecov — общий % покрытия, цветная полоска, таблица файлов по убыванию missed lines.',
  },
  {
    version: '4.35',
    date: "12 April '26",
    notes: 'Allure Report виджет: мини-диаграмма с результатами (passed/failed/broken/skipped), время последнего запуска и длительность.',
  },
  {
    version: '4.34',
    date: "12 April '26",
    notes: 'CI/CD вкладка: переупорядочены и переименованы виджеты — «Последний коммит», «GitHub CI», «Vercel deploy», «Allure Report».',
  },
  {
    version: '4.33',
    date: "12 April '26",
    notes: 'Вкладка CI/CD в настройках: виджеты статуса тестов (GitHub Actions), деплоя Vercel, последнего коммита на сайте и отчёта о тестах (GitHub Pages).',
  },
  {
    version: '4.32',
    date: "12 April '26",
    notes: 'Финальное слайдшоу: синхронизированы субтитры "Потной Раздачи" с реальным таймингом песни.',
  },
  {
    version: '4.31',
    date: "12 April '26",
    notes: 'Финальный экран: аплодисменты после объявления победителя останавливаются через 15 секунд, а слайд-шоу с песней запускается после короткой паузы без наложения звука.',
  },
  {
    version: '4.30',
    date: "12 April '26",
    notes: 'Экран завершения игры: через 30 секунд после победителя запускается финальное слайд-шоу с музыкой «Потная раздача», текстом песни и кнопкой завершения по движению мыши.',
  },
  {
    version: '4.29',
    date: "12 April '26",
    notes: 'Панель игроков стала шире, строки аккуратнее ужимаются без горизонтального скролла, а системные белые скроллбары заменены на тихие полупрозрачные.',
  },
  {
    version: '4.28',
    date: "12 April '26",
    notes: 'Фикс фикса синхронизации: подавление эха теперь привязано к конкретному полученному состоянию и не блокирует следующий локальный play/pause.',
  },
  {
    version: '4.27',
    date: "12 April '26",
    notes: 'Фикс синхронизации таймера между устройствами: веб-клиенты теперь принимают durable timer_state updates из Supabase, сохранения идут по порядку, а перезагрузка не переотправляет stale-состояние обратно.',
  },
  {
    version: '4.26',
    date: "12 April '26",
    notes: 'Корректировка изображения проигравшего: компактный таймер рядом с кнопкой «Пропустить», кнопка приведена к общему прозрачному стилю управления.',
  },
  {
    version: '4.25',
    date: "12 April '26",
    notes: 'Изображение проигравшего: отдельная загрузка для каждого игрока, полноэкранный показ на 30 секунд при вылете, таймер поверх фото и кнопка «Пропустить» при движении мыши.',
  },
  {
    version: '4.24',
    date: "11 April '26",
    notes: 'Фикс: таймер теперь надёжно останавливается при завершении игры — устранена гонка между паузой и восстановлением состояния из БД.',
  },
  {
    version: '4.23',
    date: "11 April '26",
    notes: 'Таймер «Минуту!» синхронизируется между устройствами через Supabase Realtime broadcast — запуск на десктопе виден на мобильном и наоборот.',
  },
  {
    version: '4.22',
    date: "11 April '26",
    notes: 'Аватарка игрока отображается на экране «Минуту!» (desktop + mobile).',
  },
  {
    version: '4.21',
    date: "11 April '26",
    notes: 'Фича «Минуту!» — персональный 60-секундный таймер для игрока, запрашивающего время на раздумья. Доступен из панели игроков (desktop + mobile). Мобильный список игроков теперь сворачиваемый.',
  },
  {
    version: '4.20',
    date: "11 April '26",
    notes: 'Таймер автоматически ставится на паузу при завершении игры.',
  },
  {
    version: '4.19',
    date: "11 April '26",
    notes: 'Добавлена презентационная страница /vibe: обзор возможностей, клиентских контуров desktop/mobile/iOS и архитектуры Supabase для менеджерского чтения.',
  },
  {
    version: '4.18',
    date: "11 April '26",
    notes: 'Фикс записи состояния таймера в Supabase после усиления RLS: web-клиент сохраняет timer_state через RPC, чтобы reload и мобильные устройства не поднимали старый перерыв.',
  },
  {
    version: '4.17',
    date: "11 April '26",
    notes: 'Фикс восстановления таймера после перезагрузки и на мобильных устройствах: состояние теперь использует сохранённый список уровней и не перескакивает на первый перерыв при отличающемся локальном конфиге.',
  },
  {
    version: '4.16',
    date: "10 April '26",
    notes: 'Безопасность: удалён избыточный anon-доступ к push_tokens, webhook secret для Edge Function, удалён legacy timer_commands fallback (заменён RPC), supabase/.temp/ в .gitignore.',
  },
  {
    version: '4.15',
    date: "10 April '26",
    notes: 'Рефакторинг качества: anchor-based тесты таймера (45/45), OPEN_SETTINGS паузит таймер, защита от ребая сверх лимита, iOS RPC-команды (apply_timer_command), echo-suppression source=ios/web, Supabase Edge Function для APNs.',
  },
  {
    version: '4.14',
    date: "09 April '26",
    notes: 'iOS-приложение на SwiftUI + Live Activity: управление таймером с Lock Screen (пауза, след./пред. уровень). Supabase: новая таблица timer_commands, поля stage_type/sb/bb/stage_duration в timer_state.',
  },
  {
    version: '4.13',
    date: "08 April '26",
    notes: 'Изображение победителя — отдельное для каждого игрока. Миниатюра 16:9 прямо в строке игрока в настройках. При наличии изображения экран победителя — полноэкранный фон с оверлеем.',
  },
  {
    version: '4.12',
    date: "08 April '26",
    notes: 'Изображение победителя 16:9 + фанфары. Управление экраном (игроки/комбо) из мобильного админа с синхронизацией. По умолчанию 1 ребай. На последнем уровне убраны "далее финал" и лишние звуковые уведомления.',
  },
  {
    version: '4.11',
    date: "08 April '26",
    notes: 'Фикс инпутов настроек: убраны стрелки (spinners), надёжный ввод цифр, нормализация пустых полей. Настройки слайдшоу больше не закрывают экран. Кнопка сохранения таймера не закрывает настройки.',
  },
  {
    version: '4.10',
    date: "07 April '26",
    notes: 'Улучшения слайдшоу: фото показывается целиком с размытым фоном, таймер вверху/дата внизу, фикс мерцания через прелоад, фикс скорости на новых устройствах.',
  },
  {
    version: '4.9',
    date: "06 April '26",
    notes: 'Слайдшоу фотографий на перерывах: загрузка фото в Supabase Storage, автозапуск во время перерыва, таймер поверх фото.',
  },
  {
    version: '4.8',
    date: "06 April '26",
    notes: 'Таймер автоматически сбрасывается на раунд 1 при старте новой игры.',
  },
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
  { divider: true, label: 'Предыстория' },
  {
    version: '3.x',
    date: "April '26",
    notes: 'Одностраничное приложение на голом JS. Голосовые уведомления, таблица покерных комбинаций, overtime-режим, предупреждение за 1 минуту до смены блайндов — всё это появилось здесь. Написано уже после первой игры, на волне желания сделать лучше.',
  },
  {
    version: '2.0',
    date: "04 April '26",
    notes: 'Настройки блайндов, длительности уровней и перерывов. Именно эта версия крутилась на экране 4 апреля 2026 — на первой игре. Написана в спешке, но выдержала.',
  },
  {
    version: '1.0',
    date: "April '26",
    notes: 'Одностраничный таймер, написанный за полчаса. Блайнды зашиты в код, никаких настроек. Просто работало.',
  },
];

function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#1e1e1e] border border-[#333] rounded-xl p-6 w-[340px] max-w-[90vw] max-h-[80vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="text-[14px] font-semibold text-[#ccc] tracking-[1px] uppercase">История версий</h2>
          <button onClick={onClose} className="text-[#555] text-[18px] hover:text-[#999] bg-transparent border-none cursor-pointer leading-none">✕</button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto pr-1">
          {CHANGELOG.map((entry, i) => {
            if (entry.divider) {
              return (
                <div key={`divider-${i}`} className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-[#2a2a2a]" />
                  <span className="text-[10px] text-[#444] tracking-[2px] uppercase shrink-0">{entry.label}</span>
                  <div className="flex-1 h-px bg-[#2a2a2a]" />
                </div>
              );
            }
            return (
              <div key={entry.version}>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-violet-400 font-bold text-[13px]">v{entry.version}</span>
                  <span className="text-[#444] text-[11px]">{entry.date}</span>
                </div>
                <p className="text-[#888] text-[12px] leading-[1.6]">{entry.notes}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type Tab = 'tournament' | 'players' | 'display' | 'cicd';

type Props = {
  config: Config;
  onSave: (config: Config) => void;
  onDisplaySave: (config: Config) => void;
  onClose: () => void;
  onJumpToEnd?: () => void;
  onSlideshowChanged: () => void;
};

type FormErrors = {
  levelDuration?: string;
  breakDuration?: string;
  breakEvery?: string;
  blinds?: string;
};

export function SettingsScreen({ config, onSave, onDisplaySave, onClose, onJumpToEnd, onSlideshowChanged }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('tournament');
  const [showChangelog, setShowChangelog] = useState(false);
  const [cicdRefreshKey, setCicdRefreshKey] = useState(0);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'tournament', label: 'Турнир' },
    { id: 'players',    label: 'Игроки' },
    { id: 'display',    label: 'Оформление' },
    { id: 'cicd',       label: 'CI/CD' },
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
          <div className="text-[11px] text-[#444] mt-[2px] cursor-pointer" onClick={() => setShowChangelog(true)}>v{(CHANGELOG.find((e): e is Extract<ChangelogEntry, { version: string }> => !('divider' in e))?.version)}</div>
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
            onClick={() => {
              if (tab.id === 'cicd' && activeTab === 'cicd') {
                setCicdRefreshKey(k => k + 1);
              } else {
                setActiveTab(tab.id);
              }
            }}
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
        {activeTab === 'display' && <DisplayTab config={config} onDisplaySave={onDisplaySave} onSlideshowChanged={onSlideshowChanged} />}
        {activeTab === 'cicd' && <CiCdTab refreshKey={cicdRefreshKey} />}
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
    return { ...config, levelDuration: ld, breakDuration: bd, breakEvery: be, blindLevels: blinds };
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
    { label: 'Длительность уровня', id: 'level', val: levelDuration, set: setLevelDuration, unit: 'мин', err: errors.levelDuration, fallback: String(DEFAULT_CONFIG.levelDuration) },
    { label: 'Перерыв', id: 'break', val: breakDuration, set: setBreakDuration, unit: 'мин', err: errors.breakDuration, fallback: String(DEFAULT_CONFIG.breakDuration) },
    { label: 'Перерыв каждые', id: 'every', val: breakEvery, set: setBreakEvery, unit: 'уровня', err: errors.breakEvery, fallback: String(DEFAULT_CONFIG.breakEvery) },
  ];

  return (
    <div className="px-6 py-5 flex flex-col gap-5">
      {/* Time section */}
      <div>
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-[10px]">Время</div>
        <div className="flex gap-3">
          {timeFields.map(({ label, id, val, set, unit, err, fallback }) => (
            <div key={id} className="flex-1 bg-[#242424] rounded-lg p-[12px_14px]">
              <label className="block text-[11px] text-[#666] uppercase tracking-[1px] mb-[6px]">{label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={val}
                  onChange={e => set(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => { if (!parseInt(val, 10)) set(fallback); }}
                  className={`${inputBase} ${err ? 'border-red-500' : ''}`}
                />
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
                      <input type="text" inputMode="numeric" value={level.sb || ''} onChange={e => updateBlind(i, 'sb', e.target.value.replace(/\D/g, ''))} className={blindInputBase} />
                    </td>
                    <td className="px-2 py-[3px]">
                      <input type="text" inputMode="numeric" value={level.bb || ''} onChange={e => updateBlind(i, 'bb', e.target.value.replace(/\D/g, ''))} className={blindInputBase} />
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
          Применить время и блайнды
        </button>
      </div>
    </div>
  );
}

// ── Display Tab ───────────────────────────────────────────────────────────

function DisplayTab({ config, onDisplaySave, onSlideshowChanged }: { config: Config; onDisplaySave: (c: Config) => void; onSlideshowChanged: () => void }) {
  const [slideshowEnabled, setSlideshowEnabled] = useState(config.slideshowEnabled);
  const [slideshowSpeed, setSlideshowSpeed] = useState(String(config.slideshowSpeed ?? 5));
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listSlideshowPhotos().then(urls => { setPhotoCount(urls.length); setPhotoUrls(urls); });
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    await Promise.all(files.map(uploadSlideshowPhoto));
    const updated = await listSlideshowPhotos();
    setPhotoCount(updated.length);
    setPhotoUrls(updated);
    onSlideshowChanged();
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDeleteAll() {
    if (!confirm(`Удалить все фотографии (${photoCount})?`)) return;
    await deleteAllSlideshowPhotos();
    setPhotoCount(0);
    setPhotoUrls([]);
    onSlideshowChanged();
  }

  return (
    <div className="px-6 py-5 flex flex-col gap-5">
      {/* Sound section */}
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

      {/* Slideshow section */}
      <div>
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-[10px]">Слайдшоу на перерыве</div>

        <label className="flex items-center gap-3 bg-[#242424] border border-[#333] rounded-lg px-4 py-3 cursor-pointer mb-3">
          <input
            type="checkbox"
            checked={slideshowEnabled}
            onChange={e => {
              setSlideshowEnabled(e.target.checked);
              onDisplaySave({ ...config, slideshowEnabled: e.target.checked, slideshowSpeed: Math.max(1, parseInt(slideshowSpeed, 10) || 5) });
            }}
            className="w-4 h-4 accent-violet-600 cursor-pointer"
          />
          <span className="text-[14px] text-[#ccc]">Показывать фото во время перерыва</span>
        </label>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-[#242424] rounded-lg p-3">
            <label className="block text-[11px] text-[#666] uppercase tracking-[1px] mb-2">Смена фото (сек)</label>
            <input
              type="text"
              inputMode="numeric"
              value={slideshowSpeed}
              onChange={e => setSlideshowSpeed(e.target.value.replace(/\D/g, ''))}
              onBlur={() => {
                const n = Math.max(1, parseInt(slideshowSpeed, 10) || 5);
                setSlideshowSpeed(String(n));
                onDisplaySave({ ...config, slideshowEnabled, slideshowSpeed: n });
              }}
              className="bg-[#333] border border-[#444] rounded-[6px] text-white px-3 py-2 text-[15px] font-bold w-full focus:outline-none focus:border-violet-600 tabular-nums"
            />
          </div>
          <div className="bg-[#242424] rounded-lg p-3 flex flex-col gap-1">
            <label className="block text-[11px] text-[#666] uppercase tracking-[1px]">Фото в базе</label>
            <span className="text-[20px] font-bold text-[#ccc] tabular-nums mt-1">
              {photoCount === null ? '…' : photoCount}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1 bg-[#242424] border border-[#444] text-[#ccc] rounded-lg px-4 py-2 text-[13px] cursor-pointer hover:border-violet-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Загружаем…' : '+ Добавить фото'}
          </button>
          {(photoCount ?? 0) > 0 && (
            <button
              onClick={handleDeleteAll}
              className="bg-[#242424] border border-[#444] text-[#666] rounded-lg px-3 py-2 text-[13px] cursor-pointer hover:border-red-700 hover:text-red-400 transition-colors"
            >
              Удалить все
            </button>
          )}
        </div>
      </div>

      {/* Песня на перерыве */}
      <div>
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-[10px]">Песня на перерыве</div>
        <label className="flex items-center gap-3 bg-[#242424] border border-[#333] rounded-lg px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.breakSongEnabled}
            onChange={e => onDisplaySave({ ...config, breakSongEnabled: e.target.checked })}
            className="w-4 h-4 accent-violet-600 cursor-pointer"
          />
          <span className="text-[14px] text-[#ccc]">Проигрывать «Потную Раздачу» во время каждого перерыва</span>
        </label>
      </div>

      {/* Финальное слайдшоу */}
      <div>
        <div className="text-[11px] text-[#555] tracking-[2px] uppercase mb-[10px]">Финальное слайдшоу</div>
        <button
          onClick={() => setPreviewOpen(true)}
          className="w-full bg-[#242424] border border-[#444] text-[#ccc] rounded-lg px-4 py-3 text-[14px] font-semibold cursor-pointer hover:border-violet-600 hover:text-white transition-colors"
        >
          Потная Раздача
        </button>
      </div>

      {previewOpen && (
        <FinalGameSlideshowOverlay
          urls={photoUrls}
          controlsVisible={true}
          finishLabel="Хватит"
          onFinish={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

// ── CI/CD Tab ─────────────────────────────────────────────────────────────

type SupabaseUsageData = {
  storage_size_bytes?: number | null;
  db_size_bytes?: number | null;
  today_cached_requests?: number;
  today_uncached_requests?: number;
  error?: string;
};

type CiStatusData = {
  testRun: {
    status: string;
    conclusion: string | null;
    createdAt: string;
    updatedAt: string;
    url: string;
    commit: { sha: string; message: string; author: string; timestamp: string };
  } | null;
  prodDeploy: {
    state: string;
    description: string;
    createdAt: string;
    deployUrl: string;
    sha: string;
    commitMessage: string;
  } | null;
  testReport: {
    state: string;
    createdAt: string;
    reportUrl: string;
    sha: string;
  } | null;
  codecov: {
    coverage: number | null;
    lines: number;
    hits: number;
    misses: number;
    partials: number;
    files: { name: string; coverage: number; lines: number; hits: number; misses: number }[];
  } | null;
  allure: {
    passed: number;
    failed: number;
    broken: number;
    skipped: number;
    total: number;
    startMs: number | null;
    durationMs: number | null;
  } | null;
  error?: string;
};

type AllureStats = { passed: number; failed: number; broken: number; skipped: number; total: number };

function AllureDonut({ stats }: { stats: AllureStats }) {
  const R = 28;
  const C = 2 * Math.PI * R;
  const { passed, failed, broken, skipped, total } = stats;

  const segments = [
    { value: passed,  color: '#34d399' }, // emerald
    { value: failed,  color: '#f87171' }, // red
    { value: broken,  color: '#fb923c' }, // orange
    { value: skipped, color: '#6b7280' }, // gray
  ];

  let offset = 0;
  const arcs = segments.map(seg => {
    const dash = total > 0 ? (seg.value / total) * C : 0;
    const arc = { dash, offset, color: seg.color };
    offset += dash;
    return arc;
  });

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={R} fill="none" stroke="#2a2a2a" strokeWidth="10" />
      {arcs.map((arc, i) =>
        arc.dash > 0 ? (
          <circle
            key={i}
            cx="36" cy="36" r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth="10"
            strokeDasharray={`${arc.dash} ${C - arc.dash}`}
            strokeDashoffset={C / 4 - arc.offset}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '36px 36px' }}
          />
        ) : null
      )}
      <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#ccc">{total}</text>
    </svg>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  return `${Math.floor(hrs / 24)} д назад`;
}

function StatusBadge({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (status === 'completed') {
    if (conclusion === 'success') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-2 py-[2px]">✓ success</span>;
    if (conclusion === 'failure') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-400/10 border border-red-400/20 rounded px-2 py-[2px]">✕ failure</span>;
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#888] bg-[#222] border border-[#333] rounded px-2 py-[2px]">{conclusion ?? 'unknown'}</span>;
  }
  if (status === 'in_progress') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-2 py-[2px]">⟳ running</span>;
  if (status === 'queued') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400 bg-sky-400/10 border border-sky-400/20 rounded px-2 py-[2px]">· queued</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#888] bg-[#222] border border-[#333] rounded px-2 py-[2px]">{status}</span>;
}

function DeployBadge({ state }: { state: string }) {
  if (state === 'success') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-2 py-[2px]">✓ deployed</span>;
  if (state === 'failure' || state === 'error') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-400/10 border border-red-400/20 rounded px-2 py-[2px]">✕ failed</span>;
  if (state === 'pending' || state === 'in_progress') return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-2 py-[2px]">⟳ deploying</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#888] bg-[#222] border border-[#333] rounded px-2 py-[2px]">{state}</span>;
}

function CiCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4 flex flex-col gap-3">
      <div className="text-[11px] font-semibold text-[#444] tracking-[1.5px] uppercase">{title}</div>
      {children}
    </div>
  );
}


const SHA_BADGE_COLORS = [
  'text-violet-300 bg-violet-400/10 border border-violet-400/20',
  'text-amber-300 bg-amber-400/10 border border-amber-400/20',
  'text-emerald-300 bg-emerald-400/10 border border-emerald-400/20',
  'text-rose-300 bg-rose-400/10 border border-rose-400/20',
];

function buildShaColorMap(shas: (string | undefined | null)[]): Record<string, string> {
  const unique = [...new Set(shas.filter(Boolean) as string[])];
  const map: Record<string, string> = {};
  unique.forEach((sha, i) => { map[sha] = SHA_BADGE_COLORS[i % SHA_BADGE_COLORS.length]; });
  return map;
}

function CiCdTab({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<CiStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sbUsage, setSbUsage] = useState<SupabaseUsageData | null>(null);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setSbUsage(null);
    Promise.all([
      fetch('/api/ci-status').then(r => r.json()).catch(() => ({ testRun: null, prodDeploy: null, testReport: null, allure: null, codecov: null, error: 'Не удалось загрузить данные' })),
      fetch('/api/supabase-usage').then(r => r.json()).catch(() => ({ error: 'Не удалось загрузить' })),
    ]).then(([ci, sb]) => {
      setData(ci);
      setSbUsage(sb);
    }).finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <div className="p-5 flex flex-col gap-4">
      {loading && (
        <div className="flex justify-center items-center py-10 text-[#444] text-[13px]">Загружаем…</div>
      )}

      {!loading && data?.error && (
        <div className="text-red-400 text-[13px] bg-red-400/10 border border-red-400/20 rounded-xl p-4">{data.error}</div>
      )}

      {!loading && data && !data.error && (() => {
        const shaColors = buildShaColorMap([
          data.prodDeploy?.sha,
          data.testRun?.commit.sha,
          data.testReport?.sha,
        ]);
        const shaClass = (sha: string | undefined) =>
          sha ? shaColors[sha] : SHA_BADGE_COLORS[0];
        return (
        <>
          {/* Latest commit on site = prod deploy sha */}
          <CiCard title="Последний коммит на сайте">
            {data.prodDeploy ? (
              <>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[12px] rounded px-2 py-[2px] ${shaClass(data.prodDeploy.sha)}`}>{data.prodDeploy.sha}</span>
                  <span className="text-[11px] text-[#555]">{relativeTime(data.prodDeploy.createdAt)}</span>
                </div>
                {data.prodDeploy.commitMessage && (
                  <div className="text-[12px] text-[#888] leading-[1.5]">{data.prodDeploy.commitMessage}</div>
                )}
                <a
                  href={`https://github.com/bon2362/poker-timer/commit/${data.prodDeploy.sha}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#555] hover:text-violet-400 self-start"
                >
                  github.com/.../commit/{data.prodDeploy.sha} →
                </a>
              </>
            ) : (
              <div className="text-[#555] text-[12px]">Нет данных</div>
            )}
          </CiCard>

          {/* Tests */}
          <CiCard title="GitHub CI">
            {data.testRun ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={data.testRun.status} conclusion={data.testRun.conclusion} />
                  <span className="text-[11px] text-[#555]">{relativeTime(data.testRun.createdAt)}</span>
                </div>
                <div className="text-[12px] text-[#777] leading-[1.5] line-clamp-2">{data.testRun.commit.message}</div>
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-[12px] rounded px-2 py-[2px] ${shaClass(data.testRun.commit.sha)}`}>{data.testRun.commit.sha}</span>
                  <a
                    href={data.testRun.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-violet-400 hover:text-violet-300"
                  >
                    Открыть →
                  </a>
                </div>
              </>
            ) : (
              <div className="text-[#555] text-[12px]">Нет данных</div>
            )}
          </CiCard>

          {/* Vercel deploy */}
          <CiCard title="Vercel deploy">
            {data.prodDeploy ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <DeployBadge state={data.prodDeploy.state} />
                  <span className="text-[11px] text-[#555]">{relativeTime(data.prodDeploy.createdAt)}</span>
                </div>
                {data.prodDeploy.commitMessage && (
                  <div className="text-[12px] text-[#777] leading-[1.5] line-clamp-2">{data.prodDeploy.commitMessage}</div>
                )}
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-[12px] rounded px-2 py-[2px] ${shaClass(data.prodDeploy.sha)}`}>{data.prodDeploy.sha}</span>
                  {data.prodDeploy.deployUrl ? (
                    <a
                      href={data.prodDeploy.deployUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-violet-400 hover:text-violet-300"
                    >
                      Открыть →
                    </a>
                  ) : (
                    <a
                      href="https://poker-timer-black.vercel.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-violet-400 hover:text-violet-300"
                    >
                      poker-timer-black.vercel.app →
                    </a>
                  )}
                </div>
              </>
            ) : (
              <div className="text-[#555] text-[12px]">Нет данных</div>
            )}
          </CiCard>

          {/* Test report */}
          <CiCard title="Allure Report">
            {data.allure ? (
              <>
                <div className="flex items-center gap-4">
                  <AllureDonut stats={data.allure} />
                  <div className="flex flex-col gap-[6px] flex-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-emerald-400">✓ passed</span>
                      <span className="font-mono text-[#ccc]">{data.allure.passed}</span>
                    </div>
                    {data.allure.failed > 0 && (
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-red-400">✕ failed</span>
                        <span className="font-mono text-[#ccc]">{data.allure.failed}</span>
                      </div>
                    )}
                    {data.allure.broken > 0 && (
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-orange-400">⚠ broken</span>
                        <span className="font-mono text-[#ccc]">{data.allure.broken}</span>
                      </div>
                    )}
                    {data.allure.skipped > 0 && (
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-[#666]">– skipped</span>
                        <span className="font-mono text-[#ccc]">{data.allure.skipped}</span>
                      </div>
                    )}
                    {data.allure.durationMs !== null && (
                      <div className="text-[11px] text-[#444] mt-1">
                        {(data.allure.durationMs / 1000).toFixed(1)}s
                      </div>
                    )}
                  </div>
                </div>
                {data.allure.startMs && (
                  <div className="text-[11px] text-[#555]">
                    {relativeTime(new Date(data.allure.startMs).toISOString())}
                  </div>
                )}
                {data.testReport && (
                  <a
                    href={data.testReport.reportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-violet-400 hover:text-violet-300 self-start"
                  >
                    Открыть отчёт →
                  </a>
                )}
              </>
            ) : data.testReport ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <DeployBadge state={data.testReport.state} />
                  <span className="text-[11px] text-[#555]">{relativeTime(data.testReport.createdAt)}</span>
                </div>
                <a
                  href={data.testReport.reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-violet-400 hover:text-violet-300"
                >
                  Открыть отчёт →
                </a>
              </>
            ) : (
              <div className="text-[#555] text-[12px]">Нет данных</div>
            )}
          </CiCard>

          {/* Supabase Usage */}
          <CiCard title="Supabase Usage">
            {sbUsage?.error ? (
              <div className="text-[#555] text-[12px]">{sbUsage.error}</div>
            ) : sbUsage ? (
              <div className="flex flex-col gap-[10px]">
                {/* Storage bar */}
                {sbUsage.storage_size_bytes != null && (() => {
                  const limit = 1 * 1024 * 1024 * 1024;
                  const pct = Math.min((sbUsage.storage_size_bytes / limit) * 100, 100);
                  const mb = (sbUsage.storage_size_bytes / (1024 * 1024)).toFixed(1);
                  const barColor = pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500';
                  const valColor = pct > 90 ? 'text-red-400' : pct > 75 ? 'text-amber-400' : 'text-[#ccc]';
                  return (
                    <div>
                      <div className="flex items-baseline justify-between mb-[4px]">
                        <span className="text-[11px] text-[#666]">Storage</span>
                        <span className={`text-[11px] font-mono tabular-nums ${valColor}`}>
                          {mb} MB / 1 GB <span className="text-[#444]">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-[4px] rounded-full bg-[#2a2a2a] overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}
                {/* DB bar */}
                {sbUsage.db_size_bytes != null && (() => {
                  const limit = 500 * 1024 * 1024;
                  const pct = Math.min((sbUsage.db_size_bytes / limit) * 100, 100);
                  const mb = (sbUsage.db_size_bytes / (1024 * 1024)).toFixed(1);
                  const barColor = pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500';
                  const valColor = pct > 90 ? 'text-red-400' : pct > 75 ? 'text-amber-400' : 'text-[#ccc]';
                  return (
                    <div>
                      <div className="flex items-baseline justify-between mb-[4px]">
                        <span className="text-[11px] text-[#666]">Database</span>
                        <span className={`text-[11px] font-mono tabular-nums ${valColor}`}>
                          {mb} MB / 500 MB <span className="text-[#444]">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-[4px] rounded-full bg-[#2a2a2a] overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })()}
                {/* Today's requests */}
                <div className="flex flex-col gap-[4px] pt-[2px]">
                  <div className="text-[10px] text-[#444] uppercase tracking-[1px]">Storage requests today</div>
                  {((sbUsage.today_cached_requests ?? 0) + (sbUsage.today_uncached_requests ?? 0)) === 0 ? (
                    <div className="text-[11px] text-[#444]">нет данных / трафика сегодня нет</div>
                  ) : (
                    <div className="flex gap-4">
                      <span className="text-[12px] text-emerald-400 tabular-nums">
                        ✓ cached: {(sbUsage.today_cached_requests ?? 0).toLocaleString('ru-RU')}
                      </span>
                      <span className={`text-[12px] tabular-nums ${(sbUsage.today_uncached_requests ?? 0) > 50 ? 'text-amber-400' : 'text-[#666]'}`}>
                        ⚡ uncached: {(sbUsage.today_uncached_requests ?? 0).toLocaleString('ru-RU')}
                      </span>
                    </div>
                  )}
                </div>
                <a
                  href="https://supabase.com/dashboard/org/nkaxdmzhrfetvgymjqyp/usage"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-violet-400 hover:text-violet-300 self-start mt-1"
                >
                  Egress → Supabase dashboard
                </a>
              </div>
            ) : (
              <div className="text-[#555] text-[12px]">Нет данных</div>
            )}
          </CiCard>

          {/* Codecov */}
          <CiCard title="Codecov">
            {data.codecov ? (
              <>
                {/* Overall coverage bar */}
                <div className="flex items-center gap-3">
                  <span className={`text-[28px] font-bold tabular-nums ${
                    data.codecov.coverage === null ? 'text-[#555]' :
                    data.codecov.coverage >= 80 ? 'text-emerald-400' :
                    data.codecov.coverage >= 60 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {data.codecov.coverage !== null ? `${data.codecov.coverage.toFixed(1)}%` : '—'}
                  </span>
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="h-[6px] rounded-full bg-[#2a2a2a] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          (data.codecov.coverage ?? 0) >= 80 ? 'bg-emerald-500' :
                          (data.codecov.coverage ?? 0) >= 60 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${data.codecov.coverage ?? 0}%` }}
                      />
                    </div>
                    <div className="flex gap-3 text-[11px] text-[#555]">
                      <span><span className="text-emerald-500">{data.codecov.hits}</span> covered</span>
                      <span><span className="text-red-500">{data.codecov.misses}</span> missed</span>
                      {data.codecov.partials > 0 && <span><span className="text-amber-500">{data.codecov.partials}</span> partial</span>}
                    </div>
                  </div>
                </div>

                {/* Per-file table */}
                {data.codecov.files.length > 0 && (
                  <div className="flex flex-col gap-[6px] mt-1">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[10px] text-[#444] uppercase tracking-[1px] pb-1 border-b border-[#222]">
                      <span>Файл</span>
                      <span className="text-right">Missed</span>
                      <span className="text-right w-[44px]">%</span>
                    </div>
                    {data.codecov.files.map(f => {
                      const shortName = f.name.replace(/^(components|context|lib|reducer)\//, '').replace(/\.(tsx?|js)$/, '');
                      const pct = f.coverage;
                      const color = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400';
                      return (
                        <div key={f.name} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center">
                          <span className="text-[11px] text-[#666] truncate" title={f.name}>{shortName}</span>
                          <span className="text-[11px] text-red-400 text-right tabular-nums">{f.misses}</span>
                          <span className={`text-[11px] font-mono text-right w-[44px] tabular-nums ${color}`}>{pct.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <a
                  href="https://app.codecov.io/gh/bon2362/poker-timer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-violet-400 hover:text-violet-300 self-start mt-1"
                >
                  Открыть Codecov →
                </a>
              </>
            ) : (
              <div className="text-[#555] text-[12px]">Нет данных</div>
            )}
          </CiCard>
        </>
        );
      })()}
    </div>
  );
}

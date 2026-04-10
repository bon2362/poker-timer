import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Poker Timer | Vibe',
  description: 'Презентация продукта, возможностей и архитектуры Poker Timer',
};

const heroImage =
  'https://images.unsplash.com/photo-1670251400844-26c200b75a0f?ixlib=rb-4.1.0&q=85&fm=jpg&crop=entropy&cs=srgb&w=1600';

const opsImage =
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80';

const capabilities = [
  ['Турнирный таймер', 'Уровни блайндов, перерывы, предупреждения за минуту, overtime на финальном уровне.'],
  ['Игровая сессия', 'Состав игроков, buy-in, rebuy, add-on, стартовый стек и лимиты ребаев.'],
  ['Финансы и призы', 'Автоматический банк, распределение призовых мест, актуальные выплаты по ходу игры.'],
  ['Операционный экран', 'Большой desktop-таймер, следующий уровень, управление паузой, игроки и таблица комбинаций.'],
  ['Мобильное управление', 'Телефон работает как лёгкая админ-панель для ребаев, аддонов, вылетов и победителя.'],
  ['Медиа на перерывах', 'Слайдшоу фотографий из Supabase Storage, отдельный экран победителя и звуковые уведомления.'],
];

const clients = [
  ['Desktop web', 'Главный экран турнира', 'Next.js App Router, React Context, anchor-based timer'],
  ['Mobile web', 'Пульт для ведущего и зрительский таймер', 'Тот же источник данных, адаптивный portrait-режим'],
  ['iOS app', 'Управление с телефона и Lock Screen', 'Supabase RPC, Live Activity, APNs через Edge Function'],
];

const dataLayers = [
  ['Postgres', 'sessions, session_players, players, timer_state'],
  ['Realtime', 'Broadcast-канал для состояния таймера и настройки отображения'],
  ['RPC', 'Команды iOS и безопасная запись timer_state при включённом RLS'],
  ['Storage', 'Фотографии для слайдшоу и изображения победителей'],
  ['Edge Function', 'Push-обновления Live Activity через APNs'],
];

const flow = [
  'Ведущий настраивает сессию и запускает первый раунд.',
  'Desktop-экран ведёт турнир по anchor-based таймеру и пишет контрольное состояние.',
  'Mobile web получает те же данные и управляет игровыми событиями.',
  'iOS отправляет команды через RPC, не требуя открытого web-клиента.',
  'Supabase синхронизирует состояние между устройствами и хранит историю сессии.',
];

const riskControls = [
  ['Согласованность времени', 'Таймер считает от anchor timestamp, поэтому reload не зависит от частоты setInterval.'],
  ['Разделение контуров', 'Игровые события и состояние таймера живут в разных таблицах и синхронизируются независимо.'],
  ['RLS-ready подход', 'Запись timer_state вынесена в RPC, чтобы web-клиент не зависел от прямого UPDATE-доступа.'],
  ['Graceful restore', 'Если сохранённый timer_state старше активной сессии, клиент не поднимает устаревший раунд.'],
];

export default function VibePage() {
  return (
    <main className="h-[100dvh] overflow-y-auto bg-[#121212] text-white">
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .vibe-hero-image {
            animation: vibeDrift 18s ease-in-out infinite alternate;
            transform-origin: center;
          }

          .vibe-rise {
            animation: vibeRise 680ms ease-out both;
          }

          .vibe-delay-1 {
            animation-delay: 90ms;
          }

          .vibe-delay-2 {
            animation-delay: 180ms;
          }

          .vibe-device {
            transition: transform 220ms ease, border-color 220ms ease, background 220ms ease;
          }

          .vibe-device:hover {
            transform: translateY(-4px);
            border-color: rgb(52 211 153 / 0.65);
            background: #242424;
          }

          @supports (animation-timeline: view()) {
            .vibe-reveal {
              animation: vibeReveal both ease-out;
              animation-range: entry 10% cover 28%;
              animation-timeline: view();
              opacity: 0;
              transform: translateY(18px);
            }
          }
        }

        @keyframes vibeDrift {
          from {
            transform: scale(1);
          }

          to {
            transform: scale(1.045);
          }
        }

        @keyframes vibeRise {
          from {
            opacity: 0;
            transform: translateY(18px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes vibeReveal {
          from {
            opacity: 0;
            transform: translateY(18px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <section className="relative min-h-[82dvh] overflow-hidden">
        <img
          src={heroImage}
          alt="Покерный стол с картами и фишками"
          className="vibe-hero-image absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative mx-auto flex min-h-[82dvh] max-w-6xl flex-col justify-center px-6 py-16">
          <p className="vibe-rise mb-4 max-w-2xl text-base font-semibold text-emerald-300">Poker Timer</p>
          <h1 className="vibe-rise vibe-delay-1 max-w-4xl text-4xl font-black leading-tight md:text-6xl">
            Операционный контур для живого покерного турнира
          </h1>
          <p className="vibe-rise vibe-delay-1 mt-6 max-w-3xl text-lg leading-8 text-white/75">
            Продукт закрывает ритм игры, учёт участников, банк, призы, мобильное управление и iOS Live Activity в одной синхронизированной системе.
          </p>
          <div className="vibe-rise vibe-delay-2 mt-8 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
            {['Desktop screen', 'Mobile control', 'iOS Live Activity'].map(item => (
              <div key={item} className="border border-white/20 bg-black/40 p-4">
                <div className="text-sm font-bold text-amber-300">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/15 bg-[#181818] px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="mb-3 text-sm font-semibold text-red-300">Для менеджеров</p>
              <h2 className="text-3xl font-black leading-tight md:text-4xl">Что даёт продукт</h2>
              <p className="mt-5 text-base leading-8 text-white/70">
                Таймер превращает домашний турнир из набора ручных действий в управляемый процесс: кто играет, сколько фишек в игре, когда растут блайнды, кто вылетел, какой банк и кто получает выплаты.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {capabilities.map(([title, body]) => (
                <article key={title} className="vibe-reveal border border-white/15 bg-[#202020] p-5">
                  <h3 className="text-lg font-bold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/60">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/15 bg-[#111] px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-sm font-semibold text-emerald-300">Клиентские контуры</p>
              <h2 className="text-3xl font-black leading-tight md:text-4xl">Один турнир, три способа управления</h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-white/60">
              Desktop, mobile web и iOS не конкурируют за владение состоянием. Каждый клиент работает со своим сценарием, а синхронизация проходит через Supabase.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {clients.map(([name, role, tech]) => (
              <article key={name} className="vibe-device vibe-reveal border border-white/15 bg-[#1d1d1d] p-5">
                <div className="mb-5 h-48 overflow-hidden bg-[#0d0d0d]">
                  <div className="flex h-full flex-col justify-between p-4">
                    <div className="flex justify-between text-xs text-white/50">
                      <span>{name}</span>
                      <span>live</span>
                    </div>
                    <div>
                      <div className="mb-3 text-5xl font-black text-white">{name === 'iOS app' ? '18:42' : '20:00'}</div>
                      <div className="h-2 w-2/3 bg-emerald-500" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="h-8 bg-red-500/70" />
                      <div className="h-8 bg-amber-400/70" />
                      <div className="h-8 bg-emerald-500/70" />
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-black">{name}</h3>
                <p className="mt-2 text-sm font-semibold text-amber-200">{role}</p>
                <p className="mt-3 text-sm leading-6 text-white/60">{tech}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/15 bg-[#181818] px-6 py-14">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="mb-3 text-sm font-semibold text-amber-300">Архитектура</p>
            <h2 className="text-3xl font-black leading-tight md:text-4xl">Как система связана</h2>
            <p className="mt-5 text-base leading-8 text-white/70">
              Frontend построен на Next.js и React. Игровые данные лежат в Supabase Postgres. Realtime отвечает за живую синхронизацию, RPC закрывает управляемые команды, Storage хранит медиа, Edge Function доставляет обновления в iOS Live Activity.
            </p>
          </div>
          <div className="overflow-hidden border border-white/15">
            <img src={opsImage} alt="Рабочий ноутбук как символ операционного контроля" className="h-80 w-full object-cover" />
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-3 md:grid-cols-5">
          {dataLayers.map(([title, body]) => (
            <article key={title} className="vibe-reveal border border-white/15 bg-[#202020] p-4">
              <h3 className="text-base font-black text-emerald-300">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/60">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-white/15 bg-[#111] px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="mb-3 text-sm font-semibold text-red-300">Поток работы</p>
              <h2 className="text-3xl font-black leading-tight md:text-4xl">От старта игры до победителя</h2>
            </div>
            <div className="grid gap-3">
              {flow.map((item, index) => (
                <div key={item} className="vibe-reveal grid grid-cols-[48px_1fr] gap-4 border border-white/15 bg-[#1d1d1d] p-4">
                  <div className="grid h-12 w-12 place-items-center bg-emerald-500 text-lg font-black text-black">{index + 1}</div>
                  <p className="self-center text-base leading-7 text-white/70">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/15 bg-[#181818] px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 max-w-3xl">
            <p className="mb-3 text-sm font-semibold text-amber-300">Надёжность</p>
            <h2 className="text-3xl font-black leading-tight md:text-4xl">Что снижает операционный риск</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {riskControls.map(([title, body]) => (
              <article key={title} className="vibe-reveal border border-white/15 bg-[#202020] p-5">
                <h3 className="text-lg font-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/60">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/15 bg-[#101010] px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-sm font-semibold text-emerald-300">Текущее состояние</p>
          <h2 className="max-w-4xl text-3xl font-black leading-tight md:text-4xl">
            Продукт уже закрывает live-операции турнира и готов к дальнейшей упаковке: домен, бренд, onboarding и production hardening.
          </h2>
        </div>
      </section>
    </main>
  );
}

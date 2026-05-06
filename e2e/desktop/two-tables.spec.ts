import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

type TestPlayer = { id: string; name: string };
type DbSessionPlayer = { session_id: string };

let supabase: SupabaseClient | null = null;
let players: TestPlayer[] = [];
let sessionIds: string[] = [];

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

function getSupabase() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required for two-table E2E');
  }

  supabase ??= createClient(url, anonKey);
  return supabase;
}

function isLocalBaseURL(baseURL: string | undefined) {
  if (!baseURL) return false;
  const { hostname } = new URL(baseURL);
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

async function failOnSupabaseError<T>(query: PromiseLike<{ data: T | null; error: unknown }>) {
  const { data, error } = await query;
  if (error) throw error;
  return data as T;
}

async function createTestPlayers(client: SupabaseClient) {
  const suffix = Date.now().toString(36);
  const names = Array.from({ length: 6 }, (_, index) => `E2E TwoTables ${suffix} ${index + 1}`);
  return failOnSupabaseError<TestPlayer[]>(
    client
      .from('players')
      .insert(names.map(name => ({ name })))
      .select('id, name')
  );
}

async function findCreatedSessionIds(client: SupabaseClient) {
  if (players.length === 0) return [];
  const playerIds = players.map(player => player.id);
  const rows = await failOnSupabaseError<DbSessionPlayer[]>(
    client
      .from('session_players')
      .select('session_id')
      .in('player_id', playerIds)
  );
  return Array.from(new Set(rows.map(row => row.session_id)));
}

async function cleanupTestData() {
  if (!supabase) return;
  const ids = Array.from(new Set([...sessionIds, ...(await findCreatedSessionIds(supabase))]));
  const playerIds = players.map(player => player.id);

  if (ids.length > 0) {
    await supabase.from('session_players').delete().in('session_id', ids);
    await supabase.from('sessions').delete().in('id', ids);
  }
  if (playerIds.length > 0) {
    await supabase.from('players').delete().in('id', playerIds);
  }

  players = [];
  sessionIds = [];
}

async function openSettings(page: Page) {
  await expect(page.locator('text=Round 1')).toBeVisible({ timeout: 15000 });

  const setupButton = page.getByRole('button', { name: 'Открыть настройки' });
  if (await setupButton.isVisible()) {
    await setupButton.click();
  } else {
    await page.evaluate(() => {
      document.querySelector<HTMLButtonElement>('button[title="Settings"]')?.click();
    });
  }

  await expect(page.locator('h1', { hasText: 'НАСТРОЙКИ' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Турнир' }).click();
}

async function startTwoTableSession(page: Page) {
  await openSettings(page);
  await page.getByRole('button', { name: '2' }).first().click();

  for (const player of players) {
    await page.getByLabel(player.name).check();
  }

  const table2Buttons = page.getByRole('button', { name: 'Стол 2' });
  for (let index = 3; index < 6; index += 1) {
    await table2Buttons.nth(index).click();
  }

  await page.locator('label', { hasText: 'Порог объединения' }).locator('..').locator('input').fill('4');
  await page.getByRole('button', { name: '▶ Начать игру' }).click();

  await expect(page.getByText('Стол 1 (3)')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Стол 2 (3)')).toBeVisible();
  sessionIds = await findCreatedSessionIds(getSupabase());
  expect(sessionIds).toHaveLength(1);
}

async function eliminatePlayer(page: Page, playerName: string) {
  const name = page.getByText(playerName, { exact: true });
  await name.click();
  await name
    .locator('xpath=ancestor::div[contains(@class, "flex-col")][1]')
    .getByRole('button', { name: 'Вылетел:а' })
    .click();
}

test.describe.serial('Two-table mode - Desktop', () => {
  test.beforeEach(async ({ baseURL, page }) => {
    test.skip(!isLocalBaseURL(baseURL), 'Two-table E2E mutates session data and only runs against local/CI baseURL');

    const client = getSupabase();
    await cleanupTestData();
    await failOnSupabaseError(client.from('sessions').update({ status: 'finished' }).eq('status', 'active'));
    players = await createTestPlayers(client);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    await cleanupTestData();
  });

  test('sets up two tables, merges at threshold, and finishes with a winner', async ({ page }) => {
    await startTwoTableSession(page);

    await eliminatePlayer(page, players[0].name);
    await expect(page.getByText('Объединить столы?')).not.toBeVisible();

    await eliminatePlayer(page, players[1].name);
    await expect(page.getByText('Объединить столы?')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Объединить' }).click();

    await expect(page.getByText('Объединить столы?')).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByText('В игре (4)')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Стол 1 (')).not.toBeVisible();
    await expect(page.getByText('Стол 2 (')).not.toBeVisible();

    await eliminatePlayer(page, players[2].name);
    await eliminatePlayer(page, players[3].name);
    await eliminatePlayer(page, players[4].name);

    await expect(page.getByRole('button', { name: '🏆 Объявить победителем' })).toBeVisible();
    await page.getByRole('button', { name: '🏆 Объявить победителем' }).click();
    await expect(page.getByText(players[5].name, { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Победитель')).toBeVisible();
  });
});

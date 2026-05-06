import { DEFAULT_CONFIG, saveConfig as saveLocalConfig } from '@/lib/storage';
import { getClient } from '@/supabase/client';
import type { Config } from '@/types/timer';

function cloneDefaultConfig(): Config {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Config;
}

export function normalizeConfig(value: unknown): Config | null {
  if (!value || typeof value !== 'object') return null;
  return { ...cloneDefaultConfig(), ...(value as Partial<Config>) };
}

export async function fetchAppConfig(): Promise<Config | null> {
  const client = getClient();
  if (!client) return null;

  const { data, error } = await client
    .from('app_config')
    .select('config_json')
    .eq('id', 'main')
    .maybeSingle();

  if (error || !data) return null;
  return normalizeConfig(data.config_json);
}

export async function saveAppConfig(config: Config): Promise<void> {
  const client = getClient();
  if (!client) return;

  const { error: rpcError } = await client.rpc('set_app_config', {
    config_json_arg: config,
  });

  if (!rpcError) return;

  const { data, error } = await client
    .from('app_config')
    .upsert({
      id: 'main',
      config_json: config,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle();

  if (error) {
    console.warn('saveAppConfig: failed to persist app_config', error.message);
    return;
  }

  if (!data) {
    console.warn('saveAppConfig: app_config write returned no row; check RLS or set_app_config RPC');
  }
}

export function cacheAppConfig(config: Config): void {
  saveLocalConfig(config);
}

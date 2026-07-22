import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null | undefined;

export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

export function getSupabasePublicConfig(env = import.meta.env): SupabasePublicConfig | null {
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function hasSupabasePublicConfig(env = import.meta.env): boolean {
  return getSupabasePublicConfig(env) !== null;
}

export function createBrowserSupabaseClient(
  config: SupabasePublicConfig | null = getSupabasePublicConfig(),
): SupabaseClient | null {
  if (!config) {
    return null;
  }

  browserClient ??= createClient(config.url, config.anonKey);
  return browserClient;
}

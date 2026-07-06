import { hasSupabasePublicConfig } from '../../lib/supabase';

export type EnvConfigReadinessStatus = 'missing' | 'present';

export interface EnvConfigReadiness {
  status: EnvConfigReadinessStatus;
  title: string;
  description: string;
}

export function getEnvConfigReadiness(): EnvConfigReadiness {
  if (hasSupabasePublicConfig()) {
    return {
      status: 'present',
      title: 'Publieke Supabase-config aanwezig',
      description:
        'De publieke Vite-variabelen lijken aanwezig. De app gebruikt ze nog niet voor login of data-opvraging.',
    };
  }

  return {
    status: 'missing',
    title: 'Publieke Supabase-config ontbreekt',
    description:
      'De publieke Vite-variabelen zijn nog niet ingevuld. Dat is voorlopig veilig: de app doet nog geen login of data-opvraging.',
  };
}

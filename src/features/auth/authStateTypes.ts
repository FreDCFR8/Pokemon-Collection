export type AuthReadinessStatus = 'not_configured' | 'configured_not_active' | 'active_later';

export interface AuthStatePlaceholder {
  status: AuthReadinessStatus;
  title: string;
  description: string;
}

export const phase2AuthStatePlaceholder: AuthStatePlaceholder = {
  status: 'configured_not_active',
  title: 'Login-flow nog niet actief',
  description:
    'De Supabase client-boundary bestaat, maar deze app doet nog geen auth-call en leest nog geen echte profielgegevens.',
};

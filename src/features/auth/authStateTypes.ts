export type AuthReadinessStatus =
  | 'config_missing'
  | 'checking'
  | 'signed_out'
  | 'session_present_profile_pending'
  | 'check_failed';

export interface AuthReadinessState {
  status: AuthReadinessStatus;
  title: string;
  description: string;
}

export const initialAuthReadinessState: AuthReadinessState = {
  status: 'checking',
  title: 'Auth-status controleren',
  description:
    'De app controleert alleen of er een browser-sessie bestaat. Er wordt nog geen profiel- of collectiegegevens opgehaald.',
};

export const configMissingAuthReadinessState: AuthReadinessState = {
  status: 'config_missing',
  title: 'Publieke configuratie ontbreekt',
  description:
    'De publieke browserconfiguratie is niet beschikbaar. De app start daarom geen auth-controle.',
};

export const signedOutAuthReadinessState: AuthReadinessState = {
  status: 'signed_out',
  title: 'Geen actieve login',
  description:
    'Er is geen browser-sessie gevonden. Dit is verwacht zolang de echte login-flow nog niet is toegevoegd.',
};

export const sessionPresentProfilePendingAuthReadinessState: AuthReadinessState = {
  status: 'session_present_profile_pending',
  title: 'Sessie aanwezig, app-profiel nog niet geladen',
  description:
    'Er is een browser-sessie gevonden, maar de app haalt nog geen profielgegevens of collectiegegevens op.',
};

export function failedAuthReadinessState(message?: string): AuthReadinessState {
  return {
    status: 'check_failed',
    title: 'Auth-controle mislukt',
    description: message
      ? `De sessiecontrole gaf een fout: ${message}`
      : 'De sessiecontrole gaf een fout. Er wordt geen profiel- of collectiegegevens opgehaald.',
  };
}

export type AuthReadinessStatus =
  | 'loading'
  | 'signed-out'
  | 'session-present'
  | 'config-missing'
  | 'error';

export interface AuthReadinessState {
  status: AuthReadinessStatus;
  title: string;
  description: string;
  sessionPresent: boolean;
  profileDataLoaded: false;
  collectionDataLoaded: false;
  errorMessage?: string;
}

export const authReadinessCopy: Record<AuthReadinessStatus, Pick<AuthReadinessState, 'title' | 'description'>> = {
  loading: {
    title: 'Auth-sessie wordt gecontroleerd',
    description:
      'De app controleert alleen of Supabase Auth lokaal een sessie kent. Profiel- en collectiegegevens blijven onaangeraakt.',
  },
  'signed-out': {
    title: 'Geen actieve auth-sessie',
    description:
      'Supabase Auth meldt geen actieve sessie. Er wordt geen profiel-query uitgevoerd en er wordt geen collectie-data geladen.',
  },
  'session-present': {
    title: 'Auth-sessie aanwezig',
    description:
      'Er is een Supabase Auth-sessie gevonden. Dit is alleen een readiness-check: profieldata en collectiegegevens worden niet opgehaald.',
  },
  'config-missing': {
    title: 'Supabase-config ontbreekt',
    description:
      'De publieke Supabase-configuratie ontbreekt, dus er wordt geen auth-client aangemaakt en er worden geen requests gedaan.',
  },
  error: {
    title: 'Auth-readiness kon niet gecontroleerd worden',
    description:
      'De sessiestatus kon niet veilig bepaald worden. De app blijft zonder profiel- of collectiegegevens werken.',
  },
};

export function createAuthReadinessState(
  status: AuthReadinessStatus,
  options: { sessionPresent?: boolean; errorMessage?: string } = {},
): AuthReadinessState {
  return {
    ...authReadinessCopy[status],
    status,
    sessionPresent: options.sessionPresent ?? status === 'session-present',
    profileDataLoaded: false,
    collectionDataLoaded: false,
    errorMessage: options.errorMessage,
  };
}

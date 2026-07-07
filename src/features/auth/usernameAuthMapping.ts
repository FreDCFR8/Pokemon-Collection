import type { KnownChildUsername, UsernameAuthTarget } from './usernameAuthMappingTypes';

const usernameAuthTargets = {
  lars: {
    username: 'lars',
    hiddenAuthEmail: 'lars@internal.local',
    displayName: 'Lars',
    childKey: 'lars',
  },
  lore: {
    username: 'lore',
    hiddenAuthEmail: 'lore@internal.local',
    displayName: 'Lore',
    childKey: 'lore',
  },
} as const satisfies Record<KnownChildUsername, UsernameAuthTarget>;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isKnownChildUsername(username: string): username is KnownChildUsername {
  return normalizeUsername(username) in usernameAuthTargets;
}

export function resolveUsernameAuthTarget(username: string): UsernameAuthTarget | null {
  const normalizedUsername = normalizeUsername(username);

  if (!isKnownChildUsername(normalizedUsername)) {
    return null;
  }

  return usernameAuthTargets[normalizedUsername];
}

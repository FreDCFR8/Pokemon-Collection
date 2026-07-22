import type {
  KnownChildUsername,
  KnownUsername,
  UsernameAuthTarget,
} from './usernameAuthMappingTypes';

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
  frederik: {
    username: 'frederik',
    hiddenAuthEmail: 'frederik.de.causemaeker@telenet.be',
    displayName: 'Frederik',
    childKey: null,
  },
} as const satisfies Record<KnownUsername, UsernameAuthTarget>;

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isKnownUsername(username: string): username is KnownUsername {
  return normalizeUsername(username) in usernameAuthTargets;
}

export function isKnownChildUsername(username: string): username is KnownChildUsername {
  const normalizedUsername = normalizeUsername(username);
  return normalizedUsername === 'lars' || normalizedUsername === 'lore';
}

export function resolveUsernameAuthTarget(username: string): UsernameAuthTarget | null {
  const normalizedUsername = normalizeUsername(username);

  if (!isKnownUsername(normalizedUsername)) {
    return null;
  }

  return usernameAuthTargets[normalizedUsername];
}

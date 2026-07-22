export type KnownChildUsername = 'lars' | 'lore';
export type KnownUsername = KnownChildUsername | 'frederik';

export type UsernameAuthTarget = {
  username: KnownUsername;
  hiddenAuthEmail: string;
  displayName: string;
  childKey: KnownChildUsername | null;
};

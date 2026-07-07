export type KnownChildUsername = 'lars' | 'lore';

export type UsernameAuthTarget = {
  username: KnownChildUsername;
  hiddenAuthEmail: string;
  displayName: string;
  childKey: KnownChildUsername;
};

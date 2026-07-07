export type ProfileRole = 'parent' | 'child';

export type ProfileReadinessStatus =
  | 'loading'
  | 'config-missing'
  | 'signed-out'
  | 'profile-ready'
  | 'profile-missing'
  | 'error';

export type AppProfile = {
  id: string;
  authUserId: string;
  username: string;
  displayName: string;
  role: ProfileRole;
  childKey: 'lars' | 'lore' | null;
};

export type ProfileReadinessState = {
  status: ProfileReadinessStatus;
  message: string;
  profile: AppProfile | null;
  errorMessage?: string;
};

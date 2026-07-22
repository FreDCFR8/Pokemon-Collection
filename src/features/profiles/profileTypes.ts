export type ProfileRole = 'admin' | 'child';

export type ProfileId = string;
export type AuthUserId = string;

export interface Profile {
  id: ProfileId;
  authUserId: AuthUserId;
  displayName: string;
  role: ProfileRole;
  createdAt: string;
  updatedAt: string;
}

export type LegacyCollectionName = 'Lars' | 'Lore';

export interface LegacyCollectionMapping {
  legacyCollectionName: LegacyCollectionName;
  targetProfileId: ProfileId;
}

export function isChildProfile(profile: Profile): boolean {
  return profile.role === 'child';
}

export function isParentAdminProfile(profile: Profile): boolean {
  return profile.role === 'admin';
}

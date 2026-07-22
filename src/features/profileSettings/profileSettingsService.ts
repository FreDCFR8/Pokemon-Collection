import { createBrowserSupabaseClient } from '../../lib/supabase';

export type ProfileSettingsSummary = {
  id: string;
  username: string;
  displayName: string;
  role: 'child' | 'admin';
  childKey: 'lars' | 'lore' | null;
};

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  role: ProfileSettingsSummary['role'];
  child_key: ProfileSettingsSummary['childKey'];
};

export function validateDisplayName(value: string): string | null {
  const normalized = value.trim();
  if (normalized.length < 2) return 'De weergavenaam moet minstens 2 tekens bevatten.';
  if (normalized.length > 40) return 'De weergavenaam mag maximaal 40 tekens bevatten.';
  return null;
}

export async function loadChildProfiles(): Promise<ProfileSettingsSummary[]> {
  const client = createBrowserSupabaseClient();
  if (!client) throw new Error('Profielen kunnen nu niet worden geladen.');
  const { data, error } = await client
    .from('profiles')
    .select('id, username, display_name, role, child_key')
    .eq('role', 'child')
    .order('child_key', { ascending: true });
  if (error) throw new Error('Profielen kunnen nu niet worden geladen.');
  return ((data ?? []) as ProfileRow[]).map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    childKey: row.child_key,
  }));
}

export async function updateProfileDisplayName(profileId: string, displayName: string): Promise<string> {
  const validationError = validateDisplayName(displayName);
  if (validationError) throw new Error(validationError);
  const client = createBrowserSupabaseClient();
  if (!client) throw new Error('De wijziging kan nu niet worden opgeslagen.');
  const normalized = displayName.trim();
  const { data, error } = await client.rpc('update_profile_display_name', {
    target_profile_id: profileId,
    new_display_name: normalized,
  });
  if (error || data !== normalized) throw new Error('De wijziging kan nu niet worden opgeslagen.');
  return normalized;
}

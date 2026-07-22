import { createBrowserSupabaseClient } from '../../lib/supabase';

export async function logout(): Promise<{ ok: boolean; message: string }> {
  const client = createBrowserSupabaseClient();
  if (!client) return { ok: false, message: 'Uitloggen is nu niet mogelijk. Probeer het later opnieuw.' };
  const { error } = await client.auth.signOut();
  return error ? { ok: false, message: 'Uitloggen is niet gelukt. Probeer het opnieuw.' } : { ok: true, message: 'Je bent uitgelogd.' };
}

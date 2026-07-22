import type { Session, User } from '@supabase/supabase-js';
import { identityErrorState, signedOutIdentityState } from './identityResolutionService.ts';
import { initialIdentityState, type IdentityState } from './identityRuntimeTypes.ts';

type AuthResult = { data: { session: Session | null }; error: unknown };
type AuthSubscription = { data: { subscription: { unsubscribe(): void } } };
export type IdentityAuthClient = {
  auth: {
    getSession(): Promise<AuthResult>;
    onAuthStateChange(callback: (event: string, session: Session | null) => void): AuthSubscription;
  };
};
export type IdentityResolver = (user: User) => Promise<IdentityState>;
export type IdentityLogout = () => Promise<{ ok: boolean; message: string }>;
type Listener = (state: IdentityState) => void;

export type IdentityRuntime = ReturnType<typeof createIdentityRuntime>;

export function createIdentityRuntime(client: IdentityAuthClient | null, resolveIdentity: IdentityResolver, performLogout: IdentityLogout) {
  let state = initialIdentityState;
  let generation = 0;
  let subscription: { unsubscribe(): void } | null = null;
  let started = false;
  const listeners = new Set<Listener>();
  const publish = (next: IdentityState) => { state = next; listeners.forEach((listener) => listener(next)); };
  const applyUser = async (user: User | null) => {
    if (!started) return;
    const request = ++generation;
    if (!user) { publish(signedOutIdentityState()); return; }
    publish({ status: 'authenticated_profile_loading', user, profile: null, mainCollection: null, message: 'Je profiel wordt geladen…' });
    const next = await resolveIdentity(user);
    if (request === generation) publish(next);
  };
  const initialize = async () => {
    if (!started) return;
    const request = ++generation;
    if (!client) { publish(identityErrorState()); return; }
    publish(initialIdentityState);
    const result = await client.auth.getSession();
    if (request !== generation) return;
    if (result.error) { publish(identityErrorState()); return; }
    await applyUser(result.data.session?.user ?? null);
  };
  return {
    getState: () => state,
    subscribe(listener: Listener) { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    start() {
      if (started) return;
      started = true;
      if (client) subscription = client.auth.onAuthStateChange((_event, session) => { void applyUser(session?.user ?? null); }).data.subscription;
      void initialize();
    },
    retry: initialize,
    async signOut() {
      ++generation;
      publish(signedOutIdentityState());
      const result = await performLogout();
      if (!result.ok) publish(identityErrorState());
      return result;
    },
    dispose() {
      ++generation;
      subscription?.unsubscribe();
      subscription = null;
      started = false;
      listeners.clear();
    },
  };
}

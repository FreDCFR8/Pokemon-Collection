import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createBrowserSupabaseClient } from '../../lib/supabase';
import { identityErrorState, resolveAuthenticatedIdentity, signedOutIdentityState } from './identityResolutionService';
import { initialIdentityState, setIdentitySnapshot, type IdentityState } from './identityRuntimeTypes';
import { logout } from './logoutService';

type Value = IdentityState & { signOut: () => Promise<void>; retry: () => Promise<void>; isSigningOut: boolean };
const IdentityContext = createContext<Value | null>(null);
export function IdentityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<IdentityState>(initialIdentityState);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const generation = useRef(0);
  const client = createBrowserSupabaseClient();
  const publish = useCallback((next: IdentityState) => { setIdentitySnapshot(next); setState(next); }, []);
  const applyUser = useCallback(async (user: Parameters<typeof resolveAuthenticatedIdentity>[1] | null) => {
    const request = ++generation.current;
    if (!user) { publish(signedOutIdentityState()); return; }
    if (!client) { publish(identityErrorState()); return; }
    publish({ status: 'authenticated_profile_loading', user, profile: null, mainCollection: null, message: 'Je profiel wordt geladen…' });
    const next = await resolveAuthenticatedIdentity(client, user);
    if (request === generation.current) publish(next);
  }, [client, publish]);
  const retry = useCallback(async () => {
    if (!client) { publish(identityErrorState()); return; }
    publish(initialIdentityState);
    const { data, error } = await client.auth.getSession();
    if (error) publish(identityErrorState()); else await applyUser(data.session?.user ?? null);
  }, [applyUser, client, publish]);
  useEffect(() => {
    if (!client) { publish(identityErrorState()); return; }
    void retry();
    const { data } = client.auth.onAuthStateChange((_event, session) => { void applyUser(session?.user ?? null); });
    return () => { generation.current += 1; data.subscription.unsubscribe(); };
  }, [applyUser, client, publish, retry]);
  const signOut = async () => {
    if (isSigningOut) return;
    generation.current += 1;
    publish(signedOutIdentityState());
    setIsSigningOut(true);
    const result = await logout();
    if (!result.ok) publish(identityErrorState());
    setIsSigningOut(false);
  };
  return <IdentityContext.Provider value={{ ...state, signOut, retry, isSigningOut }}>{children}</IdentityContext.Provider>;
}
export function useIdentity() {
  const value = useContext(IdentityContext);
  if (!value) throw new Error('useIdentity moet binnen IdentityProvider worden gebruikt.');
  return value;
}

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createBrowserSupabaseClient } from '../../lib/supabase';
import { resolveAuthenticatedIdentity } from './identityResolutionService';
import { createIdentityRuntime } from './identityRuntime';
import { initialIdentityState, setIdentitySnapshot, type IdentityState } from './identityRuntimeTypes';
import { logout } from './logoutService';

type Value = IdentityState & { signOut: () => Promise<void>; retry: () => Promise<void>; isSigningOut: boolean };
const IdentityContext = createContext<Value | null>(null);
export function IdentityProvider({ children }: { children: ReactNode }) {
  const client = createBrowserSupabaseClient();
  const runtime = useMemo(() => createIdentityRuntime(client, (user) => {
    if (!client) throw new Error('Identity client ontbreekt.');
    return resolveAuthenticatedIdentity(client, user);
  }, logout), [client]);
  const [state, setState] = useState<IdentityState>(initialIdentityState);
  const [isSigningOut, setIsSigningOut] = useState(false);
  useEffect(() => {
    const unsubscribe = runtime.subscribe((next) => { setIdentitySnapshot(next); setState(next); });
    runtime.start();
    return () => { unsubscribe(); runtime.dispose(); };
  }, [runtime]);
  const signOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await runtime.signOut();
    setIsSigningOut(false);
  };
  return <IdentityContext.Provider value={{ ...state, signOut, retry: runtime.retry, isSigningOut }}>{children}</IdentityContext.Provider>;
}
export function useIdentity() {
  const value = useContext(IdentityContext);
  if (!value) throw new Error('useIdentity moet binnen IdentityProvider worden gebruikt.');
  return value;
}

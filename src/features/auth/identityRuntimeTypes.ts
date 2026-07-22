import type { User } from '@supabase/supabase-js';
import type { AppCollection } from '../collections';
import type { AppProfile } from '../profiles';

export type IdentityStatus = 'initializing' | 'signed_out' | 'authenticated_profile_loading' | 'authenticated_ready' | 'authenticated_profile_missing' | 'error';
export type IdentityState = { status: IdentityStatus; user: User | null; profile: AppProfile | null; mainCollection: AppCollection | null; message: string };
export const initialIdentityState: IdentityState = { status: 'initializing', user: null, profile: null, mainCollection: null, message: 'Je account wordt geladen…' };

let currentIdentityState: IdentityState = initialIdentityState;
export function setIdentitySnapshot(state: IdentityState) { currentIdentityState = state; }
export function getIdentitySnapshot() { return currentIdentityState; }

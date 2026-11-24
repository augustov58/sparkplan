/**
 * Authentication Hook
 * Provides authentication state and methods using Supabase Auth
 */

import { useState, useEffect } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, authLinkAtLoad } from '@/lib/supabase';

export interface UseAuthReturn {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  /** True after a password recovery link signed the user in, until they set a new password (#330). */
  passwordRecovery: boolean;
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>;
}

// The recovery state survives a reload of the tab (verifier, #330): without it, a
// reload of /update-password left the user signed in with no way to set the password.
const RECOVERY_KEY = 'sparkplan.passwordRecovery';
function readRecoveryFlag(): boolean {
  try { return sessionStorage.getItem(RECOVERY_KEY) === '1'; } catch { return false; }
}
function writeRecoveryFlag(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(RECOVERY_KEY, '1');
    else sessionStorage.removeItem(RECOVERY_KEY);
  } catch { /* storage blocked: the flag lives in memory only */ }
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecoveryState] = useState(() => {
    const on = authLinkAtLoad.kind === 'recovery' || readRecoveryFlag();
    if (on) writeRecoveryFlag(true);
    return on;
  });
  const setPasswordRecovery = (on: boolean) => {
    writeRecoveryFlag(on);
    setPasswordRecoveryState(on);
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setPasswordRecovery(false); // a stale flag must not catch a later normal sign-in
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setPasswordRecovery(false);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || '',
        },
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    // The app's root, no route: a hash route here would hide the tokens from auth-js
    // (it would read "#/x#access_token=…"). The PASSWORD_RECOVERY event routes the user.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setPasswordRecovery(false);
    return { error };
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    passwordRecovery,
    updatePassword,
  };
}

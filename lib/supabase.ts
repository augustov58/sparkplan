/**
 * Supabase Client Configuration
 * Centralized configuration for Supabase authentication and database
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { readAuthLink, type AuthLink } from './authLinks';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.\n' +
    'Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  );
}

/** The email link this page was opened from, read before the client below clears it (#330). */
export const authLinkAtLoad: AuthLink =
  typeof window === 'undefined' ? { kind: 'none' } : readAuthLink(window.location.hash);

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

/**
 * Helper function to handle Supabase errors
 */
export function handleSupabaseError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as { message: string }).message;
  }
  return 'An unknown error occurred';
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

/**
 * Get current user
 */
export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Sign out helper
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

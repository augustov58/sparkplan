/**
 * What a Supabase email link left in the URL (#330).
 *
 * The links land on the app's root with their parameters in the hash:
 *   recovery  →  /#access_token=…&refresh_token=…&type=recovery
 *   expired   →  /#error=access_denied&error_code=otp_expired&error_description=…
 * HashRouter would read either hash as a route that doesn't exist (a blank
 * page), and auth-js clears the hash once it has read the tokens. So the app
 * reads it once, at module load, before either happens (lib/supabase.ts).
 */
export type AuthLink =
  | { kind: 'none' }
  | { kind: 'recovery' }
  | { kind: 'error'; description: string };

export function readAuthLink(hash: string): AuthLink {
  if (!hash || hash.startsWith('#/')) return { kind: 'none' }; // an app route
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.get('type') === 'recovery' && params.get('access_token')) return { kind: 'recovery' };
  if (params.get('error_code') || params.get('error_description')) {
    return { kind: 'error', description: params.get('error_description') ?? '' };
  }
  return { kind: 'none' };
}

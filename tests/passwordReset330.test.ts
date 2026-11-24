/**
 * #330: "Forgot your password?" led to a blank page. A recovery link lands on
 * the app's root with its tokens in the hash; an expired link with an error.
 * readAuthLink reads which, before auth-js clears the hash and before
 * HashRouter takes it for a route. The new password follows sign-up's rules.
 */
import { describe, it, expect } from 'vitest';
import { readAuthLink } from '../lib/authLinks';
import { signupSchema, updatePasswordSchema, resetPasswordSchema } from '../lib/validation';

describe('#330 readAuthLink', () => {
  it('a recovery link', () => {
    expect(readAuthLink('#access_token=a.b.c&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery'))
      .toEqual({ kind: 'recovery' });
  });

  it('an expired or used link, with its description', () => {
    expect(readAuthLink('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'))
      .toEqual({ kind: 'error', description: 'Email link is invalid or has expired' });
  });

  it('app routes, a sign-up confirmation and an empty hash are not recovery links', () => {
    expect(readAuthLink('#/reset-password')).toEqual({ kind: 'none' });
    expect(readAuthLink('#/project/abc/panel')).toEqual({ kind: 'none' });
    expect(readAuthLink('')).toEqual({ kind: 'none' });
    expect(readAuthLink('#access_token=a.b.c&type=signup')).toEqual({ kind: 'none' }); // auth-js signs in; nothing to route
    expect(readAuthLink('#type=recovery')).toEqual({ kind: 'none' }); // no token, nothing signed in
  });
});

describe('#330 the new password follows the sign-up rules', () => {
  it('accepts a strong matching pair', () => {
    expect(updatePasswordSchema.safeParse({ password: 'NewPassw0rd', confirmPassword: 'NewPassw0rd' }).success).toBe(true);
  });

  it("rejects a mismatch with \"Passwords don't match\"", () => {
    const r = updatePasswordSchema.safeParse({ password: 'NewPassw0rd', confirmPassword: 'NewPassw0rx' });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map(i => i.message)).toContain("Passwords don't match");
  });

  it('rejects a weak password with the sign-up messages', () => {
    const r = updatePasswordSchema.safeParse({ password: 'short', confirmPassword: 'short' });
    expect(r.error!.issues.map(i => i.message)).toContain('Password must be at least 8 characters');
    const s = signupSchema.safeParse({ email: 'a@b.co', password: 'short', confirmPassword: 'short' });
    expect(s.error!.issues.map(i => i.message).sort()).toEqual(
      r.error!.issues.map(i => i.message).sort(),
    ); // guardrail: one rule, the same messages
  });

  it('the reset request needs a valid email', () => {
    expect(resetPasswordSchema.safeParse({ email: 'someone@example.com' }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

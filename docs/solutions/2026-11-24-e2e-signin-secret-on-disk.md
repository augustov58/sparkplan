# A failed test sign-in wrote the QA password to disk (#328)

**Problem.** The e2e QA session got revoked, and the owner's one-time sign-in failed ("Invalid login credentials"). Playwright then saved the typed password in plain text in `test-results/.../error-context.md` (the page's accessibility snapshot includes textbox values). A trace and the HTML report kept the same run.

## How the session died
1. A #315 spec called `page.clock.setFixedTime()` with a time on the next day. supabase-js saw the access token as expired and refreshed it, more than once (R1 → R2 → R3).
2. GoTrue allows reusing a revoked refresh token only when it is the *parent* of the active one; a client that lost a refresh response can retry. Tests load the same `user.json`, so #297's forced refresh reused R1, two steps back. GoTrue treated that as theft, answered "Already Used", and revoked the session. The JWT kept working for REST until its expiry, so most tests still passed.
3. To confirm, refresh once from `user.json` in a throwaway script and save the new tokens if it works. It failed: "Already Used".

## Approach
- Delete every copy first: the setup's test-results folder, the HTML report and the temp traces. The folder is gitignored, so nothing reached git. Tell the owner to rotate the password; it was also read into the conversation.
- Harden `tests/e2e/auth.setup.ts`: empty the password field in a `finally`; close the context before throwing, so no page snapshot is taken; report the page's error text. The `setup` project in `playwright.config.ts` runs with `trace`, `screenshot` and `video` off.
- Prove it with a **dummy** wrong password: the run fails with "Sign-in failed: Invalid login credentials", and `grep -rl <dummy> tests/e2e/__output__` finds 0 files.

## Judgment calls
- The fix was its own PR, merged before the owner re-entered a password. The other way round, a second failed attempt would have written the new password too.
- `getByText(/sign in/i)` was replaced with the heading role plus the error text. It matched the heading and the button, so it could never tell success from failure.

## Reusable rule
Any Playwright project that types a secret runs with no trace, screenshot or video, and empties the field on every path: failure snapshots record textbox values. Never fake the clock in a signed-in context; to test a time-of-day date, change the time zone.

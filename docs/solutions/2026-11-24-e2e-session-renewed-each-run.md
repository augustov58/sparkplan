# The e2e QA session died mid-run, and every death cost the owner a sign-in (#339)

**Problem.** A full `tests/e2e/issues/` run (103 tests, 12.4 min) lost the QA session at test 81: the rest failed with "QA project … is missing" / "not the QA account", and the setup then said "The saved QA session is gone". The password is never stored (#328), so every dead session meant the owner typing it again. He asked for the session to stay alive without him.

## How the session died
1. `auth.setup.ts` reused `user.json` and wrote it back as it found it. supabase-js refreshes only within ~90 s of expiry, so the setup never renewed anything: measured on main, two minutes apart, 59.7 → 59.6 minutes left, the same refresh token. A run could start with less token left than the run takes.
2. Tests run one after another (1 worker), each in a new browser context loaded from the same file. Once the access token neared expiry, each test refreshed from the same saved refresh token. GoTrue tolerates reusing the parent of the active token (a lost response, retried); the next test reused a grandparent → "Already Used" → the whole session revoked (#328 confirmed this mechanism; this run's starting lifetime was not measured).

## Approach
- The setup renews the saved session **once per run, before any browser opens**: `POST /auth/v1/token?grant_type=refresh_token` with the saved refresh token and the app's anon key (Vite's `loadEnv` reads `.env.local` as the dev server does). The token response goes into `sb-<ref>-auth-token` as auth-js stores it (`expires_at` computed if absent), written before anything else, since the old token is now spent.
- Every run then starts with 60 minutes; runs take 9–13. No test refreshes, so the refresh token on disk stays unspent and the next run renews it: a chain that needs no password.
- When the renewal fails, the error names Supabase's reason ("Refresh token is not valid"), so a dead session can be traced to its cause.
- Proof, no password in the environment: two setups in a row, 48.8 → 60.0 → 60.0 minutes, a new refresh token each time; main's setup on the same file, 59.7 → 59.6 and the same token; a fake refresh token → "The saved QA session is gone (Supabase: Refresh token is not valid)", the real file restored; then the full folder on a renewed session: 104 of 105 passed, and the session was still alive after it (50.5 minutes left). The one failure was a Recalculate click before the panels loaded (#341); that spec passed 3 of 3 on rerun.

## Judgment calls
- Not a service-role magic link (`auth.admin.generateLink` + `verifyOtp`): it would never need a password, but it puts a prod admin key in the test runner. The refresh uses only the anon key the app already ships.
- Renew on every run, not below a threshold: one request, and every run starts from the same 60 minutes.
- Not guarded: two runs started at the same moment would both refresh the same saved token. Runs here are one at a time.

## Reusable rule
A saved session shared by many browser contexts under refresh-token rotation is renewed by one owner before the consumers start, and the consumers must finish inside the token's life so none of them refreshes. A dead session is a bug to trace (what spent the token?), never routine for the owner to sign in again.

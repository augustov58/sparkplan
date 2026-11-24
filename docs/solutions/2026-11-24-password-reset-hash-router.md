# Password reset: a blank page, then a link that never asked for a password (#330)

**Problem.** "Forgot your password?" linked to `#/reset-password`, which had no route: a blank page. `resetPassword` existed in `useAuth` but nothing called it. Opening a Supabase recovery link signed the user in and showed the dashboard, with nowhere to set a password. An expired email link was also a blank page.

## Why the links misbehaved
- Supabase (implicit flow, supabase-js 2.86) sends the user to `redirectTo` with the result in the **hash**: `/#access_token=…&type=recovery`, or `/#error=access_denied&error_code=otp_expired&error_description=…`.
- HashRouter reads the hash as the route (`access_token=…`, `error=…`): nothing matches, so the page is blank.
- auth-js parses the hash with `new URLSearchParams(hash.substring(1))`. A `redirectTo` that already has a hash route gives `#/update-password#access_token=…`, whose first key is `/update-password#access_token`, so the token is never found. **`redirectTo` must be the root** (`origin + pathname`), as sign-up's `emailRedirectTo` already was.
- auth-js saves the session, fires `PASSWORD_RECOVERY` and clears the hash, all after an async `getUser`. On an error hash it does not clear anything.
- `Login.tsx`'s "link expired" notice read the hash on mount, but the error link never reached `#/login`, so it never rendered.

## Approach
- Reproduce signed out with a throwaway Playwright script: open the three URL shapes, stubbing `GET /auth/v1/user` so a fake token is accepted. Result: blank, dashboard, blank.
- `lib/authLinks.ts::readAuthLink(hash)` → `recovery | error | none` (an app route `#/…` is `none`). `lib/supabase.ts` evaluates it once, before `createClient` (`authLinkAtLoad`).
- `useAuth`: `passwordRecovery` starts from `authLinkAtLoad` and is set on `PASSWORD_RECOVERY`, cleared on `SIGNED_OUT` and after `updateUser`. `resetPassword` passes `redirectTo: origin + pathname`. New `updatePassword`.
- `AppContent`: a recovery with a user → `/update-password`; an error link → `/login` with the description in route state. `/update-password` renders only during a recovery (signed in otherwise → dashboard; signed out → sign-in), so it is not a change-password screen.
- The new password uses sign-up's rule (one `newPasswordRule` in `lib/validation.ts`).
- The recovery flag is kept in `sessionStorage` for the tab (the verifier found a reload of `/update-password` lost the form) and cleared on sign-out, on a load with no session, and after the update.

## Trap
The first version of both redirects ran in `useEffect(…, [navigate])`. In react-router v6, `useNavigate()` returns a new function when the path changes, so the effect re-ran after every navigation: "Request a new reset link" bounced back to the sign-in page, and a recovering user could never leave the form. Each redirect now fires once (a `useRef`).

## Testing without email
The spec stubs `POST /auth/v1/recover`, `GET/PUT /auth/v1/user`, the token endpoint and REST in a signed-out context, opens the recovery and expired URL shapes directly, and asserts the request bodies (`redirect_to` = the root, `password`). No email is sent and no account changes. Supabase still needs `https://sparkplan.app/` in Auth → Redirect URLs; it already serves sign-up confirmations, which use the same URL.

## Reusable rule
With HashRouter, every Supabase email link lands on the root with its parameters in the hash: read the hash once at load and route from that or from the auth event. Never put a hash route in `redirectTo`. A redirect effect that depends on `navigate` must fire once.

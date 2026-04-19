# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-04-18

---

### Session: 2026-04-18 (PM) — Stripe Webhook Signature Alignment + Dual-Endpoint Cleanup

**Focus**: Close the long-standing "Stripe webhook secret hardcoded in deployed function" carry-over. Root-cause why the env-var approach had failed and re-align deployed source with git so future redeploys don't silently re-break signature verification.
**Status**: ✅ Resolved. `stripe-webhook` v38 is live, env-var based, `verify_jwt: false`. Positive + negative HMAC probes both confirmed. PR #6 open.

**Work Done:**

*Root cause of the drift:*
- Deployed function was at v35 with signing secret hardcoded as `whsec_P0LA...`. Git source was already env-var based (`Deno.env.get('STRIPE_WEBHOOK_SECRET')`) — the hardcode was a workaround never committed back.
- Checked stored `STRIPE_WEBHOOK_SECRET` Supabase secret digest: `ab59c2b1...`. Computed `sha256sum` of the known-working hardcoded value: `1f72f3f6...`. Digests didn't match — so the stored env var was simply wrong, not some Supabase bug as the old memory claimed. That's why the original "env var failed, hardcode works" theory looked real.

*Fix procedure:*
1. Saved the deployed v35 as `.rollback/stripe-webhook-v35.ts` (gitignored — contains live signing secret).
2. Overwrote the Supabase env var: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_P0LA... --project-ref ioarszhzltpisxsxrsgl`. New digest `1f72f3f6...` matched. Proved Supabase uses plain SHA-256 (not salted) for digest display.
3. Redeployed git source: `supabase functions deploy stripe-webhook --no-verify-jwt --project-ref ioarszhzltpisxsxrsgl`. First attempt produced v37 with `verify_jwt: true` (CLI defaults to JWT-on) — would have 401'd every Stripe event at the gateway. Re-ran with the flag → v38, `verify_jwt: false`.

*Verification via direct HMAC probes (no Stripe dashboard needed):*
- Valid signed POST (HMAC-SHA256 of `{timestamp}.{body}` with signing secret) → `200 {"received":true}` ✓
- Forged signature → `400 "No signatures found matching the expected signature..."` ✓ (Stripe library's canonical error, proves verification is executing, not bypassed)
- Gateway accepted both (no `401 UNAUTHORIZED_NO_AUTH_HEADER`), confirming `verify_jwt: false`

*Duplicate webhook endpoint discovered + neutralized:*
- Stripe account had TWO live endpoints pointed at the same URL: `we_1TL9gpBBy9cD3s46mfHz0owG` (the intended one, 6 events) and `we_1TKnPTBBy9cD3s46is2owYNA` ("adventurous-splendor", 7 events, 35/35 failure rate this week).
- Endpoint B's signing secret was never in our env var — hence its 100% failure. Only unique event: `customer.subscription.paused`, which is already caught transitively by `customer.subscription.updated`, so disabling is zero-coverage-loss.
- User **disabled** (not deleted) endpoint B — safe rollback path preserved.

**Key Files Touched:**
- `.gitignore` — added `.rollback/` to prevent committing the v35 snapshot
- `.rollback/stripe-webhook-v35.ts` — v35 snapshot (gitignored, contains live signing secret)
- `docs/SESSION_LOG.md`, `docs/CHANGELOG.md` — updated
- `memory/stripe_webhook_signature.md` — rewritten: resolved, rotation playbook, duplicate-endpoint gotcha

**Commits (branch `fix/stripe-webhook-env-secret`):**
- `e15c297` — fix(stripe-webhook): verify deployed function matches git (env-var-based sig verification)

**PR**: #6 — https://github.com/augustov58/sparkplan/pull/6 (open, awaiting merge)

**Pending:**
- Merge PR #6
- First real Stripe event in live traffic is the final belt-and-suspenders confirmation (watch for 200 in edge-function logs next subscription/invoice event)
- **Recommended hygiene**: rotate signing secret via Stripe dashboard "Roll signing secret" — invalidates the value that's been shared through conversation history and the `.rollback/` snapshot. Follow steps 3-5 in `memory/stripe_webhook_signature.md`.
- Consider deleting endpoint B (`adventurous-splendor`) once a real event has passed through endpoint A cleanly

---

### Session: 2026-04-18 (AM) — Support Inbound Live-Deployment + Four-Bug Debug

**Focus**: Take the Gmail-polling support-inbound pipeline from code-complete to live-verified. User handled infra (Google Cloud OAuth, Supabase secrets, Vault); this session ran `supabase db push`, deployed the three edge functions, and diagnosed/fixed four distinct bugs found during end-to-end testing.
**Status**: Fully operational. Admin→user replies via email thread back into the ticket widget. User→admin replies thread back and notify the admin. PR #5 merged (`fd80444`).

**Work Done:**

*Migration history drift resolution:*
- Remote tracking table had 4 MCP-applied migrations in `YYYYMMDDHHMMSS` format; local files used `YYYYMMDD_name` date-only format. CLI refused to reconcile.
- Renamed all local migration files to unique 14-digit timestamps. Used `supabase migration repair --status applied`/`reverted` to align tracking rows with the new names.
- Applied `20260417000000_support_events_and_investigations.sql` and `20260417000001_support_inbound_cron.sql` to production.

*Four bugs fixed in sequence (each only visible after the prior fix):*

1. **Gateway JWT rejection (both functions)**: Supabase Edge Functions gateway verifies JWT by default. pg_cron's `x-support-inbound-secret` header scheme isn't a JWT, so gateway returned `401 UNAUTHORIZED_NO_AUTH_HEADER` before `support-inbound` ever ran. Similarly, the internal `support-inbound → support-notify` call uses the new-format `sb_secret_...` API key which **is not a JWT** (Supabase's 2025 key redesign), so the gateway rejected that too. Fix: deploy both functions with `--no-verify-jwt`. Each function has its own auth check internally (constant-time secret compare in support-inbound, service-role-match in support-notify).

2. **Vault secret placeholder never replaced**: The Supabase Vault entry for `support_inbound_secret` was the literal template string `<paste openssl_rand_hex output here>` (35 chars, first char `<`, last char `>`). The user had only set the env-var side of the secret pair. Fix: generated fresh `openssl rand -hex 32`, updated both Vault (via `vault.update_secret`) and the edge-function env (via `supabase secrets set`) to matching values.

3. **Shared mailbox not recognized as admin**: The `ADMIN_EMAIL` constant was hardcoded to the registered admin login email (`augustovalbuena@gmail.com`), but admin replies in practice always originate from the shared `support@sparkplan.app` Workspace mailbox. Patched `support-inbound/index.ts` to accept either `ADMIN_EMAIL` OR the `GMAIL_MAILBOX` env var as admin identities.

4. **`is:unread` Gmail query strands opened messages**: The Gmail search filter `is:unread` means any message a human opens in the `support@sparkplan.app` inbox before cron polls it becomes invisible to the function. Workaround documented: mark as unread to re-trigger. Future fix: switch to Gmail History API (the `last_history_id` column is already provisioned).

*Documentation:*
- Expanded `docs/SUPPORT_INBOUND_SETUP.md` troubleshooting section into a **7-stage diagnostic playbook** with exact SQL queries, response-body fingerprints, and remediation steps for every layer from cron firing through echo-email delivery.

**Key Files Touched:**
- `supabase/migrations/*` — renamed all 29 migration files to unique 14-digit timestamps
- `supabase/functions/support-inbound/index.ts` — added `GMAIL_MAILBOX` as admin identity
- `docs/SUPPORT_INBOUND_SETUP.md` — full troubleshooting playbook

**Commits (branch `feat/support-email-inbound`, merged as PR #5):**
- `267452a` — chore(migrations): migrate to 14-digit timestamps; deploy support-inbound stack
- `e0f9614` — fix(support-inbound): recognize shared support mailbox as admin sender
- `9ad2e77` — docs: support-inbound troubleshooting playbook + 2026-04-18 session entry
- `9f36b8a` — docs(roadmap): extend Phase 3.2 to cover inbound email pipeline

**Pending:**
- Future: Gmail History API migration to replace `is:unread` polling (`support_gmail_sync_state.last_history_id` already provisioned)

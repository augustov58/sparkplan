# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-04-18

---

### Session: 2026-04-18 — Support Inbound Live-Deployment + Four-Bug Debug

**Focus**: Take the Gmail-polling support-inbound pipeline from code-complete to live-verified. User handled infra (Google Cloud OAuth, Supabase secrets, Vault); this session ran `supabase db push`, deployed the three edge functions, and diagnosed/fixed four distinct bugs found during end-to-end testing.
**Status**: Fully operational. Admin→user replies via email thread back into the ticket widget. User→admin replies thread back and notify the admin. Branch `feat/support-email-inbound` ready for PR merge.

**Work Done:**

*Migration history drift resolution:*
- Remote tracking table had 4 MCP-applied migrations in `YYYYMMDDHHMMSS` format; local files used `YYYYMMDD_name` date-only format. CLI refused to reconcile.
- Renamed all local migration files to unique 14-digit timestamps. Used `supabase migration repair --status applied`/`reverted` to align tracking rows with the new names.
- Applied `20260417000000_support_events_and_investigations.sql` and `20260417000001_support_inbound_cron.sql` to production.

*Four bugs fixed in sequence (each only visible after the prior fix):*

1. **Gateway JWT rejection (both functions)**: Supabase Edge Functions gateway verifies JWT by default. pg_cron's `x-support-inbound-secret` header scheme isn't a JWT, so gateway returned `401 UNAUTHORIZED_NO_AUTH_HEADER` before `support-inbound` ever ran. Similarly, the internal `support-inbound → support-notify` call uses the new-format `sb_secret_...` API key which **is not a JWT** (Supabase's 2025 key redesign), so the gateway rejected that too. Fix: deploy both functions with `--no-verify-jwt`. Each function has its own auth check internally (constant-time secret compare in support-inbound, service-role-match in support-notify).

2. **Vault secret placeholder never replaced**: The Supabase Vault entry for `support_inbound_secret` was the literal template string `<paste openssl_rand_hex output here>` (35 chars, first char `<`, last char `>`). The user had only set the env-var side of the secret pair. Fix: generated fresh `openssl rand -hex 32`, updated both Vault (via `vault.update_secret`) and the edge-function env (via `supabase secrets set`) to matching values.

3. **Shared mailbox not recognized as admin**: The `ADMIN_EMAIL` constant was hardcoded to the registered admin login email (`augustovalbuena@gmail.com`), but admin replies in practice always originate from the shared `support@sparkplan.app` Workspace mailbox. Patched `support-inbound/index.ts` to accept either `ADMIN_EMAIL` OR the `GMAIL_MAILBOX` env var as admin identities.

4. **`is:unread` Gmail query strands opened messages**: The Gmail search filter `is:unread` means any message a human opens in the `support@sparkplan.app` inbox before cron polls it becomes invisible to the function. User opening received messages to verify they arrived inadvertently marked them read. Workaround documented: mark as unread to re-trigger. Future fix: switch to Gmail History API (the `last_history_id` column is already provisioned).

*Documentation:*
- Expanded `docs/SUPPORT_INBOUND_SETUP.md` troubleshooting section into a **7-stage diagnostic playbook** with exact SQL queries, response-body fingerprints, and remediation steps for every layer from cron firing through echo-email delivery. Includes a "Known limitations" section.

**Key Files Touched:**
- `supabase/migrations/*` — renamed all 29 migration files to unique 14-digit timestamps
- `supabase/functions/support-inbound/index.ts` — added `GMAIL_MAILBOX` as admin identity
- `docs/SUPPORT_INBOUND_SETUP.md` — full troubleshooting playbook
- `docs/SESSION_LOG.md`, `docs/CHANGELOG.md` — updated

**Commits (branch `feat/support-email-inbound`):**
- `267452a` — chore(migrations): migrate to 14-digit timestamps; deploy support-inbound stack
- `e0f9614` — fix(support-inbound): recognize shared support mailbox as admin sender

**Pending:**
- Open PR `feat/support-email-inbound` → `main` (code is green, fully tested live)
- Future: Gmail History API migration to replace `is:unread` polling (`support_gmail_sync_state.last_history_id` already provisioned)
- Future: Stripe webhook signature verification (still disabled — unchanged from prior sessions)

---

### Session: 2026-04-17 — Stripe Custom Email Domain + Support Inbound (Gmail polling) + AI-Investigation Scaffolding

**Focus**: Verify `sparkplan.app` for Stripe's custom email domain, then close out Phase 3.2 by wiring an email-reply → ticket pipeline. Initially attempted Resend Inbound, pivoted to Gmail API polling after hitting the Resend free-tier paywall. Bake in architectural hooks for a future Claude Code bug-investigation runner.
**Status**: All code landed on branch `feat/support-email-inbound`. Stripe DNS verified. Support-inbound ready to deploy once Gmail OAuth bootstrap + Supabase secrets + pg_cron Vault entries are set by user.

**Work Done:**

*Stripe custom email domain (DNS, no code):*
- Added 8 records to Vercel DNS for `sparkplan.app`: root TXT (`stripe-verification=...`), 6 DKIM CNAMEs under `*._domainkey`, `bounce` CNAME → `custom-email-domain.stripe.com`. Pre-existing `_dmarc` reused. Accepted Vercel's wildcard-override prompts per DKIM CNAME. Stripe verified successfully.

*Architecture pivot — Resend → Gmail API polling:*
- Initial plan was a Resend Inbound webhook on `reply.sparkplan.app`. Hit blocker: Resend free tier allows 1 domain and Receiving is bound to domain root, conflicting with Google Workspace MX.
- Chose "Path A-lite": poll Gmail directly via the existing Google Workspace mailbox using plus-addressing (`support+ticket-<uuid>@sparkplan.app`). Zero new infra, zero monthly cost.

*Email-reply pipeline + event log + investigation scaffolding:*
- New migration `20260417_support_events_and_investigations.sql` — three tables:
  - `support_ticket_events` (append-only lifecycle log; discriminator columns `event_type` + `source`; admin-read-only RLS + service_role writes)
  - `support_ticket_investigations` (forward-compatible schema for the future Claude Code runner — `investigator` enum, `status` lifecycle, `findings TEXT`, `artifacts JSONB`, `notified_via` + `notified_at`; added to realtime publication)
  - `support_gmail_sync_state` (singleton polling watermark)
- New migration `20260417_support_inbound_cron.sql` — enables `pg_cron` + `pg_net`, schedules one-minute polling via `vault.decrypted_secrets` for both the URL and shared secret. Safe to re-apply (drops existing job first).
- Shared edge-function helpers:
  - `supabase/functions/_shared/gmail.ts` — OAuth refresh-token flow, list/get/markAsRead, base64url-UTF8 decoding, MIME tree walk with text/plain preferred and HTML stripped fallback
  - `supabase/functions/_shared/supportEvents.ts` — `emitSupportEvent()` (never throws), `getAdminClient()`, `extractTicketIdFromText()` (supports BOTH plus-addressing AND `ticket-<uuid>@reply.*` subdomain scheme for future flexibility), `stripQuotedReply()` (multi-marker conservative), `extractBareAddress()`
- `supabase/functions/support-inbound/index.ts` rewritten for Gmail polling:
  - pg_cron shared-secret auth via `x-support-inbound-secret` header (constant-time compare)
  - Gmail query: `to:support+ticket- is:unread newer_than:1d`
  - Flow: fetch → extract ticket UUID → auth sender (admin vs ticket owner, rejects anything else) → strip quoted → insert reply → emit event → bump status if admin reply on open ticket → fetch `support-notify` to echo to OTHER party → mark-as-read (on any outcome except `error`, which allows retry on transient DB failures)
- `supabase/functions/support-notify/index.ts` updated:
  - Plus-addressed Reply-To: `support+ticket-<uuid>@sparkplan.app` (was `ticket-<uuid>@reply.sparkplan.app`)
  - Internal-trust path: service_role bearer token bypasses user lookup and is treated as admin (needed so support-inbound can echo)
  - New `user_reply` payload type: customer-reply echo to admin with "Customer replied via email" template
- `supabase/functions/support-investigate/index.ts` — stub that inserts `status='skipped'` investigations and emits `investigation_requested` events. Clearly marked TODO points for wiring up Claude Code runner + Slack webhook without future migration churn.
- `scripts/gmail-oauth.ts` — one-shot OAuth bootstrap script (OOB flow, gmail.modify scope, `prompt=consent` to force refresh_token, prints Supabase secrets set command)
- `lib/database.types.ts` — added Row/Insert/Update for all 3 new tables
- `npm run build` ✓ (no regressions)
- `npm test` ✓ 99/99

**Key Files:**
- `supabase/migrations/20260417_support_events_and_investigations.sql` — events + investigations + sync state
- `supabase/migrations/20260417_support_inbound_cron.sql` — pg_cron schedule
- `supabase/functions/_shared/gmail.ts`, `supabase/functions/_shared/supportEvents.ts` — shared helpers
- `supabase/functions/support-inbound/index.ts` — Gmail polling handler
- `supabase/functions/support-investigate/index.ts` — stub for future Claude Code integration
- `supabase/functions/support-notify/index.ts` — plus-addressing + user_reply + service_role trust
- `scripts/gmail-oauth.ts` — OAuth bootstrap
- `lib/database.types.ts`, `docs/CHANGELOG.md`, `docs/SESSION_LOG.md` — updated

**Pending (requires infra work by user before the feature goes live):**
- Google Cloud Console: create project, enable Gmail API, create Desktop-app OAuth 2.0 credentials with `gmail.modify` scope, add self as test user
- Run `deno run --allow-net scripts/gmail-oauth.ts` once to obtain the offline refresh token
- Set Edge Function secrets: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_MAILBOX=support@sparkplan.app`, `SUPPORT_INBOUND_SECRET` (strong random), `SUPPORT_ADMIN_AUTH_USER_ID` (admin's auth.users.id)
- Supabase Vault: `support_inbound_secret` (same as env var) + `supabase_functions_base_url` (so the cron migration can read them)
- Deploy edge functions: `support-notify` (updated), `support-inbound` (new), `support-investigate` (new stub)
- Open PR from `feat/support-email-inbound` → `main` after infra work validates the flow end-to-end on preview

**Pending (future AI-investigation runner — design only, not implemented):**
- Wire `CLAUDE_CODE_WEBHOOK_URL` + `SLACK_WEBHOOK_URL` env vars on `support-investigate`
- Flip the scaffolding stub: change `status='skipped'` → `status='pending'` and either POST to the runner or let a worker poll
- Add pg trigger on `support_ticket_events` that calls `support-investigate` for qualifying events (e.g., new `bug` category tickets)
- Runner itself writes findings back via UPDATE to `support_ticket_investigations`

**Pending (carried over from prior sessions):**
- Stripe webhook signature verification: secret hardcoded in deployed edge function (Supabase env var was failing). Must rotate + re-harden per `memory/stripe_webhook_signature.md` before scaling real-payment volume.


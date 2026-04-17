# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-04-17

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

---

### Session: 2026-04-16 — In-App Support System

**Focus**: Build an end-to-end support ticket system to replace the mailto-only channel. Deploy to Vercel preview for validation, then merge to main.
**Status**: Complete (merged to main via PR #3, merge commit `123324a`)

**Work Done:**

*Scaffold (branch `feat/support-system`, landed in `052ed7e`):*
- `support_tickets` + `support_replies` tables with RLS; storage bucket for image attachments
- `SupportWidget` floating bubble + ticket form + history + threaded reply view
- `AdminSupportPanel` with search/filter/status/priority controls and reply composer
- `useSupportTickets` hook: CRUD, realtime postgres_changes, optimistic updates
- `support-notify` edge function (Resend): `new_ticket` → support@sparkplan.app, `admin_reply` → user
- Deployed edge function v1/v2 via MCP `deploy_edge_function` (Supabase CLI wasn't authenticated)

*RLS fix (landed in `7896976`):*
- Diagnosed "permission denied for table users" error from Supabase postgres logs (MCP `get_logs`). Admin policies were subquerying `auth.users`, which `authenticated` role has no grant on. Because policies are OR-combined, every user hit the error — not just admins.
- Replaced all `(SELECT email FROM auth.users WHERE id = auth.uid())` subqueries with `(auth.jwt() ->> 'email')` which reads from the JWT claim.
- Migration: `supabase/migrations/20260416_fix_support_rls_use_jwt.sql`. Applied to support_tickets, support_replies, and storage.objects.

*Polish pass before merging (landed in `310d1a9`):*
- **Bubble position**: `md:left-6` → `md:left-[17rem]` so it clears the 16rem sidebar instead of overlapping "Sign Out" / "Account Settings"
- **Title color**: Forced `text-white` on the "Support" heading (was rendering as dark-green-on-dark-green)
- **Unread badges**: Added `user_last_seen_at` column + per-ticket `unread_count` computed via nested PostgREST select `'*, support_replies(created_at, is_admin)'`. Red badges on the floating bubble, "My tickets" tab, and individual ticket rows. Opening a ticket calls `markTicketSeen(id)` to bump the watermark.
- **Status-change email**: New `status_changed` payload type in `support-notify` (v3). Only fires from `adminMode` so the user's own reply auto-bumping to in_progress doesn't email them.
- **Replies realtime**: Added `support_replies` INSERT subscription so unread badge increments the instant an admin replies (no page refresh needed).

**Key Files:**
- `components/SupportWidget.tsx` — floating bubble, form, history, threaded view, unread badges
- `components/AdminSupportPanel.tsx` — admin dashboard
- `hooks/useSupportTickets.ts` — CRUD + realtime + unread + markTicketSeen + status-change email trigger
- `supabase/functions/support-notify/index.ts` — Resend handler for all 3 notification types
- `supabase/migrations/20260416_support_tickets.sql` — tables + RLS + storage bucket
- `supabase/migrations/20260416_fix_support_rls_use_jwt.sql` — JWT-claim admin policy fix
- `supabase/migrations/20260416_support_tickets_last_seen.sql` — unread watermark column

**Testing Flow:**
- User tests on Vercel preview (not locally) — workflow was commit → push → wait for preview → validate.
- Preview validated bubble position, title color, unread badge flow, and status-change email before merge.

**Pending (carried over):**
- Stripe webhook signature verification still disabled — must re-enable before real live-mode traffic
- No inbound-email → reply pipeline. Admin replies only work from the Admin Panel today; Gmail replies to notification emails won't thread back into the ticket system.


# Support Inbound — Setup Guide

This guide walks through the one-time setup for the support-inbound email-reply pipeline. After this is done, replies to SparkPlan support emails (from either the admin or the ticket owner) are automatically threaded back into the ticket in-app.

**Architecture in one paragraph**: We use plus-addressing on the existing Google Workspace mailbox (`support+ticket-<uuid>@sparkplan.app`). Every outbound notification email sets `Reply-To` to the plus-tagged address. When someone replies, Gmail delivers it to the same `support@sparkplan.app` inbox. A Supabase edge function (`support-inbound`) polls that inbox every minute via the Gmail API, extracts the ticket UUID from the recipient header, and inserts the reply as a `support_replies` row. Both sides see it live via existing Supabase realtime subscriptions.

---

## Prerequisites

- **`support@sparkplan.app` credentials** — this account is both the Workspace super-admin and the mailbox we'll poll. Use this one account for every Google-side step below. (The unrelated `GEMINI_API_KEY` you got via Google AI Studio lives under your personal Gmail — that's a different Google context entirely and doesn't apply here.)
- Supabase project URL + service role access (Settings → API)
- Deno installed locally (for the OAuth bootstrap script)

---

## Step 1 — Google Cloud Console: Create OAuth credentials

Sign into https://console.cloud.google.com as `support@sparkplan.app`. On first-time access, accept the terms prompt.

1. **Create a new project**. Look at the **org selector** at the top of the page:
   - If `sparkplan.app` appears as an org, pick it — this unlocks the cleaner "Internal" consent screen below
   - If only "No organization" appears, use that — Workspace orgs sometimes don't auto-bind to Cloud Console new-account flows; the rest works identically
   - Name the project `SparkPlan Support Inbound` (or similar)
2. **Enable the Gmail API**: APIs & Services → Library → search "Gmail API" → Enable.
3. **Configure the OAuth consent screen**:
   - **User Type**:
     - Pick **Internal** if available (only appears if the project sits inside the `sparkplan.app` Workspace org) — no test-user cap, no 6-month refresh-token expiry, no "unverified app" warning
     - Otherwise pick **External** — works identically but requires listing `support@sparkplan.app` as a test user (Step below)
   - App name: `SparkPlan Support Inbound`
   - User support email: `support@sparkplan.app`
   - Developer contact: same
   - Scopes: add `https://www.googleapis.com/auth/gmail.modify` (read messages + mark as read). Do NOT add `gmail.send` or broader scopes — we only need read + modify.
   - Test users (External only): add `support@sparkplan.app`
   - Publishing status: leave as "Testing" — External tokens in Testing mode expire after 6 months of non-use, so re-run the bootstrap script at least twice a year if you stay on External
4. **Create OAuth 2.0 Client ID**:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Desktop app**
   - Name: `SparkPlan Support Inbound — CLI`
   - Save the Client ID and Client Secret (you'll paste them into the bootstrap script next)

---

## Step 2 — Generate the refresh token (one-time bootstrap)

Run the bootstrap script from the repo root:

```bash
deno run --allow-net scripts/gmail-oauth.ts
```

The script will:
1. Prompt for the Client ID and Client Secret from Step 1
2. Print a URL — open it in a browser signed in as `support@sparkplan.app` (sign out of any other Google identities first; copy-paste the URL into a private/incognito window if helpful)
3. Click "Allow" on the consent screen
4. Google shows an authorization code — copy it
5. Paste the code back into the script
6. The script prints the refresh token and a ready-to-run `supabase secrets set` command

**If Google refuses to show a refresh token** (returns only `access_token`): you've previously granted consent to this OAuth client. Revoke it at https://myaccount.google.com/permissions (while signed in as `support@sparkplan.app`), then re-run the script. The `prompt=consent` query parameter we pass should prevent this in most cases.

---

## Step 3 — Set Supabase Edge Function secrets

Generate a strong random secret for the pg_cron → support-inbound handshake:

```bash
openssl rand -hex 32
```

Then set all secrets (use the output from Step 2 plus the random secret):

```bash
supabase secrets set \
  GMAIL_CLIENT_ID=<from step 2> \
  GMAIL_CLIENT_SECRET=<from step 2> \
  GMAIL_REFRESH_TOKEN=<from step 2> \
  GMAIL_MAILBOX=support@sparkplan.app \
  SUPPORT_INBOUND_SECRET=<openssl output> \
  SUPPORT_ADMIN_AUTH_USER_ID=<the admin's auth.users.id>
```

To find `SUPPORT_ADMIN_AUTH_USER_ID`:
```sql
SELECT id FROM auth.users WHERE email = 'augustovalbuena@gmail.com';
```

---

## Step 4 — Populate Supabase Vault

The pg_cron job reads the shared secret and functions base URL from Vault so they're never hardcoded in migrations.

1. Supabase Studio → Project Settings → Vault → "New Secret"
2. Create two entries:

| Name | Value |
|------|-------|
| `support_inbound_secret` | Same value you set for the `SUPPORT_INBOUND_SECRET` env var in Step 3 |
| `supabase_functions_base_url` | `https://<your-project-ref>.supabase.co/functions/v1` (no trailing slash) |

---

## Step 5 — Apply migrations

From the repo root:

```bash
supabase db push
```

Or apply them manually via the SQL Editor in this order:
1. `supabase/migrations/20260417_support_events_and_investigations.sql`
2. `supabase/migrations/20260417_support_inbound_cron.sql`

The cron migration requires the Vault entries from Step 4 to already exist.

---

## Step 6 — Deploy edge functions

```bash
supabase functions deploy support-notify
supabase functions deploy support-inbound
supabase functions deploy support-investigate
```

Or use the MCP `deploy_edge_function` tool — the Supabase CLI auth and the MCP client are interchangeable for this.

---

## Step 7 — Verify

1. Open SparkPlan, submit a test ticket from the support widget
2. Confirm the new-ticket email arrives at `support@sparkplan.app` and its `Reply-To` is `support+ticket-<uuid>@sparkplan.app`
3. From the admin Gmail, reply to that email. Within 60 seconds you should see:
   - A new row in `support_replies` with `is_admin=true` for this ticket
   - A new row in `support_ticket_events` with `event_type='admin_reply'`, `source='email'`
   - The ticket status bumped to `in_progress` (if it was `open`)
   - The user gets an echo email at their registered address
4. From the user's email, reply to that echo. Within 60 seconds:
   - A new `support_replies` row with `is_admin=false`
   - An admin notification email with "Customer replied via email" in the subject

**If nothing happens**: Check the `support_gmail_sync_state` row — if `last_error` is populated, that's your clue. Common issues:
- OAuth consent in "Testing" mode with a user that isn't listed as a test user → mailbox lookup fails
- Vault secrets not set → cron fails silently; look at the `cron.job_run_details` table
- `SUPPORT_INBOUND_SECRET` mismatch between env var and Vault → function returns 401

---

## Operational notes

- **Refresh token rotation**: Google's OAuth refresh tokens don't expire by default, but they get revoked if the user changes their password, revokes consent, or the OAuth app's scopes change. If `last_error` shows `invalid_grant`, re-run `scripts/gmail-oauth.ts` and update `GMAIL_REFRESH_TOKEN`.
- **Rate limits**: Gmail API has a 1 billion quota unit/day limit per project. Each poll burns ~5–10 units. At 1 poll/min we use ~14k units/day — well under the cap.
- **Polling cadence**: Currently every minute (`* * * * *` in the cron schedule). Drop to `*/5 * * * *` if you want to reduce API churn; users will just see 5-minute latency on email replies.
- **Don't read the inbox before cron polls it**: The Gmail query filter uses `is:unread`, so any message that a human (or automation) opens in `support@sparkplan.app` before the next poll is stranded — it won't be picked up. If you need to spot-check an email, mark it as unread again afterward. Future improvement: switch to the Gmail History API (the `support_gmail_sync_state.last_history_id` column is already provisioned for this) which detects new messages regardless of read state.
- **Edge function gateway JWT**: Both `support-inbound` and `support-notify` are deployed with `--no-verify-jwt`. This is required because (a) pg_cron sends a custom `x-support-inbound-secret` header instead of a JWT, and (b) Supabase's new API key format (`sb_secret_...`, `sb_publishable_...`) is not a JWT, so the gateway rejects service-role calls between functions. Each function has its own robust auth check internally — the `verifySecret()` constant-time compare in support-inbound and the `isInternalCall` service-role check in support-notify.
- **Turning on the future AI investigation**: The `support-investigate` function is currently a stub that writes `status='skipped'`. When ready, add `CLAUDE_CODE_WEBHOOK_URL` + `SLACK_WEBHOOK_URL` secrets, flip the status to `'pending'`, and wire a pg trigger on `support_ticket_events` for qualifying event types (e.g., `ticket_created` where `payload->>'category' = 'bug'`).

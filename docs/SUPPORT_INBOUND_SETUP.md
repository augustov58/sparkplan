# Support Inbound — Setup Guide

This guide walks through the one-time setup for the support-inbound email-reply pipeline. After this is done, replies to SparkPlan support emails (from either the admin or the ticket owner) are automatically threaded back into the ticket in-app.

**Architecture in one paragraph**: We use plus-addressing on the existing Google Workspace mailbox (`support+ticket-<uuid>@sparkplan.app`). Every outbound notification email sets `Reply-To` to the plus-tagged address. When someone replies, Gmail delivers it to the same `support@sparkplan.app` inbox. A Supabase edge function (`support-inbound`) polls that inbox every minute via the Gmail API, extracts the ticket UUID from the recipient header, and inserts the reply as a `support_replies` row. Both sides see it live via existing Supabase realtime subscriptions.

---

## Prerequisites

- Access to the Google Cloud Console as the owner of `augustovalbuena@gmail.com` (or whichever admin account manages the `support@sparkplan.app` mailbox)
- Supabase project URL + service role access (Settings → API)
- Deno installed locally (for the OAuth bootstrap script)

---

## Step 1 — Google Cloud Console: Create OAuth credentials

1. Go to https://console.cloud.google.com
2. Create a new project (or reuse an existing SparkPlan project). Note the project name.
3. **Enable the Gmail API**: APIs & Services → Library → search "Gmail API" → Enable.
4. **Configure the OAuth consent screen**:
   - User Type: **External** (since `support@sparkplan.app` is a Google Workspace account but the OAuth app lives in a consumer-style project)
   - App name: `SparkPlan Support Inbound`
   - User support email: `augustovalbuena@gmail.com`
   - Developer contact: same
   - Scopes: add `https://www.googleapis.com/auth/gmail.modify` (read messages + mark as read). Do NOT add `gmail.send` or broader scopes — we only need read + modify.
   - Test users: add `support@sparkplan.app` (and your personal Gmail if different)
   - Publishing status: leave as "Testing" unless you plan to productionize; testing tokens are valid for 6 months without reuse.
5. **Create OAuth 2.0 Client ID**:
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
2. Print a URL — open it in a browser logged in as `support@sparkplan.app`
3. Click "Allow" on the consent screen
4. Google shows an authorization code — copy it
5. Paste the code back into the script
6. The script prints the refresh token and a ready-to-run `supabase secrets set` command

**If Google refuses to show a refresh token** (returns only `access_token`): you've previously granted consent to this OAuth client. Revoke it at https://myaccount.google.com/permissions, then re-run the script. The `prompt=consent` query parameter we pass should prevent this in most cases.

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
- **Turning on the future AI investigation**: The `support-investigate` function is currently a stub that writes `status='skipped'`. When ready, add `CLAUDE_CODE_WEBHOOK_URL` + `SLACK_WEBHOOK_URL` secrets, flip the status to `'pending'`, and wire a pg trigger on `support_ticket_events` for qualifying event types (e.g., `ticket_created` where `payload->>'category' = 'bug'`).

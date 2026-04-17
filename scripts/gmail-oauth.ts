#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
/**
 * One-shot bootstrap script: obtain a long-lived Gmail OAuth refresh token
 * for the support-inbound edge function.
 *
 * Usage:
 *   deno run --allow-net --allow-env scripts/gmail-oauth.ts
 *
 * Prerequisites (one-time, in Google Cloud Console):
 *   1. Create a project (or reuse an existing one)
 *   2. Enable the Gmail API
 *   3. Configure the OAuth consent screen (External, add your account as a test user)
 *   4. Create OAuth 2.0 credentials of type "Desktop app"
 *      — this allows the urn:ietf:wg:oauth:2.0:oob flow which is simplest for a one-shot CLI
 *   5. Add the required scope: https://www.googleapis.com/auth/gmail.modify
 *      (read + mark-as-read — don't grant full send permissions we don't use)
 *
 * Flow:
 *   - You paste in the Client ID and Client Secret when prompted
 *   - The script prints an auth URL → open it in a browser, sign in as support@sparkplan.app,
 *     accept the consent screen, then copy the authorization code Google shows you
 *   - Paste the code back into this script → it exchanges the code for a refresh token
 *   - Save the printed values as Supabase Edge Function secrets:
 *       GMAIL_CLIENT_ID
 *       GMAIL_CLIENT_SECRET
 *       GMAIL_REFRESH_TOKEN
 *       GMAIL_MAILBOX=support@sparkplan.app
 *
 * Note:
 *   - Google OAuth refresh tokens don't expire by default, but they DO get revoked if:
 *       * the user changes their password,
 *       * consent is revoked in Google account settings,
 *       * the OAuth app's scopes change,
 *       * or the token goes 6 months without use while the app is in "testing" mode.
 *     Publish the OAuth app (or at minimum, schedule a reminder to re-bootstrap) to avoid surprise outages.
 */

// @ts-ignore: Deno global — this script only runs under Deno
declare const Deno: any;

const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'; // out-of-band (copy-paste) flow
const SCOPE = 'https://www.googleapis.com/auth/gmail.modify';

async function prompt(label: string): Promise<string> {
  const encoder = new TextEncoder();
  await Deno.stdout.write(encoder.encode(`${label}: `));
  const buf = new Uint8Array(1024);
  const n = (await Deno.stdin.read(buf)) ?? 0;
  return new TextDecoder().decode(buf.subarray(0, n)).trim();
}

async function main() {
  console.log('=== Gmail OAuth bootstrap (one-time) ===\n');
  console.log('You need the OAuth client ID + secret from Google Cloud Console.');
  console.log('See header of this file for setup prerequisites.\n');

  const clientId = await prompt('Google OAuth Client ID');
  const clientSecret = await prompt('Google OAuth Client Secret');

  if (!clientId || !clientSecret) {
    console.error('Both client_id and client_secret are required.');
    Deno.exit(1);
  }

  const authUrl = new URL(OAUTH_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent'); // force refresh_token on each run

  console.log('\nOpen this URL in a browser (sign in as support@sparkplan.app):\n');
  console.log(authUrl.toString());
  console.log('\nAfter consenting, Google will display an authorization code. Copy it.\n');

  const code = await prompt('Authorization code');
  if (!code) {
    console.error('Authorization code is required.');
    Deno.exit(1);
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`\nToken exchange failed (${res.status}):\n${text}`);
    Deno.exit(1);
  }

  const data = await res.json();
  if (!data.refresh_token) {
    console.error('\nNo refresh_token in response. Common cause: you already granted consent previously.');
    console.error('Revoke access at https://myaccount.google.com/permissions and re-run this script.');
    console.error('Full response:', JSON.stringify(data, null, 2));
    Deno.exit(1);
  }

  console.log('\n=== Success — save these as Supabase Edge Function secrets ===\n');
  console.log(`GMAIL_CLIENT_ID=${clientId}`);
  console.log(`GMAIL_CLIENT_SECRET=${clientSecret}`);
  console.log(`GMAIL_REFRESH_TOKEN=${data.refresh_token}`);
  console.log(`GMAIL_MAILBOX=support@sparkplan.app`);
  console.log('\nSet them via:');
  console.log('  supabase secrets set GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... GMAIL_REFRESH_TOKEN=... GMAIL_MAILBOX=support@sparkplan.app');
  console.log('\nDone.');
}

if (import.meta.main) {
  main().catch((err) => {
    console.error('Error:', err);
    Deno.exit(1);
  });
}

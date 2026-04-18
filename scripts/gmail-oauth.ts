#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
/**
 * One-shot bootstrap script: obtain a long-lived Gmail OAuth refresh token
 * for the support-inbound edge function.
 *
 * Usage:
 *   deno run --allow-net scripts/gmail-oauth.ts
 *
 * Flow (loopback IP flow — Google's current recommendation for Desktop apps):
 *   1. You paste in the Client ID and Client Secret when prompted
 *   2. The script starts a local HTTP server on 127.0.0.1:<random-port>
 *   3. Prints an auth URL → open it in a browser, sign in as support@sparkplan.app,
 *      accept the consent screen
 *   4. Google auto-redirects to 127.0.0.1:<port>?code=... → the local server captures it
 *   5. Script exchanges the code for a refresh token, prints the values
 *   6. You save as Supabase Edge Function secrets:
 *        GMAIL_CLIENT_ID
 *        GMAIL_CLIENT_SECRET
 *        GMAIL_REFRESH_TOKEN
 *        GMAIL_MAILBOX=support@sparkplan.app
 *
 * Prerequisites (one-time, in Google Cloud Console):
 *   1. Create a project (or reuse an existing one)
 *   2. Enable the Gmail API
 *   3. Configure the OAuth consent screen (Internal if sparkplan.app is your Workspace org,
 *      External otherwise — add yourself as a test user if External)
 *   4. Create OAuth 2.0 credentials of type "Desktop app". Desktop clients auto-accept
 *      any http://127.0.0.1:<port> redirect URI — no further configuration needed.
 *   5. Required scope: https://www.googleapis.com/auth/gmail.modify
 *
 * Note on refresh-token expiry:
 *   Google OAuth refresh tokens don't expire by default, but they DO get revoked if
 *   the user changes their password, revokes consent in account settings, the OAuth
 *   app's scopes change, or the token goes 6 months without use while the app is in
 *   "Testing" mode (External). Publish the OAuth app or re-run this script proactively
 *   to avoid surprise outages.
 */

// @ts-ignore: Deno global — this script only runs under Deno
declare const Deno: any;

const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/gmail.modify';

async function prompt(label: string): Promise<string> {
  const encoder = new TextEncoder();
  await Deno.stdout.write(encoder.encode(`${label}: `));
  const buf = new Uint8Array(1024);
  const n = (await Deno.stdin.read(buf)) ?? 0;
  return new TextDecoder().decode(buf.subarray(0, n)).trim();
}

const SUCCESS_HTML = `
<!DOCTYPE html>
<html>
<head><title>SparkPlan OAuth — Success</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 80px auto; padding: 24px; text-align: center; background: #faf9f7;">
  <h1 style="color: #2d3b2d;">Authorization successful</h1>
  <p style="color: #4b5563;">You can close this tab and return to your terminal.</p>
</body>
</html>`;

const ERROR_HTML = (msg: string) => `
<!DOCTYPE html>
<html>
<head><title>SparkPlan OAuth — Error</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 80px auto; padding: 24px; text-align: center; background: #faf9f7;">
  <h1 style="color: #b91c1c;">Authorization failed</h1>
  <p style="color: #4b5563;">${msg}</p>
  <p style="color: #9ca3af; font-size: 13px;">Return to your terminal for details.</p>
</body>
</html>`;

async function run() {
  console.log('=== Gmail OAuth bootstrap (one-time) ===\n');
  console.log('You need the OAuth client ID + secret from Google Cloud Console.');
  console.log('See header of this file for setup prerequisites.\n');

  const clientId = await prompt('Google OAuth Client ID');
  const clientSecret = await prompt('Google OAuth Client Secret');

  if (!clientId || !clientSecret) {
    console.error('Both client_id and client_secret are required.');
    Deno.exit(1);
  }

  // Set up the local callback capture
  let resolveCode: (code: string) => void;
  let rejectCode: (err: Error) => void;
  const codePromise = new Promise<string>((res, rej) => {
    resolveCode = res;
    rejectCode = rej;
  });

  const server = Deno.serve(
    { port: 0, hostname: '127.0.0.1', onListen: () => {} },
    (req: Request) => {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        rejectCode(new Error(`OAuth error from Google: ${error}`));
        return new Response(ERROR_HTML(error), {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      if (code) {
        resolveCode(code);
        return new Response(SUCCESS_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return new Response('Missing code parameter', { status: 400 });
    }
  );

  const port = server.addr.port;
  const redirectUri = `http://127.0.0.1:${port}`;

  const authUrl = new URL(OAUTH_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent'); // force refresh_token on each run

  console.log(`\nLocal callback server listening on ${redirectUri}`);
  console.log('\nOpen this URL in a browser (sign in as support@sparkplan.app):\n');
  console.log(authUrl.toString());
  console.log('\nWaiting for Google to redirect back to the callback server...');
  console.log('(Press Ctrl+C to cancel.)\n');

  let code: string;
  try {
    code = await codePromise;
  } catch (err: any) {
    await server.shutdown();
    console.error('\nFailed to receive auth code:', err.message);
    Deno.exit(1);
  }

  // Small delay so the browser has time to render the success page before we tear down
  await new Promise((r) => setTimeout(r, 500));
  await server.shutdown();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
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
  run().catch((err) => {
    console.error('Error:', err);
    Deno.exit(1);
  });
}

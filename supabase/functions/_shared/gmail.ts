/**
 * Gmail API helpers for Supabase Edge Functions.
 *
 * Uses OAuth 2.0 refresh-token flow to obtain short-lived access tokens, then calls
 * the Gmail REST API directly (no SDK — keeps Deno cold-start small).
 *
 * Required env vars:
 *   GMAIL_CLIENT_ID       — OAuth 2.0 client ID from Google Cloud Console
 *   GMAIL_CLIENT_SECRET   — corresponding client secret
 *   GMAIL_REFRESH_TOKEN   — long-lived refresh token obtained via scripts/gmail-oauth.ts
 *   GMAIL_MAILBOX         — the mailbox to read from (e.g., support@sparkplan.app)
 */

// @ts-ignore: Deno global
declare const Deno: any;

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface GmailMessageRef {
  id: string;
  threadId: string;
}

export interface GmailMessageFull {
  id: string;
  threadId: string;
  labelIds: string[];
  headers: Record<string, string>;  // lowercased header names
  textBody: string;
  historyId: string;
}

export async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('GMAIL_CLIENT_ID');
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail OAuth credentials not configured (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN)');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail OAuth refresh failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Gmail OAuth response missing access_token');
  }
  return data.access_token as string;
}

/**
 * List unread messages matching a Gmail search query.
 * Example query: `to:support+ticket- is:unread newer_than:1d`
 */
export async function listMessages(
  accessToken: string,
  userId: string,
  query: string,
  maxResults = 20
): Promise<GmailMessageRef[]> {
  const url = new URL(`${GMAIL_API}/users/${encodeURIComponent(userId)}/messages`);
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', String(maxResults));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail list failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return (data.messages || []) as GmailMessageRef[];
}

/**
 * Fetch a single message, decoding the first text/plain part into UTF-8.
 */
export async function getMessage(
  accessToken: string,
  userId: string,
  messageId: string
): Promise<GmailMessageFull> {
  const url = `${GMAIL_API}/users/${encodeURIComponent(userId)}/messages/${encodeURIComponent(messageId)}?format=full`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail get failed (${res.status}): ${text}`);
  }
  const data = await res.json();

  const headers: Record<string, string> = {};
  for (const h of data.payload?.headers || []) {
    if (h.name && h.value) headers[h.name.toLowerCase()] = h.value;
  }

  const textBody = extractTextBody(data.payload);

  return {
    id: data.id,
    threadId: data.threadId,
    labelIds: data.labelIds || [],
    headers,
    textBody,
    historyId: data.historyId,
  };
}

/**
 * Mark a message as read by removing the UNREAD label.
 * Prevents re-processing on the next poll.
 */
export async function markAsRead(
  accessToken: string,
  userId: string,
  messageId: string
): Promise<void> {
  const url = `${GMAIL_API}/users/${encodeURIComponent(userId)}/messages/${encodeURIComponent(messageId)}/modify`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail modify failed (${res.status}): ${text}`);
  }
}

// ------------------------------------------------------------------
// Body decoding — Gmail returns base64url-encoded parts; we walk the
// MIME tree to find the best text/plain candidate.
// ------------------------------------------------------------------

function extractTextBody(payload: any): string {
  if (!payload) return '';

  // Direct text/plain body
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return base64UrlDecode(payload.body.data);
  }

  // Multipart — recurse; prefer text/plain, fall back to text/html stripped
  if (payload.parts) {
    // First pass: direct text/plain part
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return base64UrlDecode(part.body.data);
      }
    }
    // Second pass: nested multipart
    for (const part of payload.parts) {
      const nested = extractTextBody(part);
      if (nested) return nested;
    }
    // Fallback: text/html stripped of tags
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return stripHtml(base64UrlDecode(part.body.data));
      }
    }
  }

  return '';
}

function base64UrlDecode(data: string): string {
  // Gmail uses base64url (- and _ instead of + and /); normalize then decode
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  try {
    const binary = atob(padded);
    // Decode as UTF-8
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

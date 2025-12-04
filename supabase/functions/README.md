# Supabase Edge Functions

This directory contains Supabase Edge Functions for secure server-side operations.

## Setup

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Link to your Supabase project:**
   ```bash
   supabase link --project-ref <your-project-ref>
   ```

3. **Set environment secrets:**
   ```bash
   supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>
   ```

## Deploy Functions

Deploy all functions:
```bash
supabase functions deploy
```

Deploy specific function:
```bash
supabase functions deploy gemini-proxy
```

## Functions

### `gemini-proxy`

**Purpose:** Securely proxies requests to Google's Gemini AI API to prevent API key exposure.

**Endpoint:** `https://<project-ref>.supabase.co/functions/v1/gemini-proxy`

**Authentication:** Requires Supabase auth token

**Request:**
```json
{
  "prompt": "Your prompt here",
  "systemInstruction": "Optional system instruction",
  "model": "gemini-2.0-flash-exp" (optional, defaults to this)
}
```

**Response:**
```json
{
  "response": "AI generated response text"
}
```

**Error Response:**
```json
{
  "error": "Error message"
}
```

## Local Testing

1. Start Supabase locally:
   ```bash
   supabase start
   ```

2. Serve functions locally:
   ```bash
   supabase functions serve gemini-proxy --env-file ./supabase/.env.local
   ```

3. Test the function:
   ```bash
   curl -i --location --request POST 'http://localhost:54321/functions/v1/gemini-proxy' \
     --header 'Authorization: Bearer <your-anon-key>' \
     --header 'Content-Type: application/json' \
     --data '{"prompt":"What is the NEC?"}'
   ```

## Environment Variables

Set these in Supabase Dashboard > Project Settings > Edge Functions:

- `GEMINI_API_KEY` - Your Google Gemini API key

These are automatically available:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon/public key

## Security Notes

- API keys are stored as encrypted secrets in Supabase
- Functions require valid Supabase authentication
- CORS is configured for frontend access
- All requests are logged for monitoring

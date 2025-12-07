# Gemini API Setup for NEC Assistant

The NEC Assistant uses Google's Gemini AI via Supabase Edge Functions. You need to:

1. **Get a Gemini API Key**
2. **Set it in Supabase Edge Functions secrets**
3. **Deploy the Edge Function**

## Step 1: Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Select "Create API key in new project" (or choose existing)
5. Copy the API key (starts with `AIza...`)

**Important**: Keep this key secret! Never commit it to git.

## Step 2: Set API Key in Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Edge Functions** in the left sidebar
4. Click **"Manage secrets"** or go to **Settings** → **Edge Functions** → **Secrets**
5. Click **"Add new secret"**
6. Enter:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: Your Gemini API key (paste the key you copied)
7. Click **"Save"**

## Step 3: Deploy the Edge Function

The Edge Function code is in `supabase/functions/gemini-proxy/index.ts`.

### Option A: Using Supabase CLI (Recommended)

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```
   (Find your project ref in Supabase Dashboard → Settings → General)

4. Deploy the function:
   ```bash
   supabase functions deploy gemini-proxy
   ```

### Option B: Using Supabase Dashboard

1. Go to **Edge Functions** in Supabase Dashboard
2. Click **"Create a new function"**
3. Name it: `gemini-proxy`
4. Copy the contents of `supabase/functions/gemini-proxy/index.ts`
5. Paste into the editor
6. Click **"Deploy"**

## Step 4: Verify It Works

1. Open your app and navigate to any project
2. Click the **NEC Copilot** button (bottom-right)
3. Ask a question like: "What is NEC 220.82?"
4. You should get a response (not "AI service temporarily unavailable")

## Troubleshooting

### "AI service temporarily unavailable"

**Check:**
1. ✅ Is `GEMINI_API_KEY` set in Supabase Edge Functions secrets?
2. ✅ Is the `gemini-proxy` function deployed?
3. ✅ Is your Gemini API key valid? (Check in Google AI Studio)
4. ✅ Do you have API quota remaining? (Free tier: 15 requests/minute)

**Test the function directly:**
1. Go to Supabase Dashboard → Edge Functions → `gemini-proxy`
2. Click **"Invoke"** tab
3. Use this test payload:
   ```json
   {
     "prompt": "What is NEC 220.82?",
     "systemInstruction": "You are a Senior Electrical Engineer specializing in NEC.",
     "model": "gemini-2.0-flash-exp"
   }
   ```
4. Click **"Invoke"**
5. Check the response - if it errors, check the logs

### "Gemini API key not configured"

- The secret name must be exactly `GEMINI_API_KEY` (case-sensitive)
- Make sure you're in the correct Supabase project
- Try redeploying the function after adding the secret

### "Unauthorized" Error

- Make sure you're logged in to the app
- Check that Supabase auth is working (try creating a project)

### API Quota Exceeded (429 Error)

**If you see "limit: 0" in the error:**
- Your API key doesn't have free tier access enabled
- **Solution**: Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
  - Click on your API key
  - Check if "Free tier" is enabled
  - If not available, you may need to enable billing (free tier still works with billing enabled)
  - Or create a new API key - new keys usually have free tier enabled by default

**If you see rate limit errors (not "limit: 0"):**
- Free tier: 15 requests/minute, 1,500 requests/day
- Check your usage in [Google AI Studio](https://aistudio.google.com/app/apikey)
- Wait a minute and try again, or upgrade your API quota

## Cost Information

**Gemini 2.0 Flash (Free Tier)**:
- 15 requests per minute
- 1,500 requests per day
- Free for most use cases

**Paid Tier** (if you exceed free limits):
- $0.075 per 1M input tokens
- $0.30 per 1M output tokens
- Very affordable for typical usage

## Security Notes

✅ **API key is stored server-side** - Never exposed to frontend  
✅ **Requires authentication** - Only logged-in users can use AI  
✅ **Rate limited** - Supabase Edge Functions have built-in rate limiting  
✅ **CORS protected** - Only requests from your app domain are allowed

---

**Need help?** Check the Supabase Edge Functions logs in your dashboard for detailed error messages.


# Supabase Setup Guide

This guide walks you through setting up Supabase for NEC Pro Compliance.

## Prerequisites

- A Supabase account (https://supabase.com)
- Node.js and npm installed

## Step 1: Create a Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in the details:
   - **Project Name**: NEC Pro Compliance
   - **Database Password**: Choose a strong password (save it securely)
   - **Region**: Choose the closest region to your users
4. Click "Create new project"
5. Wait for the project to be provisioned (takes 1-2 minutes)

## Step 2: Run the Database Schema

1. In your Supabase project dashboard, click "SQL Editor" in the left sidebar
2. Click "New query"
3. Copy the entire contents of `supabase/schema.sql` from this repository
4. Paste it into the SQL editor
5. Click "Run" or press `Ctrl+Enter`
6. Verify success: You should see "Success. No rows returned"

## Step 3: Get Your API Keys

1. In your Supabase project dashboard, go to "Settings" (gear icon)
2. Click "API" in the sidebar
3. You'll see two important values:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **Anon/Public Key**: `eyJhbG...` (long string)

## Step 4: Configure Environment Variables

1. In the project root, copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and fill in your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbG...your-anon-key-here

   # Optional: Keep for local development
   GEMINI_API_KEY=your_gemini_api_key
   ```

## Step 5: Configure Email Authentication (Optional)

By default, Supabase requires email confirmation. For development, you may want to disable this:

1. Go to "Authentication" > "Settings" in your Supabase dashboard
2. Scroll to "Email Auth"
3. **Disable "Confirm email"** (for development only)
4. Click "Save"

**For production**: Keep email confirmation enabled and configure email templates.

## Step 6: Test the Setup

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000`

3. Try signing up with a new account:
   - Click "Sign Up"
   - Enter your email and password
   - If email confirmation is disabled, you'll be logged in immediately
   - If enabled, check your email for a confirmation link

4. Verify data persistence:
   - Create a new project
   - Refresh the page
   - The project should still be there (data is now persisted to Supabase)

## Step 7: Verify Database Tables

1. In Supabase dashboard, go to "Table Editor"
2. You should see these tables:
   - `profiles` - User profiles
   - `projects` - Electrical projects
   - `loads` - Load calculations
   - `circuits` - Circuit designs
   - `issues` - Compliance issues
   - `inspection_items` - Inspection checklists
   - `grounding_details` - Grounding configurations

## Troubleshooting

### "Missing Supabase environment variables" Error

- Ensure `.env.local` exists in the project root
- Verify the variable names start with `VITE_` (required for Vite)
- Restart the dev server after creating/editing `.env.local`

### "Failed to fetch" or CORS Errors

- Check that your Supabase URL is correct
- Verify your project is fully provisioned (not still setting up)
- Check the browser console for detailed error messages

### Row Level Security (RLS) Errors

- If you get "permission denied" errors, verify the SQL schema ran successfully
- Check that RLS policies are created: Go to "Authentication" > "Policies" in Supabase
- Ensure you're logged in (auth context provides user ID for RLS)

### Email Not Sending

- For development: Disable email confirmation (see Step 5)
- For production: Configure SMTP settings in "Settings" > "Auth" > "SMTP Settings"
- Use a service like SendGrid, Mailgun, or AWS SES

## Next Steps

### Deploy to Production

1. **Environment Variables**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your hosting platform (Vercel, Netlify, etc.)

2. **Enable Email Confirmation**: Go to "Authentication" > "Settings" and enable "Confirm email"

3. **Configure Email Templates**: Customize the confirmation and password reset emails in "Authentication" > "Email Templates"

4. **Set Up Custom Domain** (optional): Configure a custom domain in "Settings" > "Custom Domains"

5. **Enable Row Level Security Audit**: Verify all tables have proper RLS policies in "Authentication" > "Policies"

### Optional: Migrate from Local Data

If you have existing projects in the old local storage system:

1. The new authentication system won't have access to old data (it was stored in component state)
2. You'll need to manually recreate projects in the new system
3. Consider exporting data to PDF before migration for reference

## Security Notes

- **Never commit `.env.local`** - It's already in `.gitignore`
- **Anon key is safe to expose** - It's designed for client-side use with RLS
- **Use RLS policies** - All sensitive data is protected by Row Level Security
- **Service role key** - Never use this in frontend code (it bypasses RLS)

## Support

- Supabase Documentation: https://supabase.com/docs
- Supabase Community: https://github.com/supabase/supabase/discussions
- Project Issues: https://github.com/your-username/nec-compliance/issues

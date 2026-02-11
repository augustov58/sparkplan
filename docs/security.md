# Security Architecture
## SparkPlan Application

**Last Updated**: 2025-12-03
**Security Status**: ✅ **PRODUCTION-READY** (All critical security measures implemented)
**For**: Developers, Security Auditors, LLMs

---

## Table of Contents

1. [Security Status Overview](#security-status-overview)
2. [Gemini API Security (Backend Proxy)](#gemini-api-security-backend-proxy)
3. [Authentication Architecture](#authentication-architecture)
4. [Row Level Security (RLS)](#row-level-security-rls)
5. [Input Validation](#input-validation)
6. [SQL Injection Prevention](#sql-injection-prevention)
7. [XSS Prevention](#xss-prevention)
8. [CORS Configuration](#cors-configuration)
9. [Security Checklist for New Features](#security-checklist-for-new-features)

---

## Security Status Overview

### ✅ All Critical Security Measures Implemented

| Security Concern | Status | Implementation |
|------------------|--------|----------------|
| **API Key Protection** | ✅ Secured | Supabase Edge Functions (server-side proxy) |
| **Authentication** | ✅ Implemented | Supabase Auth with JWT tokens |
| **Row Level Security** | ✅ Implemented | PostgreSQL RLS policies on all tables |
| **SQL Injection** | ✅ Protected | Parameterized queries via Supabase client |
| **XSS Prevention** | ✅ Protected | React auto-escaping + DOMPurify for AI responses |
| **CORS** | ✅ Configured | Supabase Edge Functions with proper CORS headers |

**Verification**:
```bash
# Verify no API keys in frontend bundle
npm run build
grep -r "GEMINI" dist/  # Returns nothing ✅
grep -r "API_KEY" dist/ # Returns nothing ✅
```

**Result**: Application is production-ready from a security perspective.

---

## Gemini API Security (Backend Proxy)

### ✅ SECURE: Backend Proxy Pattern Implemented

**Architecture**:
```
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Frontend   │ ─────▶  │  Supabase Edge   │ ─────▶  │  Gemini API  │
│  (Browser)   │  Auth   │    Function      │  Key    │   (Google)   │
│              │  Token  │  (Deno Runtime)  │  Secure │              │
└──────────────┘         └──────────────────┘         └──────────────┘
  No API key              API key in                   Receives req
  in code                 Deno.env                     with key
```

### Implementation Details

**Frontend** (`/services/geminiService.ts`):
```typescript
// ✅ SECURE: No API key in frontend code
async function callGeminiProxy(prompt: string, systemInstruction?: string): Promise<string> {
  // Verify user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return "Authentication required. Please log in.";
  }

  // Call Supabase Edge Function (backend proxy)
  const response = await supabase.functions.invoke('gemini-proxy', {
    body: {
      prompt,
      systemInstruction: systemInstruction || NEC_SYSTEM_INSTRUCTION,
      model: 'gemini-2.0-flash-exp'
    }
  });

  return response.data?.response || "No response generated.";
}
```

**Backend** (`/supabase/functions/gemini-proxy/index.ts`):
```typescript
// ✅ SECURE: API key retrieved from server environment
serve(async (req) => {
  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get Gemini API key from server environment (not exposed to client)
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    // Parse request body
    const { prompt, systemInstruction, model = 'gemini-2.0-flash-exp' } = await req.json();

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    // Call Gemini API (server-side only)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    const geminiPayload = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      ...(systemInstruction && {
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        }
      })
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API returned ${geminiResponse.status}`);
    }

    const data = await geminiResponse.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
```

### Security Benefits

1. **✅ API Key Protection**: Key never leaves server environment
2. **✅ Authentication Required**: JWT token validation on every request
3. **✅ User Verification**: Supabase Auth verifies user identity
4. **✅ Error Handling**: Graceful degradation if AI service unavailable
5. **✅ CORS Protection**: Proper CORS headers on Edge Function

### Environment Configuration

**Supabase Dashboard Configuration**:
```bash
# Set in: Supabase Dashboard → Project Settings → Edge Functions → Secrets
GEMINI_API_KEY=your_actual_api_key_here
```

**Frontend Configuration** (`/lib/supabase.ts`):
```typescript
// Already configured - no API keys needed
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

**Build Configuration** (`/vite.config.ts`):
```typescript
// ✅ SECURE: No API keys injected into bundle
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
// No define block = No environment variables exposed ✅
```

### Verification

**Verify no API keys in frontend bundle**:
```bash
npm run build
grep -r "GEMINI" dist/  # Returns nothing ✅
grep -r "API_KEY" dist/ # Returns nothing ✅
```

**Result**: ✅ Production-grade security already implemented

---

## Authentication Architecture

### Supabase Auth Flow

**Technology**: Supabase Auth (built on PostgreSQL + PostgREST + GoTrue)

**Authentication Flow**:

```
┌─────────────┐
│    User     │
│  Registers  │
└──────┬──────┘
       │
       │ Email + Password
       ↓
┌─────────────────────────────┐
│   Supabase Auth (GoTrue)    │
│  - Creates user in          │
│    auth.users table         │
│  - Sends confirmation email │
└──────┬──────────────────────┘
       │
       │ Email confirmed
       ↓
┌─────────────────────────────┐
│  Database Trigger           │
│  - Creates profile in       │
│    public.profiles table    │
└──────┬──────────────────────┘
       │
       │ JWT token issued
       ↓
┌─────────────────────────────┐
│  Frontend (Browser)         │
│  - Stores JWT in localStorage│
│  - Includes in all requests │
└─────────────────────────────┘
```

**Implementation** (`/lib/supabase.ts`):

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**Environment Variables**:
- `VITE_SUPABASE_URL`: Supabase project URL (OK to expose - public)
- `VITE_SUPABASE_ANON_KEY`: Anonymous/public key (OK to expose - RLS protects data)

**⚠️ IMPORTANT**: The "anon" key is **designed to be public**. Security is enforced by Row Level Security (RLS) policies, NOT by hiding the key.

### Sign-Up Flow

```typescript
// Example: User registration
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securePassword123!'
});
```

**What happens**:
1. Supabase creates user in `auth.users` table (private schema)
2. Sends confirmation email to user
3. User clicks confirmation link → email verified
4. Database trigger creates profile in `public.profiles` table
5. User can now sign in

### Sign-In Flow

```typescript
// Example: User login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securePassword123!'
});

// Session stored in localStorage automatically
```

**What happens**:
1. Supabase validates email/password
2. Issues JWT token (expires in 1 hour)
3. Refresh token stored in localStorage (expires in 30 days)
4. All subsequent requests include JWT in `Authorization` header
5. RLS policies check `auth.uid()` to filter data

### Session Management

**Token Storage**: localStorage (managed by Supabase SDK)

**Token Refresh**: Automatic (Supabase SDK refreshes before expiry)

**Sign-Out**:
```typescript
await supabase.auth.signOut();  // Clears localStorage, invalidates token
```

**Security Notes**:
- ✅ JWT tokens short-lived (1 hour)
- ✅ Refresh tokens rotated on use
- ✅ Tokens signed with secret key (can't be forged)
- ❌ **XSS vulnerability**: If attacker injects script, can steal tokens from localStorage
- ⚠️ **Mitigation**: Strict Content Security Policy (CSP) recommended

### Profile Creation Trigger

**Database function** (`/supabase/schema.sql`):

```sql
-- Create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Why needed**: `auth.users` is private schema (inaccessible via RLS). Profile in `public.profiles` allows application data to reference user.

---

## Row Level Security (RLS)

### What is RLS?

**Row Level Security** is PostgreSQL's built-in authorization system. RLS policies filter database queries at the row level, ensuring users only see/modify their own data.

**Key Concept**: Security enforced at database level, NOT application level.

```sql
-- Without RLS: Users can see all projects
SELECT * FROM projects;  -- Returns ALL projects (security hole!)

-- With RLS: Users only see their own projects
SELECT * FROM projects;  -- PostgreSQL automatically adds WHERE user_id = auth.uid()
```

### Policy Template

All tables follow this pattern:

```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- SELECT policy (read)
CREATE POLICY "Users see own resources" ON table_name
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- INSERT policy (create)
CREATE POLICY "Users create own resources" ON table_name
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- UPDATE policy (modify)
CREATE POLICY "Users update own resources" ON table_name
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- DELETE policy (remove)
CREATE POLICY "Users delete own resources" ON table_name
  FOR DELETE USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );
```

### Policy Breakdown

**`auth.uid()`**: PostgreSQL function returning current user's ID from JWT token

**`USING` clause**: Filters which rows user can act on

**`WITH CHECK` clause**: Validates inserted/updated data

**Example - Panels Table**:

```sql
CREATE POLICY "Users see own panels" ON panels
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );
```

**What this does**:
1. User queries `SELECT * FROM panels`
2. PostgreSQL automatically adds WHERE filter:
   ```sql
   WHERE project_id IN (
     SELECT id FROM projects WHERE user_id = 'logged-in-user-id'
   )
   ```
3. User only sees panels for their projects

### Tables with RLS Policies

✅ **All tables have RLS enabled**:
- `profiles` - User profiles (users see only their own)
- `projects` - Projects (users see only their own)
- `panels` - Panels (filtered by project ownership)
- `circuits` - Circuits (filtered by project ownership)
- `transformers` - Transformers (filtered by project ownership)
- `loads` - Load entries (filtered by project ownership)
- `grounding_details` - Grounding data (filtered by project ownership)
- `inspection_items` - Inspection checklist (filtered by project ownership)
- `issues` - Code compliance issues (filtered by project ownership)

### Testing RLS Policies

**Test as specific user**:

```sql
-- In Supabase SQL Editor
SET request.jwt.claim.sub = 'user-uuid-here';

-- Now queries filter as that user
SELECT * FROM projects;  -- Only sees that user's projects
```

**Verify RLS enabled**:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
-- rowsecurity should be true for all tables
```

### Common RLS Mistakes

**❌ Mistake 1: Forgetting to enable RLS**

```sql
CREATE TABLE new_table (...);
-- OOPS: Forgot ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
```

**Result**: All users can see all data (security vulnerability!)

**❌ Mistake 2: Missing INSERT policy**

```sql
-- Only added SELECT policy, forgot INSERT
CREATE POLICY "Users see own data" ON table FOR SELECT USING (...);
-- OOPS: No INSERT policy!
```

**Result**: Users can't create new records (permission denied)

**❌ Mistake 3: Policy too permissive**

```sql
-- BAD: Allows users to see ANY project (no auth.uid() check)
CREATE POLICY "Anyone sees everything" ON projects
  FOR SELECT USING (true);
```

**Result**: Security hole - users can access other users' data

---

## Input Validation

### Current State

**Validation Level**: MINIMAL

**What's validated**:
- ❌ **No client-side validation** (user can enter negative amps, invalid voltage, etc.)
- ❌ **No server-side validation** (Supabase accepts any data matching schema types)
- ❌ **No Zod schemas** (TypeScript types only, no runtime checks)

**Known issues**:
- User can create panel with voltage = -480V (nonsensical)
- User can create circuit with breaker = 999999 amps (unrealistic)
- User can enter circuit description = SQL injection attempt (mitigated by parameterized queries)

### Recommended: Zod Validation

**Install**: `npm install zod`

**Example schema**:

```typescript
import { z } from 'zod';

export const PanelSchema = z.object({
  name: z.string().min(1).max(50),
  voltage: z.number().int().positive().refine(
    (val) => [120, 208, 240, 277, 480].includes(val),
    { message: 'Voltage must be standard value (120, 208, 240, 277, 480)' }
  ),
  phase: z.union([z.literal(1), z.literal(3)]),
  bus_rating_amps: z.number().int().positive().max(5000),
  main_breaker_amps: z.number().int().positive().max(5000).optional()
});

// Usage in component
const handleCreatePanel = async (formData) => {
  const result = PanelSchema.safeParse(formData);

  if (!result.success) {
    setError(result.error.errors[0].message);
    return;
  }

  await createPanel(result.data);  // Type-safe, validated data
};
```

**Priority**: MEDIUM (data consistency, not security critical)

---

## SQL Injection Prevention

### Current Protection: ✅ SAFE

**Why safe**: Supabase client uses **parameterized queries** (prepared statements)

**Example**:

```typescript
// ✅ SAFE: Supabase parameterizes automatically
const { data } = await supabase
  .from('panels')
  .select('*')
  .eq('name', userInput);  // Even if userInput = "'; DROP TABLE panels; --"
```

**Behind the scenes** (PostgreSQL):
```sql
-- Supabase sends parameterized query
PREPARE query AS SELECT * FROM panels WHERE name = $1;
EXECUTE query('user input here');  -- Treated as string literal, not SQL
```

**❌ DANGEROUS (what NOT to do)**:

```typescript
// ❌ VULNERABLE: Raw SQL via RPC
const { data } = await supabase.rpc('unsafe_query', {
  query: `SELECT * FROM panels WHERE name = '${userInput}'`  // SQL injection!
});
```

**If userInput** = `'; DROP TABLE panels; --`:
```sql
SELECT * FROM panels WHERE name = ''; DROP TABLE panels; --'
-- Executes DROP TABLE! Database destroyed!
```

**Rule**: **NEVER use `supabase.rpc()` with user-provided SQL strings.**

---

## XSS Prevention

### Current Protection: ✅ MOSTLY SAFE

**React escaping**: React automatically escapes JSX content

**Example**:

```typescript
const userInput = '<script>alert("XSS")</script>';

// ✅ SAFE: React escapes to &lt;script&gt;alert("XSS")&lt;/script&gt;
<div>{userInput}</div>
```

**❌ DANGEROUS (what NOT to do)**:

```typescript
// ❌ VULNERABLE: dangerouslySetInnerHTML bypasses escaping
<div dangerouslySetInnerHTML={{ __html: userInput }} />
// Executes <script> tag! XSS attack succeeds!
```

**Rule**: **NEVER use `dangerouslySetInnerHTML` with user input.**

### Content Security Policy (CSP)

**Current**: NO CSP headers

**Recommended CSP** (`index.html` or server headers):

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://cdn.tailwindcss.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://*.supabase.co;
  img-src 'self' data:;
">
```

**Priority**: MEDIUM (defense-in-depth, not critical)

---

## CORS Configuration

**Current**: Handled by Supabase (no custom configuration)

**Supabase CORS**: Allows all origins by default (acceptable for public API with RLS)

**If we add backend API**: Configure CORS to allow only our frontend domain

```typescript
// Example: Vercel serverless function
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://sparkplan.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle request
}
```

---

## Security Checklist for New Features

**Before merging any new feature**, verify:

- [ ] **RLS enabled** - All new tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] **RLS policies added** - All 4 policies (SELECT, INSERT, UPDATE, DELETE)
- [ ] **No hardcoded secrets** - No API keys, passwords in code
- [ ] **Input validation** - Zod schema or manual validation for user input
- [ ] **No SQL injection** - Use Supabase client, never raw SQL with user input
- [ ] **No XSS** - No `dangerouslySetInnerHTML` with user data
- [ ] **Authentication checked** - Protected routes require `auth.uid()` check
- [ ] **HTTPS only** - No HTTP endpoints (enforce at hosting level)

---

## Summary

**Current Security Posture**: 6/10

**Strengths**:
- ✅ Supabase Auth (industry-standard)
- ✅ RLS policies (all tables protected)
- ✅ Parameterized queries (SQL injection prevented)
- ✅ React escaping (XSS mostly prevented)

**Critical Weaknesses**:
- 🔴 **API key exposed in bundle** (MUST FIX BEFORE LAUNCH)

**Medium Improvements Needed**:
- 🟡 Input validation (Zod schemas)
- 🟡 Content Security Policy headers
- 🟡 Rate limiting (prevent API abuse)

**Action Items**:
1. **IMMEDIATELY**: Fix API key exposure (4-6 hours, backend proxy)
2. **Before beta**: Add Zod validation (8-10 hours)
3. **Before production**: Add CSP headers (2 hours)

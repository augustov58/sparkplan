# Deployment Guide
## NEC Pro Compliance Application

**Last Updated**: 2025-12-03
**Build Tool**: Vite 6.4.1
**Target**: Static hosting (Vercel, Netlify, GitHub Pages)

---

## Table of Contents

1. [Build Configuration](#build-configuration)
2. [Environment Variables](#environment-variables)
3. [Build Process](#build-process)
4. [Deployment Platforms](#deployment-platforms)
5. [Environment Strategy](#environment-strategy)
6. [Troubleshooting](#troubleshooting)

---

## Build Configuration

### Vite Configuration (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // Development server config
  server: {
    port: 3000,
    host: '0.0.0.0',
  },

  plugins: [react()],

  // Path alias: @ maps to project root
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
```

### Key Configuration Points

**✅ Secure Configuration**:
- **No `define` block** - No environment variables injected into client bundle
- **API keys server-side only** - Gemini API key stored in Supabase Edge Functions environment
- **Path aliases** - `@/` maps to project root for cleaner imports
- **Simple dev server** - Port 3000, host 0.0.0.0 for Docker/WSL compatibility

**✅ Security Verification**:
```bash
# Build and verify no API keys in bundle
npm run build
grep -r "GEMINI" dist/  # Returns nothing ✅
grep -r "API_KEY" dist/ # Returns nothing ✅
```

**Path Alias**:
```typescript
'@': path.resolve(__dirname, './')
```
- Enables imports like `import { supabase } from '@/lib/supabase'`
- Must also be configured in `tsconfig.json`

**Code Splitting**:
```typescript
manualChunks: {
  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
  'supabase-vendor': ['@supabase/supabase-js']
}
```
- Separates vendor libraries into own chunks
- Better browser caching (vendor code changes less frequently)

---

## Environment Variables

### Required Variables

#### Frontend Variables (`.env.local`)

```bash
# Supabase Configuration (OK to expose - public keys)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Note**: Variables prefixed with `VITE_` are automatically exposed to client-side code by Vite.

#### Backend Variables (Supabase Dashboard → Edge Functions → Secrets)

```bash
# Gemini AI API Key (✅ SECURE - server-side only)
GEMINI_API_KEY=your-gemini-api-key
```

**How to Set**: Supabase Dashboard → Project Settings → Edge Functions → Secrets

### Environment Variable Security

**✅ SAFE TO EXPOSE (Frontend)**:
- `VITE_SUPABASE_URL` - Public project URL
- `VITE_SUPABASE_ANON_KEY` - Anonymous/public key (RLS protects data)

**✅ SERVER-SIDE ONLY (Backend)**:
- `GEMINI_API_KEY` - Stored in Supabase Edge Functions environment
- Never exposed to client
- Accessed via `Deno.env.get('GEMINI_API_KEY')` in Edge Functions

**Why Supabase keys are safe to expose**:
- **Anon key** is designed to be public
- Security enforced by Row Level Security (RLS) policies
- All data filtered by `auth.uid()` in database
- Even with key, users can only access their own data

### `.env` File Structure

```bash
# .env.local (development - NOT committed to git)
# Frontend only needs Supabase config
VITE_SUPABASE_URL=https://dev-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...dev-key

# GEMINI_API_KEY is NOT in .env.local
# It's set in Supabase Dashboard → Edge Functions → Secrets

# .env.example (committed to git - template only)
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Accessing Environment Variables

**In React components**:
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

**In Vite config**:
```typescript
const apiKey = process.env.GEMINI_API_KEY;
```

---

## Build Process

### Local Production Build

```bash
# 1. Install dependencies
npm install

# 2. Build for production
npm run build
```

**Output**:
```
dist/
├── assets/
│   ├── index-[hash].js      # Main bundle (~2,295 KB)
│   ├── index-[hash].css     # Styles
│   ├── react-vendor-[hash].js  # React libraries
│   └── supabase-vendor-[hash].js  # Supabase library
├── index.html               # Entry point
└── ...other assets
```

**Build Stats** (Current):
```
dist/assets/index-BorUoQxk.js       2,295.21 kB │ gzip: 711.00 kB
dist/assets/index-tn0RQdqM.css            0.01 kB │ gzip:   0.03 kB
dist/index.html                           2.84 kB │ gzip:   1.06 kB

Total: 2,298 kB (gzipped: 712 kB)
```

### Preview Production Build Locally

```bash
# Build then preview
npm run build && npm run preview

# Or separately
npm run preview  # Serves dist/ on http://localhost:4173
```

**Use case**: Test production build before deploying

---

## Deployment Platforms

### Option 1: Vercel (Recommended)

**Why Vercel**:
- ✅ Zero configuration for Vite apps
- ✅ Automatic HTTPS
- ✅ Edge network (fast globally)
- ✅ Preview deployments for PRs
- ✅ Easy environment variable management
- ✅ Serverless functions (for backend API proxy)

**Deployment Steps**:

1. **Install Vercel CLI** (optional):
   ```bash
   npm install -g vercel
   ```

2. **Deploy from CLI**:
   ```bash
   vercel
   ```

3. **Or deploy via Git integration**:
   - Push code to GitHub
   - Import repository in Vercel dashboard
   - Vercel auto-detects Vite configuration
   - Deploy automatically on push to main

**Environment Variables** (Vercel Dashboard):
```
VITE_SUPABASE_URL = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY = eyJ...
GEMINI_API_KEY = AI... (for backend API when implemented)
```

**Build Settings**:
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

**`vercel.json`** (optional configuration):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

### Option 2: Netlify

**Why Netlify**:
- ✅ Similar to Vercel (auto-deploy, HTTPS, edge network)
- ✅ Excellent for static sites
- ✅ Built-in form handling
- ✅ Netlify Functions (serverless)

**Deployment Steps**:

1. **Create `netlify.toml`**:
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200  # SPA fallback (HashRouter compatible)
   ```

2. **Deploy via Git**:
   - Connect repository in Netlify dashboard
   - Netlify auto-deploys on push

3. **Or deploy via CLI**:
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod
   ```

**Environment Variables** (Netlify Dashboard):
- Same as Vercel (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, etc.)

---

### Option 3: GitHub Pages

**Why GitHub Pages**:
- ✅ Free for public repositories
- ✅ Simple setup
- ❌ No environment variables (use `.env.production` committed to git - less secure)
- ❌ No serverless functions

**Deployment Steps**:

1. **Install gh-pages**:
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Add deploy script** (`package.json`):
   ```json
   {
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```

3. **Deploy**:
   ```bash
   npm run deploy
   ```

4. **Configure GitHub Pages**:
   - Repository Settings → Pages
   - Source: `gh-pages` branch
   - URL: `https://username.github.io/repo-name`

**`vite.config.ts` update** (set base path):
```typescript
export default defineConfig({
  base: '/repo-name/',  // Replace with your repo name
  // ... rest of config
});
```

**Note**: HashRouter works well with GitHub Pages (no server-side routing needed)

---

### Option 4: Custom Server (VPS, AWS, etc.)

**Why Custom**:
- ✅ Full control
- ❌ More complex setup
- ❌ Manual SSL certificate management

**Deployment Steps**:

1. **Build locally or in CI/CD**:
   ```bash
   npm run build
   ```

2. **Upload `dist/` to server**:
   ```bash
   rsync -avz dist/ user@server:/var/www/nec-pro/
   ```

3. **Configure web server (Nginx example)**:
   ```nginx
   server {
       listen 80;
       server_name nec-pro.app;
       root /var/www/nec-pro;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;  # SPA fallback
       }

       # Gzip compression
       gzip on;
       gzip_types text/css application/javascript;
   }
   ```

4. **Set up SSL** (Let's Encrypt):
   ```bash
   certbot --nginx -d nec-pro.app
   ```

---

## Environment Strategy

### Current: Single Environment (Production)

**Structure**:
```
Production
  ↓
Supabase Production DB
```

**Issues**:
- ❌ No staging environment for testing
- ❌ Development uses production database (risky)
- ❌ No rollback strategy

---

### Recommended: Three-Environment Strategy

```
Development (localhost:3000)
  ↓
Supabase Local (via Supabase CLI)

Staging (staging.nec-pro.app)
  ↓
Supabase Staging Project

Production (nec-pro.app)
  ↓
Supabase Production Project
```

### Development Environment

**Setup**:
1. **Install Supabase CLI**:
   ```bash
   npm install -g supabase
   ```

2. **Initialize local Supabase**:
   ```bash
   supabase init
   supabase start
   ```

3. **Use local Supabase** (`.env.local`):
   ```bash
   VITE_SUPABASE_URL=http://localhost:54321
   VITE_SUPABASE_ANON_KEY=local-anon-key
   ```

**Benefits**:
- ✅ No internet required
- ✅ Fast iteration
- ✅ Can't accidentally corrupt production data

### Staging Environment

**Purpose**: Test before production deploy

**Setup**:
1. Create separate Supabase project (staging-nec-pro)
2. Deploy to staging URL (e.g., `staging.nec-pro.app`)
3. Use staging environment variables

**When to use**:
- Testing database migrations
- QA testing before production
- Client demos

### Production Environment

**Purpose**: Live application

**Monitoring**:
- Use Supabase Dashboard for database monitoring
- Set up error tracking (Sentry)
- Monitor API usage (Gemini quota)

---

## Troubleshooting

### Issue 1: 404 on Routes

**Symptom**: Navigating directly to `/project/123` returns 404

**Cause**: Server doesn't handle client-side routing

**Solution**:
- **If using HashRouter** (current): No issue (routes are `/#/project/123`)
- **If using BrowserRouter**: Configure server rewrites (see Netlify/Vercel config above)

---

### Issue 2: Environment Variables Not Working

**Symptom**: `import.meta.env.VITE_SUPABASE_URL` is undefined

**Possible Causes**:
1. Variable not prefixed with `VITE_`
2. `.env.local` not in project root
3. Server not restarted after adding variable

**Solution**:
```bash
# 1. Check file location
ls .env.local  # Should be in project root

# 2. Check prefix
# ❌ WRONG
SUPABASE_URL=...

# ✅ CORRECT
VITE_SUPABASE_URL=...

# 3. Restart dev server
npm run dev
```

---

### Issue 3: Build Fails

**Symptom**: `npm run build` exits with errors

**Common Causes**:

**Type errors**:
```bash
# Fix TypeScript errors first
npm run type-check
```

**Missing dependencies**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Out of memory**:
```bash
# Increase Node memory limit
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

---

### Issue 4: Large Bundle Size

**Symptom**: Bundle size > 3 MB (slow loading)

**Solutions**:

1. **Analyze bundle**:
   ```bash
   npm install -D rollup-plugin-visualizer
   ```

   ```typescript
   // vite.config.ts
   import { visualizer } from 'rollup-plugin-visualizer';

   export default defineConfig({
     plugins: [react(), visualizer()],
   });
   ```

2. **Lazy load routes**:
   ```typescript
   const OneLineDiagram = lazy(() => import('./components/OneLineDiagram'));
   ```

3. **Remove Tailwind CDN** (compile locally):
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

4. **Tree-shake unused code** (Vite does automatically)

---

### Issue 5: Supabase Connection Errors

**Symptom**: "Failed to fetch" or CORS errors

**Solutions**:

1. **Check environment variables**:
   ```typescript
   console.log(import.meta.env.VITE_SUPABASE_URL);
   ```

2. **Verify Supabase project active**:
   - Go to Supabase Dashboard
   - Check project is not paused (free tier pauses after inactivity)

3. **Check RLS policies**:
   - If data not appearing, RLS policy might be too restrictive
   - Test in Supabase SQL Editor:
     ```sql
     SELECT * FROM projects WHERE user_id = auth.uid();
     ```

---

### Issue 6: Gemini API Quota Exceeded

**Symptom**: AI features return "Quota exceeded" error

**Solutions**:

1. **Check quota** in Google Cloud Console:
   - Navigate to Gemini API
   - View quota usage

2. **Increase quota** (if needed):
   - Request quota increase in console

3. **Implement rate limiting**:
   ```typescript
   // services/geminiService.ts
   let lastCallTime = 0;
   const MIN_INTERVAL = 1000;  // 1 second between calls

   export async function validateLoadCalculation(data) {
     const now = Date.now();
     if (now - lastCallTime < MIN_INTERVAL) {
       throw new Error('Rate limit: Please wait before calling AI again');
     }
     lastCallTime = now;

     // ... rest of function
   }
   ```

---

## Deployment Checklist

**Before deploying to production**:

- [ ] Run tests: `npm test`
- [ ] Run TypeScript check: `npm run type-check`
- [ ] Build succeeds: `npm run build`
- [ ] Preview build locally: `npm run preview`
- [ ] Environment variables set on hosting platform
- [ ] Supabase RLS policies verified
- [ ] API key security issue addressed (backend proxy implemented)
- [ ] Error tracking configured (Sentry)
- [ ] Analytics configured (optional)
- [ ] DNS records configured (if custom domain)
- [ ] SSL certificate active (hosting platforms handle automatically)

---

## Continuous Deployment

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm install

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## Summary

**Current Deployment Status**:
- ✅ Vite build configuration working
- ✅ HashRouter compatible with static hosting
- ✅ API key security implemented (Supabase Edge Functions)
- ✅ Production-ready from security perspective
- ⚠️ Single environment (recommend adding staging for larger teams)

**Recommended Next Steps (Nice-to-Have)**:
1. Set up staging environment (if team collaboration needed)
2. Configure CI/CD pipeline (GitHub Actions)
3. Add error tracking (Sentry)
4. Optimize bundle size (lazy loading, local Tailwind compilation)
5. Expand E2E test coverage (Playwright)

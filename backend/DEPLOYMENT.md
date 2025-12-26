# Python Backend Deployment Guide

This guide covers deploying the NEC Pro Compliance AI backend to Railway or Render.

## Prerequisites

- Python backend running locally at http://localhost:8000
- Supabase project with required tables (agent_actions, agent_analysis_cache, agent_activity_log, project_photos)
- Google AI Studio API key (Gemini)

---

## Environment Variables

Your backend requires these environment variables in production:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# AI Configuration
GOOGLE_API_KEY=your-gemini-api-key-here

# CORS Configuration (JSON array of allowed frontend URLs)
ALLOWED_ORIGINS=["https://your-frontend-url.com","https://www.your-frontend-url.com"]

# Optional Configuration
ENVIRONMENT=production
PORT=8000
LOG_LEVEL=INFO
```

### Where to Find These Values:

**SUPABASE_URL**: Supabase Dashboard → Project Settings → API → Project URL

**SUPABASE_SERVICE_KEY**: Supabase Dashboard → Project Settings → API → service_role key (⚠️ Keep secret!)

**GOOGLE_API_KEY**: Google AI Studio → Get API Key → https://aistudio.google.com/app/apikey

**ALLOWED_ORIGINS**: JSON array of allowed frontend URLs (e.g., `["https://nec-pro-compliance.vercel.app"]`)

---

## Option 1: Deploy to Railway

### Step 1: Install Railway CLI (Optional)
```bash
npm install -g @railway/cli
railway login
```

### Step 2: Create New Project
1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account
5. Select the `NEC-Compliance` repository
6. Select the `feature/agentic-pm-system` branch

### Step 3: Configure Build Settings
Railway should auto-detect Python. If not, configure manually:

**Root Directory**: `/backend`

**Build Command**:
```bash
pip install -r requirements.txt
```

**Start Command**:
```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Step 4: Add Environment Variables
In Railway Dashboard → Variables:
- Click "New Variable"
- Add each variable from the list above
- Railway provides `PORT` automatically

### Step 5: Deploy
- Click "Deploy"
- Railway will build and deploy automatically
- Get your deployment URL: `https://your-app.railway.app`

### Step 6: Verify Deployment
```bash
curl https://your-app.railway.app/health
# Should return: {"status":"healthy","message":"NEC Pro AI Backend is running"}
```

---

## Option 2: Deploy to Render

### Step 1: Create New Web Service
1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub account
4. Select the `NEC-Compliance` repository

### Step 2: Configure Service
**Name**: `nec-pro-backend`

**Branch**: `feature/agentic-pm-system`

**Root Directory**: `backend`

**Runtime**: `Python 3`

**Build Command**:
```bash
pip install -r requirements.txt
```

**Start Command**:
```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

**Instance Type**: `Free` (for testing) or `Starter` ($7/mo - recommended for production)

### Step 3: Add Environment Variables
In Render Dashboard → Environment:
- Click "Add Environment Variable"
- Add each variable from the list above
- Render provides `PORT` automatically

### Step 4: Deploy
- Click "Create Web Service"
- Render will build and deploy automatically
- Get your deployment URL: `https://nec-pro-backend.onrender.com`

### Step 5: Verify Deployment
```bash
curl https://nec-pro-backend.onrender.com/health
# Should return: {"status":"healthy","message":"NEC Pro AI Backend is running"}
```

---

## Post-Deployment Configuration

### Update Frontend Environment Variables

After deploying the backend, update your frontend's environment variables:

**File**: `/NEC-Compliance/.env.local` (local development)

```bash
VITE_BACKEND_URL=https://your-backend-url.com
```

**Vercel/Netlify** (production):
- Go to deployment platform dashboard
- Environment Variables section
- Add: `VITE_BACKEND_URL=https://your-backend-url.com`
- Redeploy frontend

### Update Frontend API Client

**File**: `/services/api/pythonBackend.ts`

Update the base URL:
```typescript
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
```

### Enable CORS in Backend

The backend already has CORS configured in `main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,  # From ALLOWED_ORIGINS env var
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Ensure `ALLOWED_ORIGINS` environment variable is set to a JSON array of your allowed frontend URLs.
Example: `ALLOWED_ORIGINS=["https://your-app.vercel.app","https://www.your-app.vercel.app"]`

---

## Verify Full Integration

### Test All 4 Agents:

**1. Change Impact Analyzer**:
```bash
curl -X POST https://your-backend-url.com/api/agent-actions/analyze-change \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "project_id": "test-project",
    "change_description": "Add 3x 50A EV chargers",
    "proposed_loads": [{"type": "ev_charger", "amps": 50, "quantity": 3}]
  }'
```

**2. RFI Drafter**:
```bash
curl -X POST https://your-backend-url.com/api/agent-actions/draft-rfi \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "project_id": "test-project",
    "topic": "Service entrance grounding",
    "context": "Inspector questioned GEC sizing"
  }'
```

**3. Photo Analyzer**:
```bash
curl -X POST https://your-backend-url.com/api/agent-actions/analyze-photo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "project_id": "test-project",
    "image_data": "base64-encoded-image",
    "description": "Panel H1 interior"
  }'
```

**4. Predictive Inspector**:
```bash
curl -X POST https://your-backend-url.com/api/agent-actions/predict-inspection \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "project_id": "test-project"
  }'
```

---

## Monitoring & Logs

### Railway:
- Dashboard → Your Service → Logs tab
- Real-time logs showing requests, errors, AI calls

### Render:
- Dashboard → Your Service → Logs tab
- Last 7 days of logs (free tier)

### Common Issues:

**1. 401 Unauthorized**:
- Check JWT token is being sent from frontend
- Verify SUPABASE_SERVICE_KEY is correct
- Check middleware/auth.py is validating tokens

**2. 500 Internal Server Error**:
- Check logs for Python exceptions
- Verify all environment variables are set
- Check Supabase connection (SUPABASE_URL, SUPABASE_SERVICE_KEY)

**3. CORS Errors**:
- Verify ALLOWED_ORIGINS includes your deployed frontend URL(s)
- Check browser console for CORS error details
- Ensure frontend sends Authorization header
- Confirm ALLOWED_ORIGINS is a valid JSON array

**4. Gemini API Errors**:
- Verify GOOGLE_API_KEY is valid
- Check quota limits in Google AI Studio
- Review logs for specific error messages

---

## Cost Estimates

### Railway:
- **Free Tier**: $5 credit/month (good for testing)
- **Hobby Plan**: $5/month (500 hours)
- **Pro Plan**: Pay-as-you-go ($0.000231/GB-hour)

### Render:
- **Free Tier**: Free (sleeps after 15min inactivity)
- **Starter**: $7/month (always-on, 512MB RAM)
- **Standard**: $25/month (2GB RAM, better performance)

### Gemini API:
- **Free Tier**: 15 requests/minute, 1 million tokens/day
- **Pay-as-you-go**: $0.075/1M input tokens, $0.30/1M output tokens
- **24-hour cache reduces costs by ~90%**

### Supabase:
- **Free Tier**: 500MB database, 1GB file storage, 2GB bandwidth
- **Pro**: $25/month (8GB database, 100GB storage, 250GB bandwidth)

**Estimated Monthly Cost** (200 active users):
- Backend hosting: $7-25 (Render Starter/Standard)
- Gemini API: ~$50 (with 90% cache hit rate)
- Supabase: $25 (Pro tier for team features)
- **Total: $82-100/month**

**Revenue** (200 users @ $149/mo): **$29,800/month**
**ROI**: **298x-363x** 🚀

---

## Security Checklist

- [ ] Environment variables stored securely (not in code)
- [ ] JWT token validation enabled (middleware/auth.py)
- [ ] Supabase RLS policies active (agent_actions, project_photos)
- [ ] CORS restricted to frontend domain only
- [ ] Service role key kept secret (server-side only)
- [ ] HTTPS enabled on backend (Railway/Render provide this)
- [ ] API rate limiting considered (future enhancement)

---

## Next Steps

After deployment:

1. **Test all 4 agents** from production frontend
2. **Monitor logs** for errors/performance
3. **Apply Realtime migration** to Supabase:
   - Run `/supabase/migrations/20251225_enable_agent_realtime.sql` in SQL Editor
4. **Test real-time updates** - open two browser tabs, approve action in one, verify it updates in other
5. **Update frontend** to use production backend URL

---

## Support

- **Railway Docs**: https://docs.railway.app
- **Render Docs**: https://render.com/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com
- **Pydantic AI Docs**: https://ai.pydantic.dev

For issues, check:
1. Backend logs (Railway/Render dashboard)
2. Frontend console (browser DevTools)
3. Supabase logs (Dashboard → Logs & Reports)

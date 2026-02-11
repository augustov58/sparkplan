# SparkPlan - Python AI Backend

Pydantic AI-powered agent orchestration backend for electrical project management.

## Quick Start

### 1. Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Service role key (backend only, NOT anon key)
- `GEMINI_API_KEY` - Google Gemini API key

### 3. Run Development Server

```bash
uvicorn main:app --reload --port 8000
```

Server will start at: `http://localhost:8000`

- **API Docs:** `http://localhost:8000/docs` (Swagger UI)
- **Health Check:** `http://localhost:8000/health`

---

## Architecture

### Agents (Pydantic AI)

| Agent | File | Purpose |
|-------|------|---------|
| **Change Impact Analyzer** | `agents/change_impact.py` | Analyzes cascading impacts of system changes |
| **RFI Drafter** | `agents/rfi_drafter.py` | Generates professional RFI questions |
| **Photo Analyzer** | `agents/photo_analyzer.py` | Vision AI for detecting NEC violations in photos |
| **Predictive Inspector** | `agents/predictive.py` | Predicts inspection failures |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agent-actions/analyze-change` | POST | Trigger change impact analysis |
| `/api/agent-actions/draft-rfi` | POST | Generate RFI draft |
| `/api/agent-actions/analyze-photo` | POST | Analyze electrical installation photo |
| `/api/agent-actions/predict-inspection` | POST | Predict inspection outcome |
| `/api/agent-actions/{project_id}` | GET | Get pending agent actions |
| `/api/agent-actions/{action_id}/approve` | POST | Approve agent suggestion |
| `/api/agent-actions/{action_id}/reject` | POST | Reject agent suggestion |

### Tools (Agent Capabilities)

Agents can call these functions to fetch data:

- `get_project_data()` - Project details
- `get_all_panels()` - All panels in system
- `get_all_feeders()` - All feeders
- `get_all_issues()` - Open issues
- `get_service_utilization()` - Current service load
- `calculate_voltage_drop()` - Voltage drop calculations

---

## Testing

### Manual API Testing (cURL)

**Trigger Change Impact Analysis:**
```bash
curl -X POST http://localhost:8000/api/agent-actions/analyze-change \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
  -d '{
    "project_id": "your-project-uuid",
    "change_description": "Add 3x 50A EV chargers",
    "proposed_loads": [
      {"type": "ev_charger", "amps": 50, "quantity": 3}
    ]
  }'
```

**Get Pending Actions:**
```bash
curl http://localhost:8000/api/agent-actions/your-project-uuid \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT"
```

### Testing with Swagger UI

1. Go to `http://localhost:8000/docs`
2. Click "Authorize" and enter your Supabase JWT token
3. Try any endpoint interactively

---

## Deployment

### Railway (Recommended)

1. Connect GitHub repo to Railway
2. Set root directory to `/backend`
3. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `GEMINI_API_KEY`
4. Railway auto-detects Python and runs `uvicorn main:app`

### Render

1. Create new Web Service
2. Set build command: `pip install -r requirements.txt`
3. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables

### Vercel (Serverless Functions)

Not recommended - Pydantic AI works best with long-running processes.

---

## Security

- ✅ Supabase JWT validation on all endpoints
- ✅ Service role key server-side only (never exposed to frontend)
- ✅ User-scoped data access via RLS
- ✅ CORS configured for frontend domains

**Never expose:**
- `SUPABASE_SERVICE_KEY`
- `GEMINI_API_KEY`

---

## Development

### Project Structure

```
backend/
├── main.py              # FastAPI app entry point
├── config.py            # Environment configuration
├── requirements.txt     # Python dependencies
├── middleware/
│   └── auth.py         # JWT validation
├── models/
│   └── schemas.py      # Pydantic models
├── tools/
│   └── database.py     # Database query tools
├── agents/
│   ├── change_impact.py
│   ├── rfi_drafter.py
│   ├── photo_analyzer.py
│   └── predictive.py
└── routes/
    └── agent_actions.py # API endpoints
```

### Adding a New Agent

1. Create agent file in `agents/`
2. Define Pydantic result model in `models/schemas.py`
3. Add agent tools (database queries, calculations)
4. Create API endpoint in `routes/agent_actions.py`
5. Update `main.py` if needed

---

## Troubleshooting

**"ModuleNotFoundError: No module named 'pydantic_ai'"**
- Run `pip install -r requirements.txt`

**"Invalid authentication credentials"**
- Check that you're using Supabase JWT token (from frontend login)
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct

**"Agent timeout"**
- Gemini API can be slow for complex analysis
- Default timeout is 30 seconds
- For production, increase timeout in agent calls

**"Photo analysis not working"**
- Check image format (JPEG, PNG supported)
- Verify image is under 10MB
- Ensure Gemini API key has vision access enabled

---

## Performance

- **Average response time:** 2-5 seconds for simple analysis
- **Change impact analysis:** 5-10 seconds (multiple tool calls)
- **Photo analysis:** 3-8 seconds (vision AI slower)
- **Caching:** Analysis results cached for 24 hours (90% cost reduction)

---

## Monitoring

**Logs:**
- Structured logging to stdout
- View logs: Check Railway/Render dashboard
- Log level: Controlled by `LOG_LEVEL` environment variable

**Health Check:**
```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "healthy",
  "environment": "development",
  "services": {
    "supabase": "connected",
    "gemini": "configured"
  }
}
```

---

## Cost Optimization

**Gemini API Costs:**
- Flash model: ~$0.00001 per request
- With caching: ~$0.000001 per cached request
- Expected monthly cost (100 active users): ~$5-10

**Server Costs:**
- Railway Hobby: $5/month (500 hours)
- Render Free Tier: $0 (with sleep)
- Vercel: Not recommended for this use case

---

## Next Steps

1. ✅ Backend complete
2. ⏳ Update frontend `useAgentActions` hook to call this API
3. ⏳ Test end-to-end with React frontend
4. ⏳ Deploy to Railway/Render
5. ⏳ Update frontend `.env` with Python API URL

See `/docs/PYDANTIC_AI_MIGRATION.md` for complete migration guide.

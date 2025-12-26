# NEC Pro Compliance

**Professional electrical compliance platform with AI-powered project management**

A modern, cloud-native electrical design and project management tool that helps electrical contractors ensure NEC (National Electrical Code) compliance through intelligent automation and AI assistance.

---

## 🚀 Features

### Electrical Design & Calculations
- **Load Calculations** (NEC 220.82, 220.84) - Residential & commercial load analysis
- **Circuit Design** - Panel schedules, feeder sizing, branch circuits
- **One-Line Diagrams** - Interactive electrical single-line diagrams with export
- **Short Circuit Analysis** (NEC 110.9, IEEE 141) - Fault current calculations
- **Arc Flash Calculator** (NFPA 70E) - Arc flash hazard analysis
- **Grounding & Bonding** (NEC Article 250) - Grounding system validation
- **Voltage Drop** - AC impedance calculations per NEC Chapter 9
- **EV Charging** (NEC Article 625) - Level 2 and DC fast charger design
- **Solar PV** (NEC Article 690) - String sizing and inverter selection
- **EVEMS Load Management** (NEC 625.42) - Electric vehicle energy management systems

### Project Management
- **RFI Tracking** - Request for Information management with AI-powered PDF extraction
- **Site Visits** - Field observation logging with photo uploads
- **Calendar & Timeline** - Project deadlines, inspections, milestones
- **Open Items Dashboard** - Cross-project issue tracking
- **Permit Packet Generator** - Auto-generate permit documentation

### AI-Powered Features 🤖
- **4 Specialized AI Agents** (Pydantic AI + Gemini 2.0):
  - **Change Impact Analyzer** - Analyzes cascading effects of electrical system changes
  - **RFI Drafter** - Auto-generates professional RFI questions with NEC references
  - **Photo Analyzer** - Detects NEC violations from installation photos (Vision AI)
  - **Predictive Inspector** - Forecasts inspection failures before they happen

- **NEC Assistant** - Context-aware conversational AI for NEC code questions
- **Human-in-the-Loop** - AI suggests, users approve/reject (never auto-modifies data)
- **Real-time Updates** - WebSocket subscriptions for instant UI updates
- **24-hour Analysis Cache** - 90% cost reduction through intelligent caching

---

## 🏗️ Architecture

### Dual AI System

**System 1: Conversational AI (Supabase Edge Functions)**
- Direct Q&A with NEC Assistant
- Load calculation validation
- Grounding system checks
- Inspection checklist generation

**System 2: Agentic AI (Python Backend - FastAPI + Pydantic AI)**
- Structured analysis with guaranteed output formats
- Change impact analysis
- Photo-based violation detection
- RFI auto-drafting
- Predictive inspection analysis

### Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- Lucide Icons
- React Router
- jsPDF (PDF export)

**Backend:**
- FastAPI (Python web framework)
- Pydantic AI (structured AI agents)
- Google Gemini 2.0 Flash (LLM)
- Supabase (PostgreSQL database + Edge Functions)
- Railway (production hosting)

**Database:**
- PostgreSQL (via Supabase)
- Row-Level Security (RLS)
- Real-time subscriptions
- Automatic migrations

---

## 🛠️ Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- Supabase account
- Google AI Studio API key

### Frontend Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env.local`:**
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_PYTHON_API_URL=http://localhost:8000
   GEMINI_API_KEY=your-gemini-api-key
   ```

3. **Run dev server:**
   ```bash
   npm run dev
   ```

4. **Open browser:**
   http://localhost:3000

### Backend Setup (Python AI Agents)

1. **Navigate to backend:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Create `.env`:**
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   GOOGLE_API_KEY=your-gemini-api-key
   ALLOWED_ORIGINS=["http://localhost:3000"]
   ENVIRONMENT=development
   LOG_LEVEL=INFO
   ```

5. **Run backend:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```

6. **API Docs:**
   http://localhost:8000/docs (FastAPI auto-generated)

---

## 🚢 Production Deployment

### Frontend (Vercel/Netlify)
Standard React deployment. Set environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PYTHON_API_URL` (your Railway backend URL)
- `GEMINI_API_KEY`

### Backend (Railway)
See `/backend/DEPLOYMENT.md` for complete deployment guide.

**Quick Steps:**
1. Push to GitHub
2. Connect Railway to your repo
3. Set root directory: `backend`
4. Add environment variables (Supabase, Gemini, CORS)
5. Deploy!

**Production Backend:** https://neccompliance-production.up.railway.app

---

## 📊 Database Migrations

All migrations are in `/supabase/migrations/`. Apply via Supabase SQL Editor.

**Key Migrations:**
- `20251221_agent_system_core.sql` - AI agent tables (agent_actions, agent_analysis_cache, agent_activity_log)
- `20251225_enable_agent_realtime.sql` - Real-time WebSocket subscriptions
- `20251219_basic_pm_features.sql` - Project management tables (RFIs, site visits, calendar)

---

## 🧪 Testing

```bash
npm test
```

**Test Coverage:**
- Load calculations (NEC 220.82, 220.84)
- Conductor sizing (NEC 310.16)
- Grounding (NEC 250.122)
- Service upgrade wizard (NEC 220.87)

---

## 📖 Documentation

- **[CLAUDE.md](/CLAUDE.md)** - Complete development guide for AI assistants
- **[AI Agent Architecture](/docs/AI_AGENT_ARCHITECTURE.md)** - Dual AI system explained
- **[Backend Deployment](/backend/DEPLOYMENT.md)** - Railway deployment guide
- **[Strategic Analysis](/STRATEGIC_ANALYSIS.md)** - Market positioning & roadmap

---

## 💰 Cost Structure (Production)

**Monthly Costs** (200 active users):
- Railway Backend: $7-25 (Starter/Standard)
- Gemini API: ~$50 (with 90% cache savings)
- Supabase: $25 (Pro tier)
- **Total:** $82-100/month

**Revenue** (200 users @ $149/mo Professional): **$29,800/month**

**ROI:** **298x-363x** 🚀

---

## 🔐 Security

- ✅ API keys stored server-side (Supabase Edge Functions + Railway)
- ✅ JWT authentication for all API calls
- ✅ Row-Level Security (RLS) on all database tables
- ✅ CORS configured for approved origins only
- ✅ No secrets in git repository

---

## 📝 License

Private project - All rights reserved

---

## 🤝 Contributing

This is a private project. For questions or issues, contact the repository owner.

---

## 🎯 Roadmap

- [x] **Phase 0:** Basic project management (RFIs, site visits, calendar)
- [x] **Phase 1:** AI agent infrastructure (Pydantic AI + FastAPI)
- [x] **Phase 2:** EV niche domination (EVEMS, service upgrade wizard)
- [ ] **Phase 3:** Design copilot (AI-powered auto-design)
- [ ] **Phase 4:** Solar + storage expansion (battery systems)

---

**Built with ❤️ for electrical contractors who deserve modern tools**

# Pydantic AI Migration Plan

**Status:** ✅ COMPLETE
**Started:** 2025-12-21
**Completed:** 2025-12-26
**Goal:** Replace TypeScript agent orchestration with Python + Pydantic AI for more robust agent capabilities

## Deployment

**Production URL:** https://neccompliance-production.up.railway.app
**Platform:** Railway.app
**Repository:** https://github.com/augustov58/nec_compliance

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Comparison](#architecture-comparison)
3. [What Stays vs. What Changes](#what-stays-vs-what-changes)
4. [Migration Strategy](#migration-strategy)
5. [Implementation Plan](#implementation-plan)
6. [Deployment Guide](#deployment-guide)
7. [Rollback Plan](#rollback-plan)

---

## Overview

### Why Migrate to Pydantic AI?

**Current Problem:**
- TypeScript agent orchestration requires manual prompt engineering, parsing, validation
- No guaranteed structured outputs from AI
- Tool calling requires manual implementation
- No built-in conversation memory
- Lots of boilerplate code

**Pydantic AI Solution:**
- **Structured outputs:** AI responses validated at runtime, automatic retries
- **Built-in tool use:** Agents automatically call Python functions
- **Type safety:** Pydantic models ensure data integrity
- **70% less code:** Framework handles orchestration, retries, memory
- **Better AI capabilities:** Multi-turn reasoning, dependency injection

### Key Benefits for NEC Pro Compliance

| Feature | TypeScript | Pydantic AI | Impact |
|---------|-----------|-------------|--------|
| **Change Impact Analysis** | Manual calculations + parsing | Agent uses tools, guaranteed valid output | 🟢 High |
| **Photo Analysis (Vision)** | Manual base64 encoding + parsing | Built-in multimodal support | 🟢 High |
| **RFI Drafting** | String templates | Structured generation with validation | 🟡 Medium |
| **Code Maintenance** | ~400 lines orchestration code | ~100 lines agent definitions | 🟢 High |
| **Reliability** | Hope AI returns valid JSON | Pydantic enforces schema, retries on invalid | 🟢 High |

---

## Architecture Comparison

### Current Architecture (TypeScript)

```
┌─────────────────────────────────────────┐
│         React Frontend                  │
│  ┌─────────────────────────────────┐   │
│  │  Components                     │   │
│  │  - AICopilotSidebar            │   │
│  │  - Dashboard, etc.             │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  Custom Hooks                   │   │
│  │  - useAgentActions()           │   │
│  │    ↓ (Supabase Client)         │   │
│  └─────────────────────────────────┘   │
└─────────────────┬───────────────────────┘
                  │
                  ↓ Direct PostgreSQL queries
┌─────────────────────────────────────────┐
│         Supabase                        │
│  ┌────────────────────────────────┐    │
│  │  PostgreSQL Database           │    │
│  │  - agent_actions               │    │
│  │  - agent_analysis_cache        │    │
│  │  - projects, panels, etc.      │    │
│  └────────────────────────────────┘    │
│  ┌────────────────────────────────┐    │
│  │  Edge Function (Deno/TS)       │    │
│  │  - Gemini API proxy            │    │
│  │  - Manual prompt building      │    │
│  │  - Manual JSON parsing         │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### New Architecture (Pydantic AI)

```
┌─────────────────────────────────────────┐
│         React Frontend                  │
│  ┌─────────────────────────────────┐   │
│  │  Components (UNCHANGED)         │   │
│  │  - AICopilotSidebar            │   │
│  │  - Dashboard, etc.             │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │  Custom Hooks (Modified)        │   │
│  │  - useAgentActions()           │   │
│  │    ↓ (Fetch to Python API)     │   │
│  └─────────────────────────────────┘   │
└─────────────────┬───────────────────────┘
                  │
                  ↓ HTTP REST API (with Supabase JWT)
┌─────────────────────────────────────────┐
│      Python FastAPI Backend (NEW)       │
│  ┌────────────────────────────────┐    │
│  │  API Routes                     │   │
│  │  - POST /agent-actions/analyze │   │
│  │  - GET  /agent-actions/:id     │   │
│  │  - POST /agent-actions/:id/approve│ │
│  └────────────────────────────────┘    │
│  ┌────────────────────────────────┐    │
│  │  Pydantic AI Agents             │   │
│  │  - ChangeImpactAgent           │   │
│  │  - PhotoAnalyzerAgent          │   │
│  │  - RFIDrafterAgent             │   │
│  │  - PredictiveInspectorAgent    │   │
│  └────────────────────────────────┘    │
│  ┌────────────────────────────────┐    │
│  │  Agent Tools                    │   │
│  │  @agent.tool                   │   │
│  │  - get_panels()                │   │
│  │  - calculate_voltage_drop()    │   │
│  │  - get_feeders()               │   │
│  │  - analyze_service_capacity()  │   │
│  └────────────────────────────────┘    │
│          ↓                ↓             │
│  ┌─────────────┐  ┌──────────────┐    │
│  │ Supabase    │  │ Gemini API   │    │
│  │ Python SDK  │  │ (direct)     │    │
│  └─────────────┘  └──────────────┘    │
└─────────────────┬───────────────────────┘
                  │
                  ↓ PostgreSQL queries
┌─────────────────────────────────────────┐
│         Supabase (UNCHANGED)            │
│  ┌────────────────────────────────┐    │
│  │  PostgreSQL Database           │    │
│  │  - Same tables                 │    │
│  │  - Same RLS policies           │    │
│  │  - Same migrations             │    │
│  └────────────────────────────────┘    │
│  ┌────────────────────────────────┐    │
│  │  Auth (UNCHANGED)              │    │
│  │  - JWT tokens                  │    │
│  │  - User sessions               │    │
│  └────────────────────────────────┘    │
│  ┌────────────────────────────────┐    │
│  │  Storage (UNCHANGED)           │    │
│  │  - Photo uploads               │    │
│  │  - PDF exports                 │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## What Stays vs. What Changes

### ✅ STAYS THE SAME (99% of codebase)

#### **1. Supabase Database (100% unchanged)**
- All tables: `projects`, `panels`, `circuits`, `feeders`, `transformers`
- PM tables: `rfis`, `site_visits`, `calendar_events`
- Agent tables: `agent_actions`, `agent_analysis_cache`, `agent_activity_log`, `project_photos`
- All RLS policies
- All migrations
- **Zero schema changes required**

#### **2. React Frontend (95% unchanged)**
- All components: `Dashboard`, `PanelSchedule`, `OneLineDiagram`, `RFIManager`, etc.
- All calculation services: `conductorSizing.ts`, `voltageDrop.ts`, `shortCircuit.ts`, etc.
- All hooks except `useAgentActions`: `useProjects`, `usePanels`, `useCircuits`, etc.
- All routing, navigation, UI
- `types.ts` - Agent types stay, shared between TS and Python

#### **3. Supabase Auth (100% unchanged)**
- Login/signup flows
- JWT token generation
- User sessions
- RLS enforcement
- Python backend validates Supabase JWT tokens

#### **4. Supabase Storage (100% unchanged)**
- Photo uploads to Supabase Storage
- Buckets, RLS policies
- PDF exports

### 🔄 CHANGES

#### **1. Agent Orchestration Layer**

**REMOVE:**
```
❌ services/ai/agentOrchestrator.ts (319 lines) → Replaced by Python agents
```

**MODIFY:**
```
🔄 hooks/useAgentActions.ts (~100 lines)
   - Change Supabase direct queries to fetch() calls to Python API
   - Keep same interface for components
   - ~20-30 lines modified

🔄 components/AICopilotSidebar.tsx (303 lines)
   - Minimal changes (uses same hook interface)
   - Maybe add loading states for API calls
   - ~5-10 lines modified
```

**ADD:**
```
✅ Python FastAPI backend (new directory: /backend/)
✅ Pydantic AI agents (4 agents × ~100 lines = 400 lines)
✅ Agent tools (database queries, calculations) (~200 lines)
✅ API routes (~100 lines)
```

**Net change:** Remove 319 TypeScript lines, add ~700 Python lines

#### **2. Deployment**

**Current:**
- Frontend: Vercel/Netlify (free)
- Backend: Supabase Edge Functions (free)
- Database: Supabase (free tier)

**New:**
- Frontend: Vercel/Netlify (free) ← NO CHANGE
- Backend: Railway/Render/Fly.io (Python) ← NEW (~$5-10/month)
- Database: Supabase (free tier) ← NO CHANGE

---

## Migration Strategy

### Phase A: Build Python Backend (Parallel Development)

**Goal:** Build Python backend without touching existing TypeScript code

**Steps:**
1. Create `/backend/` directory with FastAPI skeleton
2. Set up Supabase Python SDK connection
3. Implement Pydantic AI agents:
   - Change Impact Analyzer (Priority 1 - killer feature)
   - RFI Drafter (Priority 2 - simple, good test)
   - Photo Analyzer (Priority 3 - vision capabilities)
   - Predictive Inspector (Priority 4 - complex reasoning)
4. Implement agent tools (database queries, calculations)
5. Create API routes for agent operations
6. Add Supabase JWT validation middleware
7. Test agents independently with Postman/curl

**Duration:** 6-8 hours
**Risk:** Low (existing code keeps running)

### Phase B: Connect Frontend to Python API

**Goal:** Switch frontend to use Python backend

**Steps:**
1. Deploy Python backend to Railway/Render
2. Update `useAgentActions.ts` to call Python API instead of Supabase
3. Update environment variables (add `VITE_PYTHON_API_URL`)
4. Test end-to-end with real frontend
5. Monitor for errors, fix issues
6. Remove old TypeScript orchestration code

**Duration:** 2-3 hours
**Risk:** Medium (easy rollback by reverting API URL)

### Phase C: Cleanup & Documentation

**Steps:**
1. Remove `services/ai/agentOrchestrator.ts`
2. Update documentation
3. Add Python backend to deployment pipeline
4. Update CLAUDE.md with new architecture

**Duration:** 1 hour
**Risk:** Low

**Total Time:** 9-12 hours

---

## Implementation Plan

### Step 1: Python Backend Setup (1 hour)

**Files to create:**
```
/backend/
├── main.py                 # FastAPI app
├── requirements.txt        # Dependencies
├── .env.example           # Environment variables template
├── config.py              # Configuration
├── middleware/
│   └── auth.py           # Supabase JWT validation
├── agents/
│   ├── __init__.py
│   ├── change_impact.py  # Change Impact Analyzer agent
│   ├── rfi_drafter.py    # RFI Drafter agent
│   ├── photo_analyzer.py # Photo Analyzer agent
│   └── predictive.py     # Predictive Inspector agent
├── tools/
│   ├── __init__.py
│   ├── database.py       # Supabase database queries
│   └── calculations.py   # NEC calculations
├── models/
│   ├── __init__.py
│   └── schemas.py        # Pydantic models (shared with agents)
└── routes/
    ├── __init__.py
    └── agent_actions.py  # API endpoints
```

**Dependencies (requirements.txt):**
```txt
fastapi==0.104.1
uvicorn==0.24.0
pydantic-ai==0.0.13
pydantic==2.5.0
supabase==2.3.0
python-dotenv==1.0.0
google-generativeai==0.3.2
pillow==10.1.0           # For image processing
python-multipart==0.0.6  # For file uploads
httpx==0.25.2            # For async HTTP
```

**Environment Variables (.env):**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-key
ENVIRONMENT=development
PORT=8000
```

### Step 2: Implement Change Impact Analyzer Agent (2 hours)

**Priority:** 🥇 HIGHEST - This is the killer feature

**File:** `/backend/agents/change_impact.py`

**Capabilities:**
- Analyze impact of adding new loads to electrical system
- Calculate service upgrade requirements
- Estimate voltage drop issues
- Generate cost estimates
- Produce change order drafts

**Tools needed:**
- `get_project_data()` - Fetch service size, voltage, existing load
- `get_all_panels()` - Get panel hierarchy
- `get_all_feeders()` - Get feeder data for voltage drop calc
- `calculate_service_utilization()` - Current service load
- `calculate_voltage_drop()` - Feeder voltage drop
- `estimate_material_costs()` - Cost estimation

**Output Schema:**
```python
class ChangeImpact(BaseModel):
    can_accommodate: bool
    impact_summary: str
    service_impact: Optional[ServiceImpact]
    feeder_impacts: List[FeederImpact]
    panel_impacts: List[PanelImpact]
    voltage_drop_issues: List[VoltageDropIssue]
    cost_estimate: Optional[CostEstimate]
    timeline_impact: Optional[TimelineImpact]
    recommendations: List[str]
    change_order_draft: Optional[str]
```

### Step 3: Implement RFI Drafter Agent (1 hour)

**Priority:** 🥈 HIGH - Simple, good for testing

**File:** `/backend/agents/rfi_drafter.py`

**Capabilities:**
- Generate RFI questions from project context
- Suggest appropriate recipients
- Determine priority based on project phase

**Tools needed:**
- `get_project_info()` - Project details
- `get_recent_issues()` - Context for RFI
- `get_panel_info()` - If RFI is about specific equipment

**Output Schema:**
```python
class RFIDraft(BaseModel):
    subject: str
    question: str
    suggested_recipient: Optional[str]
    priority: Literal['Low', 'Medium', 'High', 'Urgent']
    related_nec_articles: List[str]
    rationale: str
```

### Step 4: Implement Photo Analyzer Agent (2 hours)

**Priority:** 🥈 HIGH - Unique AI capability

**File:** `/backend/agents/photo_analyzer.py`

**Capabilities:**
- Analyze electrical installation photos
- Detect NEC violations
- Identify equipment and ratings
- Generate inspection notes

**Tools needed:**
- `get_project_standards()` - NEC version, local codes
- `fetch_panel_data()` - Compare photo to panel schedule
- `lookup_nec_article()` - Reference specific code sections

**Output Schema:**
```python
class PhotoAnalysis(BaseModel):
    summary: str
    violations: List[NecViolation]
    equipment_identified: List[Equipment]
    recommendations: List[str]
    severity: Literal['Info', 'Warning', 'Critical']
    requires_correction: bool
    suggested_actions: List[str]

class NecViolation(BaseModel):
    nec_article: str
    description: str
    severity: Literal['Info', 'Warning', 'Critical']
    recommendation: str
    location_in_photo: Optional[str]
```

### Step 5: Implement Predictive Inspector Agent (2 hours)

**Priority:** 🥉 MEDIUM - Complex reasoning

**File:** `/backend/agents/predictive.py`

**Capabilities:**
- Predict likelihood of inspection failures
- Identify high-risk issues
- Generate inspection preparation checklist
- Suggest fixes before inspection

**Tools needed:**
- `get_all_issues()` - Open issues in project
- `get_inspector_mode_results()` - Previous inspection results
- `get_panel_schedules()` - Verify compliance
- `check_grounding_system()` - NEC 250 compliance

**Output Schema:**
```python
class InspectionPrediction(BaseModel):
    failure_likelihood: float  # 0.0 - 1.0
    risk_level: Literal['Low', 'Medium', 'High', 'Critical']
    predicted_issues: List[PredictedIssue]
    preparation_checklist: List[str]
    estimated_prep_time: str
    confidence: float

class PredictedIssue(BaseModel):
    category: str
    description: str
    nec_reference: str
    likelihood: float
    suggested_fix: str
    estimated_fix_time: str
```

### Step 6: Create API Routes (1 hour)

**File:** `/backend/routes/agent_actions.py`

**Endpoints:**
```python
POST   /api/agent-actions/analyze-change
  Body: { project_id, change_description, proposed_loads }
  Returns: AgentAction (queued for approval)

POST   /api/agent-actions/draft-rfi
  Body: { project_id, context, topic }
  Returns: AgentAction

POST   /api/agent-actions/analyze-photo
  Body: FormData { project_id, photo_file }
  Returns: AgentAction

POST   /api/agent-actions/predict-inspection
  Body: { project_id }
  Returns: AgentAction

GET    /api/agent-actions/:project_id
  Returns: List[AgentAction] (pending suggestions)

POST   /api/agent-actions/:action_id/approve
  Body: { user_notes }
  Returns: { success, executed }

POST   /api/agent-actions/:action_id/reject
  Body: { reason }
  Returns: { success }
```

### Step 7: Update Frontend Hook (30 minutes)

**File:** `/hooks/useAgentActions.ts`

**Changes:**
```typescript
// OLD: Direct Supabase queries
const { data } = await supabase
  .from('agent_actions')
  .select('*')
  .eq('project_id', projectId);

// NEW: API calls
const token = session?.access_token;
const response = await fetch(`${import.meta.env.VITE_PYTHON_API_URL}/api/agent-actions/${projectId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const data = await response.json();
```

**Add new functions:**
```typescript
export async function triggerChangeImpactAnalysis(
  projectId: string,
  changeDescription: string,
  proposedLoads: any[]
): Promise<AgentAction> {
  const response = await fetch(`${API_URL}/api/agent-actions/analyze-change`, {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify({ project_id: projectId, change_description: changeDescription, proposed_loads: proposedLoads })
  });
  return response.json();
}
```

### Step 8: Deploy Python Backend (1 hour)

**Platform:** Railway.app (recommended) or Render.com

**Railway Setup:**
1. Connect GitHub repo
2. Create new service from `/backend/` directory
3. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `GEMINI_API_KEY`
4. Railway auto-detects Python and runs `uvicorn main:app`
5. Get deployment URL: `https://your-app.railway.app`

**Update Frontend .env.local:**
```bash
VITE_PYTHON_API_URL=https://your-app.railway.app
```

---

## Deployment Guide

### Local Development

**1. Start Python backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**2. Start React frontend:**
```bash
npm run dev
```

**3. Environment variables:**
```bash
# Frontend (.env.local)
VITE_SUPABASE_URL=https://jlklgwkpydzabazcjsul.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_PYTHON_API_URL=http://localhost:8000

# Backend (.env)
SUPABASE_URL=https://jlklgwkpydzabazcjsul.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-key
```

### Production Deployment

**Frontend (Vercel):**
- No changes to deployment
- Add `VITE_PYTHON_API_URL` environment variable

**Backend (Railway):**
1. Create new project on Railway.app
2. Connect GitHub repo
3. Set root directory to `/backend`
4. Add environment variables
5. Deploy automatically on push to main

**Database (Supabase):**
- No changes required
- Same database, same tables

---

## Rollback Plan

**If Python backend has issues:**

1. **Immediate rollback (5 minutes):**
   ```typescript
   // In hooks/useAgentActions.ts
   // Comment out new API calls, uncomment old Supabase queries

   // const response = await fetch(...);  // NEW - comment this out
   const { data } = await supabase...    // OLD - uncomment this
   ```

2. **Restore files:**
   ```bash
   git checkout HEAD~1 -- hooks/useAgentActions.ts
   git checkout HEAD~1 -- services/ai/agentOrchestrator.ts
   ```

3. **Redeploy frontend:**
   ```bash
   git commit -m "Rollback to TypeScript agents"
   git push
   ```

**Result:** Back to 100% TypeScript within 10 minutes

---

## Testing Strategy

### Unit Tests (Python)

```python
# /backend/tests/test_change_impact_agent.py
import pytest
from agents.change_impact import analyze_change_impact

@pytest.mark.asyncio
async def test_change_impact_service_upgrade():
    result = await analyze_change_impact(
        project_id="test-123",
        change_description="Add 3x 50A EV chargers",
        proposed_loads=[50, 50, 50]
    )

    assert result.can_accommodate in [True, False]
    assert result.service_impact is not None
    assert isinstance(result.cost_estimate.low, int)
```

### Integration Tests

```bash
# Test Python API with curl
curl -X POST http://localhost:8000/api/agent-actions/analyze-change \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "project_id": "abc-123",
    "change_description": "Add 100A subpanel",
    "proposed_loads": [{"amps": 100, "type": "panel"}]
  }'
```

### End-to-End Tests

1. Create project in UI
2. Trigger Change Impact Analysis
3. Verify agent action appears in sidebar
4. Approve action
5. Verify impact analysis is executed

---

## Success Metrics

**Before (TypeScript):**
- Agent orchestration code: ~400 lines
- Manual JSON parsing and validation
- No guaranteed structured outputs
- Limited tool use capabilities

**After (Pydantic AI):**
- Agent code: ~100-150 lines per agent
- Automatic validation and retries
- Type-safe structured outputs
- Rich tool ecosystem

**Improvements:**
- ✅ 60-70% less code to maintain
- ✅ More reliable AI outputs (Pydantic validation)
- ✅ Faster development (built-in patterns)
- ✅ Better error handling (automatic retries)
- ✅ Richer agent capabilities (tools, memory, multimodal)

---

## Completion Summary

1. ✅ Document migration plan (this file)
2. ✅ Create Python backend skeleton
3. ✅ Implement Change Impact Analyzer agent
4. ✅ Implement RFI Drafter agent
5. ✅ Implement Photo Analyzer agent
6. ✅ Implement Predictive Inspector agent
7. ✅ Create API routes
8. ✅ Update frontend hook (`services/api/pythonBackend.ts`)
9. ✅ Deploy to Railway (https://neccompliance-production.up.railway.app)
10. ✅ Cleanup and documentation

**Current Status:** ✅ COMPLETE - All 4 agents operational in production

### Implemented Agents

| Agent | File | Status |
|-------|------|--------|
| Change Impact Analyzer | `/backend/agents/change_impact.py` | ✅ Live |
| RFI Drafter | `/backend/agents/rfi_drafter.py` | ✅ Live |
| Photo Analyzer | `/backend/agents/photo_analyzer.py` | ✅ Live |
| Predictive Inspector | `/backend/agents/predictive.py` | ✅ Live |

### Frontend Integration

- API client: `/services/api/pythonBackend.ts`
- Environment variable: `VITE_PYTHON_API_URL`
- Results appear in AI Copilot sidebar with approve/reject workflow

---

## References

- [Pydantic AI Documentation](https://ai.pydantic.dev/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Supabase Python SDK](https://supabase.com/docs/reference/python/introduction)
- [Google Gemini API (Python)](https://ai.google.dev/tutorials/python_quickstart)

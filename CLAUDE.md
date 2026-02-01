# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🔄 ACTIVE SESSION LOG

**⚠️ CHECK FIRST**: Before starting work, read `/docs/SESSION_LOG.md` for:
- Current session status and in-progress work
- Recent changes made by previous Claude instances
- Pending tasks and context from last session

**Current Branch**: `main`
**Last Session**: 2026-01-31 (Multi-Family EV Bug Fixes & Merge)

---

## 🎯 PROJECT OVERVIEW

**NEC Pro Compliance** is a professional SaaS dashboard for electrical contractors and engineers to design NEC-compliant electrical systems.

**Core Value**: Modern web-based alternative to expensive desktop tools (ETAP, SKM, EasyPower @ $15k-$50k/yr) with AI-powered features competitors can't match.

**Target Markets**: EV charging installers, solar integrators, multi-family developers, healthcare facilities, data centers.

**Strategic Document**: See `STRATEGIC_ANALYSIS.md` for complete market analysis and roadmap.

---

## ✅ SECURITY STATUS: PRODUCTION-READY

**Architecture**: Gemini API properly protected via Supabase Edge Functions (server-side proxy)
**Implementation**: `/supabase/functions/gemini-proxy/index.ts`
**Result**: ✅ No API keys in frontend bundle, JWT authentication required

**Backend**: Python FastAPI + Pydantic AI agents deployed to Railway
**URL**: https://neccompliance-production.up.railway.app

---

## 📚 DOCUMENTATION INDEX

### 🤖 FOR LLM TAKEOVER: START HERE FIRST
- **[LLM Handoff Prompt](/docs/HANDOFF_PROMPT.md)** - Complete reading guide (3-4 hours)
- **[Session Log](/docs/SESSION_LOG.md)** - Current session status and recent changes
- **[Strategic Analysis](/STRATEGIC_ANALYSIS.md)** - Market positioning, AI differentiation, roadmap

### Core Documentation
- **[Architecture Overview](/docs/architecture.md)** - State management, data flow, optimistic updates
- **[AI Agent Architecture](/docs/AI_AGENT_ARCHITECTURE.md)** - Pydantic AI agents, dual AI systems
- **[AI Chatbot Tools](/docs/AI_CHATBOT_TOOLS.md)** - NEC Copilot action tools reference
- **[Development Guide](/docs/development-guide.md)** - Step-by-step workflows
- **[Database Architecture](/docs/database-architecture.md)** - Schema, RLS policies, migrations
- **[Security Guide](/docs/security.md)** - Security audit, API protection
- **[Testing Strategy](/docs/testing-strategy.md)** - Testing pyramid, examples

### Architecture Decision Records (ADRs)
- **[ADR-001](/docs/adr/001-optimistic-ui-updates.md)** - Optimistic UI Updates
- **[ADR-002](/docs/adr/002-custom-hooks-over-react-query.md)** - Custom Hooks Over React Query
- **[ADR-003](/docs/adr/003-supabase-realtime-state-management.md)** - Supabase Real-Time State
- **[ADR-004](/docs/adr/004-hashrouter-for-github-pages.md)** - HashRouter for GitHub Pages
- **[ADR-005](/docs/adr/005-panel-hierarchy-discriminated-union.md)** - Panel Hierarchy Design
- **[ADR-006](/docs/adr/006-one-line-diagram-monolith.md)** - OneLineDiagram Monolith

---

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm test             # Run tests
```

---

## Environment Setup

**Frontend Environment** (`.env.local`):
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_PYTHON_API_URL=https://neccompliance-production.up.railway.app
```

**Supabase Edge Functions** (Dashboard → Edge Functions → Secrets):
```bash
GEMINI_API_KEY=your_api_key_here  # For gemini-proxy edge function
```

**Python Backend** (`/backend/.env`):
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key  # Service role, not anon key
GOOGLE_API_KEY=your_gemini_api_key_here     # For Pydantic AI agents
```

⚠️ **IMPORTANT**: Gemini API key needed in BOTH Supabase Edge Functions AND Python backend.

---

## 🚀 CURRENT STATUS & ROADMAP

### ✅ Phase 0: Basic Project Management - COMPLETE (Dec 20, 2025)
- RFI Tracking with AI PDF extraction
- Site Visit Logging with photo upload
- Open Items Dashboard (cross-project)
- Calendar/Timeline with events

### ✅ Phase 1: AI Killer Features - COMPLETE (Dec 2025)
- Inspector Mode AI (pre-inspection audit)
- Enhanced NEC Assistant (context-aware)
- Permit Packet Generator (Tier 1 complete, Tier 2 in progress)
- Arc Flash Calculator ✅
- Short Circuit Calculator ✅

### ⏳ Phase 2: EV Niche Domination - IN PROGRESS (Dec 25, 2025)
- EVEMS Load Management Calculator (NEC 625.42) ✅
- Service Upgrade Wizard (NEC 220.87, 230.42) ✅
- Utility Interconnection Forms (PG&E, SCE, SDG&E) 🔜 **COMING SOON** (code complete, UI hidden)
- EV Panel Templates (4× & 8× Level 2, 2× DC Fast) ✅

### ✅ Permit Packet Generator - Tier 2 COMPLETE (Dec 31, 2025)
**Status**: Residential 100% complete, Commercial 100% complete

| Feature | Status | Priority |
|---------|--------|----------|
| Short Circuit Calculator | ✅ COMPLETE (with PDF export) | 🥇 CRITICAL |
| Arc Flash Calculator | ✅ COMPLETE (with PDF export) | 🥇 CRITICAL |
| Grounding Plan | ✅ COMPLETE (NEC Article 250 document) | 🥇 CRITICAL |
| Equipment Specification Sheets | ✅ COMPLETE | 🥈 Important |
| Voltage Drop Report | ✅ COMPLETE | 🥈 Important |
| Jurisdiction Requirement Wizard | ✅ COMPLETE (6 jurisdictions seeded) | 🥉 Nice-to-have |

**Result**: 100% commercial permit readiness - all jurisdiction requirements deliverable!

### ✅ Phase 2.5: Multi-Family EV Domination - COMPLETE (Jan 2026)
**Spec**: `STRATEGIC_ANALYSIS.md` (Forum-Validated)
**Branch**: `feature/multi-family-ev` → Merged to `main`

Captures highest-pain, highest-WTP segment validated via Mike Holt Forums & Electrician Talk.
Contractors turning down $10K-50K jobs due to complexity - we automate the $2-10K engineering calculation.

| Feature | NEC Reference | Status | Files |
|---------|---------------|--------|-------|
| **Multi-Family EV Calculator** | 220.84 + 220.57 + 625.42 | ✅ Complete | `services/calculations/multiFamilyEV.ts` |
| **Calculator UI Component** | - | ✅ Complete | `components/MultiFamilyEVCalculator.tsx` |
| **Tools Hub Integration** | - | ✅ Complete | `components/Calculators.tsx` |
| **PDF Export (Standalone)** | - | ✅ Complete | `services/pdfExport/MultiFamilyEVDocuments.tsx` |
| **Permit Packet Integration** | - | ✅ Complete | `components/PermitPacketGenerator.tsx` |

**Key Features Delivered:**
- NEC 220.84 multi-family demand factors (23-45% based on unit count)
- NEC 220.57 per-EVSE load calculation (max of 7,200 VA or nameplate)
- NEC 625.42 EVEMS right-sizing (size to setpoint, not full connected load)
- Building service upgrade recommendation (none/panel-only/full-service)
- EV capacity scenarios comparison (with/without EVEMS)
- 3-page professional PDF export for city permit submittals
- Integrated into Permit Packet Generator for complete packages

**⏳ PREREQUISITE: Multi-Family Dwelling Calculator (18-25 hours)**
Current Dwelling Load Calculator only supports single-family (NEC 220.82).
Multi-family support (NEC 220.84) required before auto-generation:
- NEC 220.84 calculation engine (8-10h)
- Unit count & load aggregation (4-6h)
- Load category breakdown (2-3h)
- Multi-family PDF reports (4-6h)

**Future: Auto-Generation Roadmap (30-40 hours)**
See `STRATEGIC_ANALYSIS.md` for detailed breakdown:
- Multi-family circuit auto-gen (8-12h)
- EVEMS circuit templates (4-6h)
- Unit feeder auto-sizing (3-4h)
- Database schema updates (2-3h)

### ✅ Phase 2.6: Enhanced AI Chatbot - COMPLETE (Jan 2026)
**Spec**: `/docs/ENHANCED_AI_CHATBOT_SPEC.md`

Transformed NEC Assistant from stateless Q&A to intelligent copilot with memory and actions.

| Feature | Status | Effort | Impact |
|---------|--------|--------|--------|
| **Conversation Memory** | ✅ Complete | 4h | High - Multi-turn conversations |
| **Agentic Actions** | ✅ Complete | 35h | Very High - Execute calculations via chat |
| **Streaming Responses** | ⏳ Pending | 4h | Medium - Faster perceived response |
| **Core NEC Tables RAG** | ⏳ Pending | 20h | High - Accurate table lookups |
| **Full NEC RAG** | ⏳ Pending | 60h | Very High - Complete knowledge base |

**Phase 2.6.1: Conversation Memory** ✅ COMPLETE
- `hooks/useChat.ts` - Full chat state management
- `services/ai/conversationBuilder.ts` - Context builder with token limits
- Multi-turn conversation support (10 messages default)
- Project context integration on first message

**Phase 2.6.2: Agentic Actions** ✅ COMPLETE
- `services/ai/chatTools.ts` - 12 tools defined (1900+ lines)
- Read tools: voltage drop, panel capacity, conductor sizing, service upgrade, inspection, project summary
- Action tools: add_circuit, add_panel, fill_panel_with_test_loads, empty_panel, fill_with_spares
- Agent tools: analyze_change_impact, draft_rfi, predict_inspection
- Confirmation flow for write operations

**Phase 2.6.3: Streaming Responses** (Future)
- Server-sent events for progressive response display
- Improved perceived latency

**Phase 2.6.4: RAG Integration** (Future)
- pgvector embeddings for NEC tables
- Semantic search for relevant articles
- Multi-edition support (2020, 2023, 2026)

### 🔮 Phase 3: Design Copilot (Future)
AI-powered auto-design: "Design 15,000 sq ft medical office with X-ray room" → Complete electrical design
- Building type classifier
- Load schedule generator
- Panel layout optimizer
**Estimate**: 40-50 hours | **Impact**: Revolutionary

### 🌞 Phase 4: Solar + Storage Expansion (Future)
- Battery energy storage (NEC 706)
- Hybrid inverter configuration
- Net metering calculations

---

## Architecture Overview

### State Management
- **Database-first**: Supabase PostgreSQL with real-time subscriptions
- **Custom hooks**: `useProjects`, `usePanels`, `useCircuits`, etc.
- **Optimistic updates**: UI updates immediately, DB syncs async
- **Real-time sync**: Changes propagate across browser tabs

### TypeScript Type System
- **Frontend types**: `types.ts` (enums, core models)
- **Database types**: Auto-generated in `lib/database.types.ts`

### Component Organization
- Feature-based components (self-contained)
- Custom hooks for data fetching/mutation
- Path alias `@/` maps to project root

### AI Integration - Dual System Architecture

**System 1: Gemini Q&A** (Supabase Edge Functions)
- **Purpose**: Instant conversational responses
- **Backend**: Supabase Edge Function (Deno TypeScript)
- **Model**: `gemini-2.0-flash-exp`
- **Features**: NEC Q&A, load calc validation, grounding validation, inspection checklists
- **Characteristics**: Instant, free-form text output, no DB storage

**System 2: Pydantic AI Agents** (Python FastAPI)
- **Purpose**: Complex analysis with human-in-the-loop approval
- **Backend**: Python FastAPI with Pydantic AI framework
- **Model**: `gemini-2.0-flash-exp` with structured outputs
- **Agents**: Change Impact Analyzer, RFI Drafter, Photo Analyzer, Predictive Inspector
- **Characteristics**: Async workflow, structured outputs, DB storage, sidebar notifications

**See**: `/docs/AI_AGENT_ARCHITECTURE.md` for complete documentation

---

## NEC Compliance Calculations ✅ PRODUCTION-READY

### Implemented Features

| Feature | NEC Reference | Status |
|---------|---------------|--------|
| Load Calculations | 220.82, 220.84 | ✅ Complete |
| Conductor Sizing | 310.16, Table 310.16 | ✅ Complete |
| Voltage Drop | Chapter 9, Table 9 | ✅ Complete |
| Demand Factors | 220.42, 220.44, 220.55 | ✅ Complete |
| Feeder Sizing | Article 215 | ✅ Complete |
| EGC Sizing | 250.122 | ✅ Complete |
| Grounding System | Article 250 | ✅ Complete |
| EV Charging | Article 625 | ✅ Complete |
| Solar PV | Article 690 | ✅ Complete |
| Residential (SF) | 220.82 | ✅ Complete |
| Residential (MF) | 220.84 | ✅ Complete |
| Short Circuit Analysis | NEC 110.9, IEEE 141 | ✅ Complete |
| EVEMS Load Management | NEC 625.42 | ✅ Complete |
| Service Upgrade Analysis | NEC 220.87, 230.42 | ✅ Complete |
| Arc Flash Analysis | NFPA 70E | ✅ Complete |
| Multi-Family EV Analysis | NEC 220.84 + 220.57 + 625.42 | ✅ Complete |

### Planned Features

| Feature | NEC Reference | Priority |
|---------|---------------|----------|
| Selective Coordination | 700.27, 701.27 | Medium |
| Motor Starting | Article 430 | Medium |
| Harmonic Analysis | - | Low |

---

## Database Architecture

### Core Tables
- `profiles` - User profile data
- `projects` - Project metadata with service parameters
- `panels` - Electrical panels with hierarchy
- `transformers` - Voltage transformation equipment
- `circuits` - Branch circuits assigned to panels
- `loads` - Load entries for NEC calculations
- `feeders` - Feeder cables between panels
- `short_circuit_calculations` - SCC results tracking
- `grounding_details` - Grounding system design data

### Project Management Tables
- `rfis` - Request for Information tracking
- `site_visits` - Site visit logging with photos
- `calendar_events` - Important dates/deadlines
- `project_photos` - Photo storage with Vision AI analysis
- `issues` - Project issues tracking

### Inspector & Compliance Tables
- `inspection_items` - Inspection checklist items
- `inspector_reports` - Inspector mode reports

### AI Agent Tables (Pydantic AI System)
- `agent_actions` - Queue of AI suggestions (pending/approved/rejected)
- `agent_analysis_cache` - 24-hour cache (90% cost savings)
- `agent_activity_log` - Audit trail

### Billing Tables
- `subscriptions` - User subscription/billing data

### Panel Hierarchy
```sql
projects → panels (1:many)
panels → circuits (1:many)
transformers → panels (1:many)
panels → panels (self-referential via fed_from)
```

**Discriminated Union Pattern**:
- `fed_from_type`: 'service' | 'panel' | 'transformer'
- `fed_from`: UUID of parent panel
- `fed_from_transformer_id`: UUID of transformer

---

## Development Patterns

### Adding New Calculations
1. Add types to `types.ts`
2. Create service in `/services/calculations/`
3. Create component in `/components/`
4. Add route in `App.tsx`
5. Add navigation in `Layout.tsx`
6. Reference NEC articles in comments

### Adding AI Features

**For System 1 (Quick Q&A - Supabase Edge Functions)**:
1. Add function to `services/geminiService.ts`
2. Use `NEC_SYSTEM_INSTRUCTION` for consistency
3. Set `model: "gemini-2.0-flash-exp"`
4. Call via `callGeminiProxy(prompt, systemInstruction?)`

**For System 2 (Complex Analysis - Pydantic AI Agents)**:
1. Create agent in `/backend/agents/your_agent.py`
2. Define Pydantic output model in `/backend/models/schemas.py`
3. Add database tools in `/backend/tools/database.py`
4. Create API endpoint in `/backend/routes/agent_actions.py`
5. Add frontend function in `/services/api/pythonBackend.ts`
6. Results appear in AI Copilot sidebar with approve/reject workflow

**Decision Guide**: Use System 1 for instant answers, System 2 for planning & approval workflows

### Modifying Database Schema
1. Create migration file in `/supabase/migrations/`
2. Run migration in Supabase SQL Editor
3. Update `lib/database.types.ts`
4. Update affected hooks
5. Update components

---

## Recent Changes

### 2026-01-31: Multi-Family EV Bug Fixes & Merge ✅
**Status**: Complete
**Branch**: `feature/multi-family-ev` → Merged to `main`

**Critical EVEMS Bug Fixes:**
- Bug #1: EVEMS showed fewer max chargers than direct connection (backwards!)
  - Added `directAlreadySufficient` check
  - Fixed missing variable references (`canAccommodateAllWithEVEMS`, `maxChargersWithEVEMS`)
- Bug #2: kW per charger exceeded physical charger limits (showed 11.4 kW for 32A @ 240V = 7.68 kW max)
  - Added cap at charger's physical maximum: `Math.min(perEVSEMaxKW, theoreticalKWPerCharger)`

**UI Cleanup:**
- Removed Cost Comparison card from calculator (per user request)
- Cleaned up unused imports

**Commits:** `97ef322`, `5ed2640`, `4578565`, `68da43a`

**Files Modified:**
- `services/calculations/multiFamilyEV.ts` - EVEMS calculation fixes
- `components/MultiFamilyEVCalculator.tsx` - Removed Cost Comparison card

---

### 2026-01-21: Multi-Family EV Calculator (Phase 2.5) ✅
**Status**: Complete
**Branch**: `feature/multi-family-ev`

**New Features:**
- Multi-Family EV Readiness Calculator implementing NEC 220.84 + 220.57 + 625.42
- Building profile inputs (dwelling units, sq ft, common areas)
- EV charger configuration (Level 1/2, amps, chargers per unit)
- Itemized common area loads with NEC demand factors (220.42, 220.44, 620.14, 430.24)
- Building demand analysis with tiered demand factors
- EV capacity scenarios (with/without EVEMS load management)
- Service upgrade recommendation (none/panel-only/full-service)
- 3-page professional PDF export for city permits
- Integrated into Permit Packet Generator

**Files Created:**
- `services/calculations/multiFamilyEV.ts` (1400+ lines - calculation engine)
- `components/MultiFamilyEVCalculator.tsx` (~1100 lines - UI component)
- `services/pdfExport/MultiFamilyEVDocuments.tsx` (692 lines - PDF document)
- `services/pdfExport/multiFamilyEVPDF.tsx` (84 lines - export service)
- `docs/MULTI_FAMILY_EV_SPEC.md` (documentation)

**Files Modified:**
- `components/Calculators.tsx` - Added Multi-Family EV tab
- `components/PermitPacketGenerator.tsx` - Added MF EV section toggle
- `services/pdfExport/permitPacketGenerator.tsx` - Added MF EV document integration
- `STRATEGIC_ANALYSIS.md` - Added auto-generation roadmap
- `CLAUDE.md` - Updated Phase 2.5 status

---

### 2026-01-15: Feeder Sizing Bugs & UI Improvements ✅
**Status**: Complete
**Commit**: `8f80285`

**Bug Fixes**:
- Fixed transformer source → panel destination dropdown (now correctly enabled)
- Added `getValidPanelDestinationsFromTransformer()` for connectivity validation
- Moved continuous load % slider to load-based sizing only (NEC 215.2(A)(1) compliance)
- Fixed transformer destination load aggregation from secondary side panels

**UI Improvements**:
- Compact feeder and short circuit cards (50% height reduction)
- Cross-component feeder refresh via custom events in `useFeeders.ts`

**PDF Export Fixes**:
- Fixed type imports in `voltageDropPDF.tsx` and `VoltageDropDocuments.tsx`
- Corrected field name `conductor_size` → `phase_conductor_size`

**Files Modified**:
- `components/FeederManager.tsx`
- `components/ShortCircuitResults.tsx`
- `hooks/useFeeders.ts`
- `services/pdfExport/voltageDropPDF.tsx`
- `services/pdfExport/VoltageDropDocuments.tsx`
- `services/validation/panelConnectivityValidation.ts`

---

### 2026-01-12: AI Chatbot Enhancement & Tools ✅
**Status**: Complete - NEC Copilot with action tools

**New Action Tools**:
- `add_circuit`, `add_panel`, `fill_panel_with_test_loads`, `empty_panel`, `fill_with_spares`

**Read/Check Tools**:
- `get_project_summary`, `check_panel_capacity`, `calculate_feeder_voltage_drop`
- `check_conductor_sizing`, `check_service_upgrade`, `run_quick_inspection`

**Files Modified**:
- `components/Layout.tsx` - Removed AICopilotSidebar
- `services/ai/chatTools.ts` - All action tools
- `docs/AI_CHATBOT_TOOLS.md` - Tool documentation

---

### 2025-12-30: UI/UX Improvements - Issues #24-27 ✅
**Status**: Complete - All ISSUES.md items resolved
**Branch**: `feature/agentic-pm-system`

#### Issue #24: One-Line Diagram Separation ✅
- Added `diagramOnly` prop to OneLineDiagram component
- "One-Line Diagram" menu shows only diagram (enlarged, full-width)
- "Circuit Design" page shows full layout (forms + diagram)

#### Issue #25: Inline Circuit Addition in Panel Schedules ✅
- Removed "Add Circuit" utility from Circuit Design page
- Added inline "+ Add Circuit" row in panel schedule table
- Full form with circuit #, description, load, type, breaker, poles, wire
- Comprehensive slot validation:
  - Checks occupied slots from existing circuits
  - Validates multi-pole circuit expansions (2P, 3P)
  - Manual circuit number assignment
  - Real-time conflict detection with visual feedback (red border when invalid)
  - Auto-recalculation on pole changes

#### Issue #26: Circuit Design Layout Improvements ✅
- Changed from 3-column to 2-column layout (320px sidebar + 1fr diagram)
- Made diagram sticky (`lg:sticky lg:top-4`) - stays visible while scrolling
- Increased diagram height to `calc(100vh-12rem)`
- Left sidebar scrolls independently with `lg:overflow-y-auto`
- **Result**: No white space, reduced scrolling

#### Issue #27: Site Visit Status Management + Calendar Integration ✅
- **Status Management**: Replaced static badge with dropdown selector
  - Can change status: Scheduled ↔ In Progress ↔ Completed ↔ Cancelled
  - Works on existing site visits (not just new ones)
- **Calendar Integration**: Automatic sync
  - When status = "Scheduled" → Creates calendar event
  - When status changes away from "Scheduled" → Removes calendar event
  - Uses `related_site_visit_id` to link them
  - Works for both new and existing site visits

**No database migrations needed** - all features use existing schema!

---

### 2025-12-26: Python AI Backend Deployed to Production ✅
**Status**: Complete - All 4 AI agents live on Railway
**Deployment URL**: https://neccompliance-production.up.railway.app

**Accomplishments**:
- ✅ Python FastAPI backend deployed to Railway
- ✅ Pydantic AI agents operational (4 agents working)
- ✅ Supabase integration configured (service role + RLS)
- ✅ Gemini AI 2.0 connected
- ✅ Real-time WebSocket subscriptions enabled
- ✅ Security fixes (removed .env from git, proper .gitignore)
- ✅ Repository pushed to GitHub: `augustov58/nec_compliance`

**See**: `/backend/DEPLOYMENT.md` for complete deployment guide

---

### 2025-12-20: Agentic PM System - Phase 0 Foundation ✅
**Status**: Complete - Basic PM features implemented

**Completed**:
- RFI Tracking with AI PDF extraction (Gemini Vision)
- Site Visit Logging with drag-and-drop photo upload
- Open Items Dashboard (cross-project aggregation)
- Calendar/Timeline with events, deadlines, meetings

**Key Features**:
- Real-time synchronization across all features
- User-scoped RLS policies for data isolation
- Optimistic UI updates for instant feedback

**See**: `/docs/PHASE_0_COMPLETION.md` for complete details

---

### 2025-12-17: Service Upgrade Wizard - NEC 220.87 Compliant ✅
**Status**: Production-ready with full NEC 220.87 compliance

**Critical Compliance Fix**: Added 125% multiplier for calculated/manual loads per NEC 220.87
- Four determination methods: Utility Bill, Load Study, Calculated, Manual
- Only Utility Bill and Load Study (actual measurements) skip 125% multiplier
- Prevents dangerous undersizing of electrical services

**Features**:
- Quick Check mode for field use
- Panel schedule integration (auto-populate from project)
- Color-coded utilization gauge
- 25+ load templates (EV chargers, HVAC, appliances)

**Location**: `/project/:id/tools` → Service Upgrade tab

---

### 2025-12-16: Short Circuit Calculator - Professional Grade ✅
**Status**: Production-ready with calculation tracking and PDF export

**Major Enhancements**:
1. Service conductor parameters (real-world distance modeling)
2. Critical bug fix: 3-phase impedance multiplier (was 40% underestimated)
3. Calculation tracking system with results viewer
4. PDF export (single calculation or full system report)
5. Engineering accuracy per IEEE 141 (Red Book)

**Features**:
- Service entrance calculation (transformer secondary fault current)
- Downstream panel calculation (point-to-point)
- Parallel conductor support (2-4 sets for 400A+ services)
- NEC 110.9 compliance with standard AIC ratings

**Location**: `/project/:id/tools` → Short Circuit calculator

---

## Build Status

- **Build**: ✅ Successful
- **Tests**: ✅ 11/11 passing (100%)
- **Security**: ✅ API keys protected
- **Database**: ✅ Supabase with RLS
- **Backend**: ✅ Python FastAPI deployed to Railway

---

## Key Technical Notes

### NEC 220.87 Compliance (Service Upgrade Wizard)
**CRITICAL**: When sizing service upgrades, NEC 220.87 requires:
- **Actual measurements** (12-month utility billing, 30-day load study): Use measured value directly (NO 125% multiplier)
- **Calculated loads** (panel schedule calculation, manual entry): Apply 125% multiplier to existing load

The 125% multiplier prevents dangerous undersizing. Implementation in `services/calculations/serviceUpgrade.ts`.

### Short Circuit Analysis Accuracy
**CRITICAL**: 3-phase impedance calculation:
- Per-phase impedance multiplier is **1×** (not 1.732×)
- Incorrect multiplier results in 40-50% underestimation of fault currents
- Safety-critical calculation per NEC 110.9 and IEEE 141

Implementation in `services/calculations/shortCircuit.ts` with service conductor modeling.

### Circuit Slot Validation (Panel Schedules)
**Implementation**: Multi-pole circuit slot tracking:
- 1-pole circuit: occupies 1 slot (e.g., slot 1)
- 2-pole circuit: occupies 2 slots (e.g., slots 1 and 3)
- 3-pole circuit: occupies 3 slots (e.g., slots 1, 3, and 5)
- Formula: `baseSlot + (i × 2)` for each pole

Functions in `components/PanelSchedule.tsx`:
- `getOccupiedSlots()` - Tracks ALL occupied slots including multi-pole expansions
- `isCircuitSlotAvailable(circuitNumber, pole)` - Validates placement safety
- `handlePoleChange(newPole)` - Recalculates on pole selector change

---

## Important Files

### Configuration
- `vite.config.ts` - Build config with path aliases
- `.env.local` - Frontend environment variables
- `/backend/.env` - Python backend environment (NOT in git)

### Core Services
- `/services/calculations/` - NEC calculation engines
- `/services/geminiService.ts` - System 1 AI (Gemini Q&A)
- `/services/api/pythonBackend.ts` - System 2 AI (Pydantic agents)

### Database
- `/supabase/migrations/` - SQL migration files
- `/lib/database.types.ts` - Auto-generated TypeScript types

### Backend (Python)
- `/backend/agents/` - 4 Pydantic AI agents
- `/backend/models/schemas.py` - Pydantic output models
- `/backend/routes/` - FastAPI endpoints
- `/backend/DEPLOYMENT.md` - Railway deployment guide

---

## Contact & Resources

- **GitHub**: `augustov58/nec_compliance`
- **Backend**: https://neccompliance-production.up.railway.app
- **Issues**: Track in `ISSUES.md`
- **Strategic Planning**: See `STRATEGIC_ANALYSIS.md`

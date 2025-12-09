# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🔄 ACTIVE SESSION LOG

**⚠️ CHECK FIRST**: Before starting work, read `/docs/SESSION_LOG.md` for:
- Current session status and in-progress work
- Recent changes made by previous Claude instances
- Pending tasks and context from last session

**Current Branch**: `cursor-features`
**Last Session**: 2025-12-07 (Strategic Analysis Complete)

---

## 🎯 STRATEGIC POSITIONING

### The Opportunity
NEC Pro Compliance sits at a unique intersection: **deep NEC compliance expertise + modern SaaS architecture + AI integration capability**. The electrical design software market has a massive gap:

| Market Segment | Price Range | Our Position |
|----------------|-------------|--------------|
| Enterprise (ETAP, SKM, EasyPower) | $15,000-$50,000/year | Too expensive, too complex |
| Mid-Market (Design Master) | $1,000-$2,000/year | AutoCAD dependency |
| **"Missing Middle" (NEC Pro)** | **$50-$300/month** | **Web-based, AI-powered, NEC-focused** |
| Budget (Mike Holt, mobile apps) | $0-$50 | No project management |

### Competitive Advantages

| Advantage | Why It Matters |
|-----------|----------------|
| **NEC Domain Expertise in Code** | Calculation engines follow NEC articles precisely (220.42, 220.44, 250.122, etc.) |
| **Modern Architecture** | Real-time sync, optimistic UI, cloud-native (competitors are 20-year-old desktop apps) |
| **AI-Ready Infrastructure** | Gemini integration working; expandable to revolutionary features |
| **Residential + Commercial** | Most tools focus on one; we serve both |
| **Professional-Grade Output** | Panel schedules, one-line diagrams, PDF exports |

### Target Niches (Priority Order)
1. **EV Charging Installers** - 50,000+ installers, growing 30%/year, poor existing tools
2. **Solar + Storage Integrators** - 15,000+ companies, NEC 690/706 complexity
3. **Multi-Family Developers** - High-value projects, NEC 220.84 expertise rare
4. **Healthcare Facilities** - NEC 517 complexity, high price tolerance
5. **Data Centers** - Explosive growth, redundancy calculations

**Strategic Document**: See `STRATEGIC_ANALYSIS.md` for complete market analysis (696 lines)

---

## ✅ SECURITY STATUS: PRODUCTION-READY

**Status**: ✅ **SECURE** - Gemini API properly protected via backend proxy
**Architecture**: Supabase Edge Functions (server-side)
**Implementation**: `/supabase/functions/gemini-proxy/index.ts`

### Security Architecture
The application uses a **secure backend proxy pattern** to protect the Gemini API key:

1. **Frontend (`services/geminiService.ts`)**:
   - No API keys in code
   - All AI requests routed through `supabase.functions.invoke('gemini-proxy')`
   - Requires user authentication before calling AI features

2. **Backend (Supabase Edge Function)**:
   - Verifies user authentication (JWT token validation)
   - Retrieves API key from server environment variable (`Deno.env.get('GEMINI_API_KEY')`)
   - API key **never exposed** to client
   - Proper error handling and logging

3. **Build Configuration (`vite.config.ts`)**:
   - Clean configuration with only path aliases
   - No `define` block injecting environment variables
   - No API keys in bundle

**Result**: ✅ Production-grade security already implemented

---

## 📚 Documentation Index

### 🤖 FOR LLM TAKEOVER: START HERE FIRST
- **[LLM Handoff Prompt](/docs/HANDOFF_PROMPT.md)** - Complete reading guide for LLM taking over codebase (3-4 hours)
- **[Session Log](/docs/SESSION_LOG.md)** - Current session status and recent changes
- **[Strategic Analysis](/STRATEGIC_ANALYSIS.md)** - Market positioning, AI differentiation, roadmap

### Core Documentation
- **[Architecture Overview](/docs/architecture.md)** - State management, data flow, optimistic updates
- **[Development Guide](/docs/development-guide.md)** - Step-by-step workflows for features
- **[Database Architecture](/docs/database-architecture.md)** - Schema, RLS policies, migrations
- **[Security Guide](/docs/security.md)** - Security audit, Gemini API protection
- **[Testing Strategy](/docs/testing-strategy.md)** - Testing pyramid, examples

### Architecture Decision Records (ADRs)
- **[ADR-001](/docs/adr/001-optimistic-ui-updates.md)** - Optimistic UI Updates
- **[ADR-002](/docs/adr/002-custom-hooks-over-react-query.md)** - Custom Hooks Over React Query
- **[ADR-003](/docs/adr/003-supabase-realtime-state-management.md)** - Supabase Real-Time State
- **[ADR-004](/docs/adr/004-hashrouter-for-github-pages.md)** - HashRouter for GitHub Pages
- **[ADR-005](/docs/adr/005-panel-hierarchy-discriminated-union.md)** - Panel Hierarchy Design
- **[ADR-006](/docs/adr/006-one-line-diagram-monolith.md)** - OneLineDiagram Monolith

---

## Project Overview

NEC Pro Compliance is a professional SaaS dashboard for managing National Electrical Code (NEC) compliance projects. It helps electrical contractors and engineers design safe, compliant electrical systems through load calculations, circuit design, grounding validation, and AI-powered code assistance.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:3000)
npm run dev

# Production build
npm run build

# Run tests
npm test
```

## Environment Setup

**Frontend Environment** (`.env.local`):
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Backend Environment** (Supabase Dashboard → Edge Functions → Secrets):
```bash
GEMINI_API_KEY=your_api_key_here  # Server-side only
```

**⚠️ IMPORTANT**: The Gemini API key must be set in Supabase Edge Functions secrets, not in `.env.local`.
See `/docs/GEMINI_API_SETUP.md` for complete setup instructions.

---

## 🚀 STRATEGIC ROADMAP

### Phase 1: AI Killer Features (Months 1-3)
*Goal: Differentiate with AI capabilities competitors can't match*

| Priority | Feature | Impact | Status |
|----------|---------|--------|--------|
| 🥇 | **Inspector Mode AI** - Pre-inspection audit | Game changer - reduces failed inspections | ✅ **COMPLETE** |
| 🥇 | **Enhanced NEC Assistant** - Context-aware | Builds on existing Gemini integration | ✅ **COMPLETE** |
| 🥈 | **Permit Packet Generator** | Time-saver, justifies subscription | ✅ **COMPLETE** |
| 🥈 | **Arc Flash Calculator** | Professional credibility | ✅ **COMPLETE** |

### Phase 2: EV Niche Domination (Months 4-6)
*Goal: Own the EV charging installer market*

| Feature | NEC Reference | Why | Status |
|---------|---------------|-----|--------|
| Load Management Calculator (EVEMS) | NEC 625.42 | Core EV installer need | ✅ **COMPLETE** |
| Service Upgrade Wizard | Article 220 | Common EV requirement | 🔄 In Progress |
| Utility Interconnection Forms | Varies | Paperwork automation | ⏳ Pending |
| EV-specific panel templates | - | Quick-start designs | ⏳ Pending |

### Phase 3: Design Copilot (Months 7-9)
*Goal: AI-powered auto-design for massive differentiation*

```
User: "I'm designing electrical for a 2-story medical office, 
       15,000 sq ft, includes X-ray room and surgery suite."

AI: "Based on NEC Article 517 (Healthcare Facilities), I've generated:
     - 400A 208V 3Φ service (NEC 220.14 load calculation attached)
     - Dedicated X-ray branch circuit (NEC 517.74)
     - Essential electrical system with transfer switch
     
     [View Generated One-Line Diagram] [Edit Design]"
```

### Phase 4: Solar + Storage Expansion (Months 10-12)
- Battery energy storage (NEC 706)
- Hybrid inverter configuration
- Net metering calculations
- Utility interconnection forms

### Back Burner: Future Enhancements
*Features to consider after core roadmap is complete*

| Feature | Priority | Why |
|---------|----------|-----|
| **Conversation Memory for AI Assistant** | Low | Add persistent chat history so AI can reference previous questions. Requires: database table for messages, conversation context in prompts, per-project chat history. Currently each question is standalone. |
| **Multi-language Support** | Low | Expand to Spanish-speaking markets (large electrical contractor base) |
| **Mobile App** | Medium | Native iOS/Android apps for field use |
| **CAD Integration** | Medium | Export to AutoCAD/Revit for design firms |

---

## 💰 PRICING STRATEGY

| Tier | Price | Features | Target |
|------|-------|----------|--------|
| **Free** | $0 | NEC lookup, basic calculators, 3 projects | Lead generation |
| **Starter** | $49/mo | All calculators, 10 projects, PDF export | Solo electricians |
| **Professional** | $149/mo | Unlimited projects, Inspector Mode AI, Design Copilot (limited) | Small firms |
| **Business** | $299/mo | Team collaboration, unlimited AI, API access | Engineering firms |
| **Enterprise** | Custom | SSO, dedicated support, on-premise | Large contractors |

**Path to $1M ARR:**
- 200 Professional ($149) = $357,600
- 100 Business ($299) = $358,800
- 500 Starter ($49) = $294,000
- **Total: $1,010,400 ARR** (achievable in 18-24 months)

---

## 🤖 AI DIFFERENTIATION OPPORTUNITIES

### Why AI is Our "Nuclear Option"
**Incumbents (ETAP, SKM, EasyPower) cannot easily add AI because:**
1. 20+ year old codebases (C++/VB6/Delphi)
2. Desktop-first, no cloud infrastructure
3. Business model depends on expensive training/consulting
4. AI threatens their professional services revenue

**We can leapfrog them because:**
1. Modern tech stack (React, Supabase, TypeScript)
2. Cloud-native, AI-ready infrastructure
3. Gemini integration already working
4. No legacy revenue to protect

### Top AI Features to Build

#### 1. Inspector Mode (PRIORITY)
Pre-inspection AI audit that flags issues before the inspector sees them:
```
⚠️ ISSUES FOUND (3):
1. Panel H2 has 42 circuits on 225A main - NEC 408.36 requires 
   maximum 42 poles (at limit, recommend 400A panel)
2. EGC in Feeder F3 is undersized - Per 250.122, 100A OCPD 
   requires #8 Cu minimum (you have #10)
3. Receptacle circuit R-12 exceeds 180VA per outlet assumption

✅ PASSED (47 checks)
```

#### 2. Voice-to-Design
Dictate circuit additions while walking a job site:
```
User (voice): "Add a 20-amp receptacle circuit for the break room, 
              12 outlets, home run to panel H1."

AI: "Added Circuit 23: 20A/1P, 12 receptacles, 2,160 VA estimated 
     load, #12 Cu conductor. Panel H1 now at 87% capacity."
```

#### 3. Change Order Impact Analysis
Instantly show cascading impacts when architect adds load:
```
Change: "Add (3) 50A EV chargers to parking garage"

Impact Analysis:
• Service: Exceeds 400A capacity → Upgrade to 600A required
• Feeder F1: Needs upsizing from #2 Cu to #1/0 Cu
• Voltage Drop: Now 4.2% (was 2.8%) → Still compliant
• Cost Impact: +$8,500 estimated material + labor
```

---

## Architecture Overview

### State Management Strategy
- **Database-first architecture**: Supabase PostgreSQL with real-time subscriptions
- **Custom hooks pattern**: Data fetching via `useProjects`, `usePanels`, `useCircuits`, etc.
- **Optimistic updates**: UI updates immediately, database syncs asynchronously
- **Real-time sync**: Changes propagate across browser tabs via Supabase subscriptions

### TypeScript Type System
**Frontend types** in `types.ts`:
- **Enums**: `ProjectType` (Residential/Commercial/Industrial), `ProjectStatus`
- **Core models**: `Project`, `LoadItem`, `PanelCircuit`, `NecIssue`

**Database types** auto-generated in `lib/database.types.ts`

### Component Organization
Components are feature-based, not atomic:
- Each component is self-contained with its own state and logic
- Components use custom hooks to fetch/mutate database data
- Path alias `@/` maps to project root

### AI Integration Pattern
All AI features use `services/geminiService.ts` with secure backend proxy:
- Centralized `NEC_SYSTEM_INSTRUCTION` prompt
- 5 specialized functions: `validateLoadCalculation`, `generateOneLineDescription`, `validateGrounding`, `generateInspectionChecklist`, `askNecAssistant`
- Model: `gemini-2.0-flash-exp`

---

## NEC Compliance Calculation Logic ✅ PROFESSIONAL GRADE

### Implemented Calculations

| Feature | NEC Reference | Status |
|---------|---------------|--------|
| Load Calculations | 220.82, 220.84 | ✅ Complete with demand factors |
| Conductor Sizing | 310.16, Table 310.16 | ✅ Temperature/bundling factors |
| Voltage Drop | Chapter 9, Table 9 | ✅ AC impedance method |
| Demand Factors | 220.42, 220.44, 220.55 | ✅ Tiered calculations |
| Feeder Sizing | Article 215 | ✅ Multi-panel aggregation |
| EGC Sizing | 250.122 | ✅ Proportional upsizing |
| Grounding System | Article 250 | ✅ Electrode requirements |
| EV Charging | Article 625 | ✅ Level 2/DC fast charge |
| Solar PV | Article 690 | ✅ String sizing, inverter |
| Residential (SF) | 220.82 | ✅ Standard method |
| Residential (MF) | 220.84 | ✅ Optional method |
| Short Circuit | IEEE 1584 | 🟡 Basic |

### Missing (Planned)

| Feature | NEC Reference | Priority |
|---------|---------------|----------|
| Arc Flash Analysis | NFPA 70E | High |
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

### Panel Hierarchy System
```sql
projects → panels (1:many)
panels → circuits (1:many)
transformers → panels (1:many)
panels → panels (self-referential via fed_from)
```

**Discriminated Union Pattern:**
- `fed_from_type`: 'service' | 'panel' | 'transformer'
- `fed_from`: UUID of parent panel
- `fed_from_transformer_id`: UUID of transformer

---

## Development Patterns

### Adding New Calculations
1. Add types to `types.ts` if needed
2. Create service in `/services/calculations/`
3. Create component in `/components/`
4. Add route in `App.tsx`
5. Add navigation in `Layout.tsx`
6. Reference NEC articles in comments

### Adding AI Features
1. Add function to `geminiService.ts`
2. Use `NEC_SYSTEM_INSTRUCTION` for consistency
3. Set `model: "gemini-2.0-flash-exp"`
4. Handle errors gracefully
5. Consider project context awareness

### Modifying Database Schema
1. Create migration file in `/supabase/`
2. Run migration in Supabase SQL Editor
3. Update `lib/database.types.ts`
4. Update affected hooks
5. Update components

---

## ✅ Current Status (December 7, 2025)

### Production Ready
- **Build**: ✅ Successful (2,281 kB)
- **Tests**: ✅ 11/11 passing (100%)
- **Security**: ✅ API keys protected
- **Database**: ✅ Supabase with RLS

### Core Features Complete
- ✅ Load calculations (NEC 220)
- ✅ Conductor sizing (NEC 310)
- ✅ Feeder sizing (NEC 215)
- ✅ EGC sizing (NEC 250.122)
- ✅ Panel schedules with PDF export
- ✅ One-line diagrams with export
- ✅ Residential workflows (220.82, 220.84)
- ✅ EV charging calculator (625)
- ✅ Solar PV calculator (690)
- ✅ AI NEC assistant

### ✅ Inspector Mode AI - IMPLEMENTED
Pre-inspection audit feature that flags NEC violations before inspector review.
**Location**: `/project/:id/inspector`
**Service**: `services/inspection/inspectorMode.ts`

#### NEC Articles Checked:
- NEC 408.36 - Panel max poles
- NEC 408.30 - Bus loading
- NEC 240.4(D) - Conductor protection
- NEC 250.122 - EGC sizing
- NEC 210.19(A) - Voltage drop
- NEC 230.42 - Service capacity
- NEC 250.50/66 - Grounding system

### ✅ Enhanced NEC Assistant (Context-Aware) - IMPLEMENTED
The AI assistant now understands the user's current project and can answer questions about specific panels, circuits, and feeders.

**Features:**
- Auto-detects project context from URL
- Fetches project data (panels, circuits, feeders, transformers)
- Answers project-specific questions:
  - "Can I use #10 wire for the AC unit on panel H1?" → Checks YOUR panel H1
  - "Is my service sized correctly?" → Analyzes YOUR calculated load
  - "What size breaker for circuit 5?" → Looks up YOUR circuit 5
  - "Describe my riser diagram" → Uses YOUR actual panel hierarchy
- Shows "Project Context" badge when context is available
- Falls back to general NEC knowledge when not in project

**Context Improvements:**
- Includes complete panel hierarchy (which panel feeds which)
- Visual hierarchy tree showing power flow
- Correct load values per panel
- Panel relationships (fedFrom, downstreamPanels, downstreamTransformers)
- AI can now accurately describe riser diagrams and answer project-specific questions

**Location**: Floating chat widget (bottom-right), available globally
**Service**: `services/ai/projectContextBuilder.ts` + `services/geminiService.ts`

### Next Priority: Permit Packet Generator
Auto-generate complete permit application packages to save contractors 30-60 min per permit.

---

## Recent Changes

### 2025-12-07: Strategic Analysis Complete
- Created comprehensive `STRATEGIC_ANALYSIS.md` (696 lines)
- Market gap analysis identifying "missing middle" opportunity
- AI differentiation opportunities ranked by impact × feasibility
- 12-month feature roadmap with EV niche focus
- Pricing strategy ($49-$299/mo tiers)
- Go-to-market playbook
- Updated CLAUDE.md with strategic context

### 2025-12-05: Residential Workflow Complete
- Fixed Issue #17: Residential system validation (3P circuits blocked)
- Fixed Issue #18: MDP editing enabled
- Fixed Issue #19: Dashboard project deletion optimistic update
- Fixed Issue #20-21: Dwelling calculator panel schedule fixes

### 2025-12-04: Session Documentation System
- Created `/docs/SESSION_LOG.md` for Claude instance handoff
- Created `/docs/HANDOFF_PROMPT.md` for onboarding new Claude instances
- Established session documentation pattern

**See**: `/docs/SESSION_LOG.md` for complete session history

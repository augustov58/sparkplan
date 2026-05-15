# SparkPlan — Project Specification

**Last Updated:** March 31, 2026
**Domain:** [sparkplan.app](https://sparkplan.app)
**Repository:** augustov58/nec_compliance

---

## 1. Product Overview

**SparkPlan** is a SaaS dashboard for electrical contractors — a modern alternative to legacy tools like ETAP and SKM ($15-50K/yr). It provides NEC-compliant calculations, one-line diagrams, panel schedules, permit packet generation, and AI-powered code analysis, all at $29-149/mo.

### Target Users
- **Primary:** Residential and commercial electrical contractors doing EV charger installations
- **Secondary:** Electrical engineers, plan reviewers, and apprentices studying for licensing exams
- **Niche focus:** Multi-family EV readiness (NEC 220.84 + 220.57 + 625.42) — an underserved market where contractors are turning down $10K-50K jobs for lack of calculation tools

### Current Status
- **Phase:** 2.8 complete (User Profiles & Settings) — product is commercially ready
- **Next milestone:** First paying customer (target: March 2026)
- **Stack:** React + TypeScript + Supabase + Gemini AI + Python FastAPI

---

## 2. Feature Inventory

### 2.1 Core Calculators

17 pure-function calculation engines in `services/calculations/`. All return `necReferences[]`, `warnings[]`, and itemized breakdowns. None throw on bad input — they return results with warnings.

| Calculator | File | Key NEC References |
|------------|------|--------------------|
| Residential Load | `residentialLoad.ts` | 220.82, 220.83, 220.84 |
| Commercial Load | `commercialLoad.ts` | 220.12, 220.42, 220.44, 220.56 |
| Load Calculation | `loadCalculation.ts` | 220, demand factors, continuous loads |
| Multi-Family EV | `multiFamilyEV.ts` | 220.84, 220.57, 625.42 |
| Service Upgrade | `serviceUpgrade.ts` | 220.87 (125% calc vs. measured) |
| Short Circuit | `shortCircuit.ts` | 110.9, IEEE 141 |
| Arc Flash | `arcFlash.ts` | 110.16, NFPA 70E 130 |
| Voltage Drop | `voltageDrop.ts` | 210.19, Chapter 9 Table 9 |
| Conductor Sizing | `conductorSizing.ts` | 310, 250.122 |
| Breaker Sizing | `breakerSizing.ts` | 240.6(A), 210.20(A), 430.52 |
| EV Charging | `evCharging.ts` | 625.40, 625.42, 625.44 |
| EVEMS Load Management | `evemsLoadManagement.ts` | 625.42, 215, 230 |
| Circuit Sharing | `circuitSharing.ts` | 625.42, 220.87, 210.23 |
| Feeder Sizing | `feederSizing.ts` | 215.2(A)(1), 215.3, 450.3(B) |
| Demand Factor Analysis | `demandFactor.ts` | 220.42, 220.44, 220.54, 220.56 |
| Solar PV | `solarPV.ts` | Article 690 |
| Upstream Load Aggregation | `upstreamLoadAggregation.ts` | Article 220 (general method) |

### 2.2 NEC Data Tables

12 typed lookup tables in `data/nec/` with fallback logic (return largest size if input exceeds range):

| Table | NEC Reference | Content |
|-------|---------------|---------|
| `table-310-16.ts` | Table 310.16 | Conductor ampacity by size/material/temperature |
| `table-310-15-b1.ts` | 310.15(B)(1) | Ampacity derating for bundled conductors |
| `table-310-15-c1.ts` | 310.15(C)(1) | Temperature correction factors (60/75/90°C) |
| `table-250-122.ts` | 250.122 | EGC sizing (14 AWG - 1000 kcmil, Cu + Al) |
| `table-220-42.ts` | 220.42 | Lighting demand factors by occupancy |
| `table-220-55.ts` | 220.55 | Range demand factors |
| `standard-breakers.ts` | 240.6(A) | Standard breaker sizes (15A - 6000A) |
| `chapter9-table9.ts` | Chapter 9 Table 9 | AC impedance (R + jX) for voltage drop — Cu/Al, steel/non-magnetic |
| `chapter9-conductor-dimensions.ts` | Chapter 9 Table 5 | Conductor dimensions for conduit fill — 5 wire types (THHN, THW, XHHW, RHW-2, USE-2), Cu + Al |
| `chapter9-conduit-dimensions.ts` | Chapter 9 Table 4 | Conduit/tubing areas — 5 types (EMT, PVC-40, PVC-80, RMC, IMC), 1/2" to 6" |
| `conductor-properties.ts` | — | Conductor comparison & proportional EGC upsizing |

### 2.3 Design & Layout Tools

| Feature | Route | Description |
|---------|-------|-------------|
| One-Line Diagram | `/project/:id/diagram` | Interactive SVG with panel hierarchy, transformers, feeders, meter stacks. Dual rendering: interactive + print/export. |
| Panel Schedule | `/project/:id/panel` | Circuit assignment with auto-balancing, multi-pole slot management, load summary |
| Feeder Manager | `/project/:id/feeders` | Panel-to-panel and panel-to-transformer feeder sizing per NEC 215 |
| Grounding & Bonding | `/project/:id/grounding` | Grounding electrode system design per NEC 250 |
| Circuit Design | `/project/:id/circuits` | Circuit creation with NEC-compliant conductor/breaker auto-sizing |

### 2.4 Permit Packet Generator

Route: `/project/:id/permit-packet`

Generates multi-page PDF permit packets using `@react-pdf/renderer`. Documents include:

**Tier 1 (Core):**
- Panel schedules with load summaries
- One-line diagram (PNG export)
- Load calculation worksheet
- Grounding electrode detail

**Tier 2 (Extended):**
- Short circuit analysis report
- Arc flash hazard analysis
- EV load calculation (multi-family)
- Meter stack schedule (multi-family)
- EVEMS sizing report
- Utility coordination letter
- Equipment schedule

### 2.5 Multi-Family EV Pipeline

End-to-end workflow for multi-family EV readiness projects:

1. **Multi-Family EV Calculator** (`/project/:id/tools`) — NEC 220.84 demand factors + 220.57 per-EVSE loads + 625.42 EVEMS right-sizing. Supports both calculation and measurement (NEC 220.87) paths.

2. **Auto-Generation Service** (`services/autogeneration/`) — From calculator results, automatically generates: panels, circuits, feeders, meter stacks, meters, and building/unit records.

3. **CT Cabinet** — Displayed in one-line diagram for current transformer metering.

4. **Permit Packet Integration** — Meter stack schedule and EV load analysis included in permit packet PDF.

**Example impact:** 40-unit building — 8,000A raw load reduces to 1,360A with NEC 220.84 demand factor (17%). Without EVEMS: ~25 chargers. With EVEMS power sharing: 80+ chargers possible.

### 2.6 Project Management Suite

| Feature | Route | Gate |
|---------|-------|------|
| RFI Manager | `/project/:id/rfis` | Business |
| Site Visit Logger | `/project/:id/site-visits` | Business |
| Issues / Inspection Log | `/project/:id/issues` | Business |
| Project Calendar | `/project/:id/calendar` | Business |
| Global Calendar | `/calendar` | Business |
| Material Takeoff | `/project/:id/materials` | — |

### 2.7 AI Features

#### System 1: Gemini Chatbot (Fast Q&A)
- **Tech:** Supabase Edge Functions (Deno) + Gemini 2.0 Flash
- **Interface:** Floating Spark Copilot panel with conversation memory
- **12 agentic tools:**
  - `calculate_voltage_drop` — Circuit voltage drop analysis
  - `calculate_short_circuit` — Fault current at panels
  - `check_panel_capacity` — Panel load availability
  - `run_inspection` — NEC compliance audit
  - `check_conductor_sizing` — Table 310.16 verification
  - `calculate_arc_flash` — Incident energy + PPE
  - `check_service_upgrade` — Service capacity analysis
  - `add_circuit` — New circuit creation (requires confirmation)
  - Plus 4 additional calculation tools
- **Gate:** `ai-copilot` (Business tier)

#### System 2: Python AI Agents (Complex Analysis)
- **Tech:** Python FastAPI + Pydantic AI on Railway
- **4 specialized agents:**
  1. **Change Impact Analyzer** — Service upgrade analysis, cost estimates, timeline projections
  2. **RFI Drafter** — Professional RFI generation with NEC references
  3. **Photo Analyzer** — Vision AI violation detection from job site photos
  4. **Predictive Inspector** — Inspection failure forecasting with likelihood scores
- **Workflow:** Agent generates suggestion → stored in `agent_actions` table → user approves/rejects → audit trail logged
- **Caching:** 24-hour analysis cache (90% cost savings)
- **Gates:** `ai-inspector` (Business), `pre-inspection-check` (Business)

### 2.8 User Profiles & Settings

Route: `/settings`

- Profile information (name, company, license, contact)
- Auto-fill permit packet cover pages from profile data
- Profile creation trigger on signup

---

## 3. Subscription Tiers

| Plan | Price | Projects | Key Features |
|------|-------|----------|--------------|
| **Free** | $0/mo | 3 | Voltage drop, conductor sizing, basic NEC reference |
| **Starter** | $29/mo | 10 | Load calcs, panel schedules, one-line diagrams, feeder sizing, permit packets, grounding, short circuit (basic) |
| **Pro** | $49/mo | Unlimited | Service upgrade wizard, EVEMS calculator, EV panel templates, circuit sharing, multi-family EV |
| **Business** | $149/mo | Unlimited | AI Copilot, AI Inspector, pre-inspection checklist, RFI tracking, site visits, calendar, issues log, arc flash, advanced short circuit, team (5 users), custom branding |
| **Enterprise** | Custom | Unlimited | Unlimited seats, SSO/SAML, dedicated support, custom integrations |

**Implementation:** `<FeatureGate feature="feature-name">` wraps premium components. `useSubscription().hasFeature()` checks access against `FEATURE_ACCESS` map. Stripe handles billing with free trial and promo code support.

---

## 4. NEC Compliance Coverage

### Implemented NEC Articles

| Article | Topic | Implementation |
|---------|-------|----------------|
| 110.9 | Equipment Short Circuit Ratings | `shortCircuit.ts` |
| 110.16 | Arc Flash Hazard Warning | `arcFlash.ts` |
| 210.19 | Branch Circuit Conductor Sizing | `voltageDrop.ts` |
| 210.20(A) | Branch Circuit OCPD | `breakerSizing.ts` |
| 210.23 | Permissible Loads | `circuitSharing.ts` |
| Article 215 | Feeders | `feederSizing.ts` |
| 220.12 | Lighting Load | `commercialLoad.ts` |
| 220.42 | Lighting Demand Factors | `demandFactor.ts`, `table-220-42.ts` |
| 220.44 | Receptacle Demand | `demandFactor.ts` |
| 220.54 | Dryer Demand | `demandFactor.ts` |
| 220.55 | Range Demand | `table-220-55.ts` |
| 220.56 | Kitchen Equipment Demand | `commercialLoad.ts` |
| 220.57 | EVSE Per-Unit Load | `multiFamilyEV.ts` |
| 220.82 | Standard Dwelling Calculation | `residentialLoad.ts` |
| 220.83 | Optional Dwelling Calculation | `residentialLoad.ts` |
| 220.84 | Multi-Family Optional Method | `multiFamilyEV.ts` |
| 220.87 | Existing Service Evaluation | `serviceUpgrade.ts` |
| 230.79 | Service Rating | `breakerSizing.ts` |
| 240.6(A) | Standard OCPD Sizes | `standard-breakers.ts` |
| Article 250 | Grounding & Bonding | `conductorSizing.ts`, Grounding component |
| 250.122 | EGC Sizing | `table-250-122.ts` |
| Article 310 | Conductors | `conductorSizing.ts`, `table-310-16.ts` |
| 310.15 | Ampacity Derating | `table-310-15-b1.ts`, `table-310-15-c1.ts` |
| 430.52 | Motor OCPD | `breakerSizing.ts` |
| 450.3(B) | Transformer OCPD | `feederSizing.ts` |
| Article 625 | EV Charging | `evCharging.ts` |
| 625.40 | EVSE Branch Circuit | `evCharging.ts` |
| 625.42 | EVEMS Load Management | `evemsLoadManagement.ts` |
| 625.44 | EV Conductor Sizing | `evCharging.ts` |
| Article 690 | Solar PV | `solarPV.ts` |
| Chapter 9 Table 4 | Conduit/Tubing Dimensions | `chapter9-conduit-dimensions.ts` |
| Chapter 9 Table 5 | Conductor Dimensions | `chapter9-conductor-dimensions.ts` |
| Chapter 9 Table 9 | AC Impedance | `chapter9-table9.ts` |

### IEEE / NFPA Standards
| Standard | Usage |
|----------|-------|
| IEEE 1584-2018 | Arc flash incident energy calculations |
| IEEE 141 | Short circuit analysis methodology |
| NFPA 70E 130 | Arc flash PPE categories |

---

## 5. Technical Architecture

### Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript 5.8 + Vite 6.4 |
| Styling | Tailwind v4 (brand: `electric-500` / #FFCC00) |
| Routing | HashRouter (static hosting compatible) |
| Forms | React Hook Form + Zod |
| Database | Supabase PostgreSQL 15 |
| Auth | Supabase Auth + RLS (row-level security) |
| Real-time | Supabase WebSocket subscriptions |
| AI (System 1) | Supabase Edge Functions + Gemini 2.0 Flash |
| AI (System 2) | Python FastAPI + Pydantic AI (Railway) |
| PDF | @react-pdf/renderer |
| Payments | Stripe (subscriptions, trials, promo codes) |

### Data Flow
```
User Action → React Component → Custom Hook (optimistic update)
    → Supabase DB (source of truth) → RLS filter → Real-time broadcast
    → All subscribed clients update (50-200ms)
```

### Key Patterns
- **Database-first state** — No Redux/Zustand. Supabase is the single source of truth.
- **Optimistic updates** — Instant UI, subscription corrects on mismatch.
- **Pure calculation functions** — No side effects, no DB calls. Input in, result out.
- **Lazy loading** — All heavy components use `React.lazy()` + `Suspense`.
- **Type adapters** — DB snake_case converted to frontend camelCase via `lib/typeAdapters.ts`.
- **Discriminated union** — Panel hierarchy uses `fed_from_type` to determine source.

### Performance
- Bundle: ~900 KB (257 KB gzipped)
- PDF renderer: 1.5 MB (lazy loaded)
- SVG rendering handles 50+ panels efficiently

---

## 6. Database Schema

### Core Entities

```
projects (top-level container)
├── panels (hierarchical: service → MDP → sub-panels)
│   ├── circuits (branch circuits with load data)
│   └── feeders (panel-to-panel or panel-to-transformer)
├── transformers (step-up/step-down)
├── loads (individual load entries for NEC calcs)
├── grounding_details (grounding electrode system)
├── inspection_items (pre-inspection checklist)
├── issues (code compliance tracking)
├── meter_stacks (multi-family metering)
│   └── meters (individual unit meters)
├── buildings (multi-family building records)
│   └── units (dwelling units with feeder stubs)
└── project_photos (job site photos for AI analysis)
```

### Supporting Tables
- `profiles` — User profile (1:1 with auth.users), auto-created on signup
- `subscriptions` — Stripe subscription state
- `agent_actions` — AI agent suggestion queue (pending/approved/rejected)
- `agent_analysis_cache` — 24-hour AI analysis cache
- `agent_activity_log` — AI decision audit trail

### Panel Hierarchy (Discriminated Union)
```
fed_from_type: 'service' | 'panel' | 'transformer' | 'meter_stack'
fed_from: UUID            → when type = 'panel'
fed_from_transformer_id   → when type = 'transformer'
```
MDP identified by `is_main = true`, not by `fed_from_type`.

### Security
- Row Level Security on all tables
- Policies filter by `auth.uid()` — users see only their own data
- Cascading deletes prevent orphaned records

---

## 7. Deployment

| Component | Platform | Details |
|-----------|----------|---------|
| Frontend | Vercel / Netlify | Static SPA (HashRouter), auto-deploy from `main` |
| Database | Supabase | Managed PostgreSQL 15, real-time enabled |
| Auth | Supabase Auth | Email/password, RLS enforcement |
| Edge Functions | Supabase | Deno runtime, Gemini API proxy |
| Python Backend | Railway | FastAPI, 4 AI agents, JWT auth |
| Payments | Stripe | Subscriptions, webhooks, customer portal |

### Environment Variables
- **Frontend** (`.env.local`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_*`
- **Edge Functions**: `GOOGLE_API_KEY` (Gemini)
- **Python Backend**: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `GOOGLE_API_KEY`

---

## 8. Roadmap

### Completed Phases

| Phase | Name | Status |
|-------|------|--------|
| 0 | Project Management (RFI, site visits, calendar, issues) | Done |
| 1 | AI Features (Inspector, NEC Assistant, permit packet, arc flash, short circuit) | Done |
| 2 | EV Niche (EVEMS, service upgrade wizard, EV panel templates) | Done |
| 2.5 | Multi-Family EV (NEC 220.84 + 220.57 + 625.42, measurement path) | Done |
| 2.6 | Enhanced AI Chatbot (conversation memory, 12 agentic tools, streaming) | Done |
| 2.7 | Multi-Family Population (auto-generation pipeline, meter stacks, CT cabinet, permit integration) | Done |
| 2.8 | User Profiles & Settings (auto-fill permit packets, profile triggers) | Done |

### Future Phases

**Phase 3 — Design Copilot**
AI auto-design from building description. User describes the project; AI generates panel hierarchy, circuit assignments, and feeder sizing automatically.

**Phase 4 — Solar + Storage**
NEC 706 energy storage, net metering calculations, battery sizing, hybrid solar+EV systems.

### Business Milestones

| Milestone | Target |
|-----------|--------|
| First free user | Feb 2026 |
| First paying customer | Mar 2026 |
| 10 paying customers | May 2026 |
| $5K MRR | Sep 2026 |

---

## 9. Market Context

### Competitive Landscape

| Competitor | Price | Weakness |
|------------|-------|----------|
| ETAP / SKM | $15-50K/yr | Enterprise-only, no EV focus |
| Kopperfield | Free (residential) | No multi-family, no EV, limited NEC coverage |
| EasyPower | $5-15K/yr | Desktop-only, no modern UI |
| Manual spreadsheets | Free | Error-prone, no permit-ready output |

### SparkPlan Differentiator
Only tool addressing the intersection of NEC 220.84 + 220.57 + 625.42 + EVEMS right-sizing + permit-ready PDF at under $150/mo. The NEC 220.87 measurement path shows 30-50% more available capacity than calculation method alone.

### TAM
251,789 US electrical contractors x $49-149/mo = $148M-450M ARR potential.

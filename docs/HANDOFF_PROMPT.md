# LLM Handoff Prompt
## SparkPlan Codebase

**Purpose**: This document provides the optimal reading path for an LLM taking over this codebase.
**Time Required**: 3-4 hours of focused reading
**Last Updated**: 2025-12-03

---

## 🔌 Understanding the Domain: Electrical Engineering Software

### What Problem Does This Software Solve?

**For**: Electrical contractors, electricians, and electrical engineers
**Problem**: Designing compliant electrical distribution systems is complex, error-prone, and requires constant NEC code lookups
**Solution**: Project-based electrical design tool that automates NEC calculations, generates documentation, and ensures code compliance

### Real-World Workflow Example

**Scenario**: Contractor needs to design electrical system for a 3,500 sq ft office building

**Traditional Workflow (Manual)**:
1. Calculate total connected load (lighting, receptacles, HVAC, equipment)
2. Apply NEC demand factors (Table 220.42, 220.55, etc.)
3. Size service conductors based on load + 125% continuous factor
4. Size main panel breaker and bus rating
5. Design subpanel feeders with voltage drop calculations
6. Size equipment grounding conductors (Table 250.122)
7. Draw one-line diagram by hand (or in AutoCAD)
8. Create panel schedules showing every circuit
9. Look up conduit fill tables (Chapter 9)
10. Manually verify against NEC code articles

**Time**: 4-6 hours, prone to calculation errors

**With SparkPlan**:
1. Create project → Set service parameters (480V, 3-phase)
2. Use project template → "Office Building" auto-generates panels
3. Add circuits → Software auto-calculates loads, sizes conductors, checks voltage drop
4. Generate one-line diagram → Automatic hierarchical layout
5. Export panel schedules → PDF ready for permit submittal
6. AI assistant → Ask "Is my grounding compliant with NEC 250.66?"

**Time**: 30-60 minutes, calculations guaranteed NEC-compliant

---

## 🏗️ Electrical System Architecture (Not Software Architecture)

### Physical Hierarchy (Top to Bottom)

```
┌─────────────────────────────────────────────┐
│ UTILITY SERVICE (e.g., 480V 3-phase)       │
│ Power company connection                    │
└────────────────┬────────────────────────────┘
                 │
                 │ Service Entrance Conductors
                 ↓
┌─────────────────────────────────────────────┐
│ METER                                       │
│ Utility metering point                      │
└────────────────┬────────────────────────────┘
                 │
                 │ Main Service Conductors
                 ↓
┌─────────────────────────────────────────────┐
│ MAIN DISTRIBUTION PANEL (MDP)              │
│ - Main breaker (e.g., 800A)                │
│ - Bus rating (e.g., 800A)                  │
│ - Branch circuit breakers                  │
│ - Feeds subpanels and transformers         │
└────────┬────────────────┬───────────────────┘
         │                │
         │                │ Feeder (e.g., 480V)
         │                ↓
         │        ┌───────────────────┐
         │        │ TRANSFORMER       │
         │        │ 480V → 208V       │
         │        │ 75 kVA            │
         │        └────────┬──────────┘
         │                 │
         │ Feeder          │ 208V feeder
         │ (480V)          ↓
         ↓         ┌──────────────────┐
┌─────────────┐   │ SUBPANEL (208V)  │
│ SUBPANEL    │   │ - For receptacles│
│ (480V)      │   │ - 120V circuits  │
│ - Machinery │   └──────────────────┘
└─────────────┘
```

### Key Electrical Concepts This Software Manages

#### 1. **Load Calculations (NEC Article 220)**
**What**: Determining total electrical demand for a building
**Why**: Size service entrance conductors and main breaker
**How Software Helps**:
- Auto-applies demand factors from NEC Table 220.42 (lighting loads)
- Auto-applies demand factors from NEC Table 220.55 (range/oven loads)
- Applies 125% continuous load factor (NEC 210.19(A)(1))
- Calculates dwelling unit optional calculation (NEC 220.82)

**Code Location**: `/services/calculations/loadCalculation.ts`

#### 2. **Conductor Sizing (NEC Article 310)**
**What**: Selecting wire gauge (e.g., 12 AWG, 10 AWG, 4 AWG) for circuits
**Why**: Wire too small = fire hazard, wire too large = cost waste
**How Software Helps**:
- Looks up ampacity from NEC Table 310.16 (copper/aluminum, 60°C/75°C/90°C)
- Applies temperature correction (Table 310.15(B)(1)) for hot environments
- Applies bundling adjustment (Table 310.15(C)(1)) for conduit fill
- Auto-calculates 125% continuous load requirement

**Code Location**: `/services/calculations/conductorSizing.ts`

#### 3. **Voltage Drop (NEC Chapter 9 Table 9)**
**What**: Voltage loss over long wire runs (e.g., 480V drops to 472V at load)
**Why**: Excessive voltage drop causes equipment malfunction (NEC recommends ≤3%)
**How Software Helps**:
- Uses AC impedance method (resistance + reactance)
- Accounts for power factor (typically 0.85 for general loads)
- Warns when voltage drop exceeds 3%

**Code Location**: `/services/calculations/voltageDrop.ts`

#### 4. **Equipment Grounding Conductor (EGC) Sizing (NEC Table 250.122)**
**What**: Safety ground wire that runs with phase conductors
**Why**: Protects people from electric shock if equipment faults
**How Software Helps**:
- Sizes EGC based on overcurrent device rating (Table 250.122)
- Proportionally upsizes EGC if phase conductors upsized for voltage drop (NEC 250.122(B))
- Calculates circular mil ratio for accurate proportional sizing

**Code Location**: `/services/calculations/conductorSizing.ts` (integrated)

#### 5. **Panel Schedules**
**What**: Circuit-by-circuit documentation showing every load in a panel
**Why**: Required for permit submittal and inspector review
**How Software Helps**:
- Auto-generates formatted schedules with circuit numbers, breaker sizes, loads
- Shows phase balancing (distribute load evenly across A, B, C phases)
- Exports to PDF for construction documents

**Code Location**: `/services/pdfExport/PanelScheduleDocuments.tsx`

#### 6. **One-Line Diagrams (IEEE Std 315)**
**What**: Visual representation of electrical distribution hierarchy
**Why**: Shows power flow from utility through panels to loads
**How Software Helps**:
- Auto-layouts panels, transformers in hierarchical structure
- Draws bus bars (horizontal power distribution lines)
- Shows voltage transformation and phase configuration

**Code Location**: `/components/OneLineDiagram.tsx` (1614 lines)

---

## 🧮 Key NEC Calculations Implemented

### Calculation 1: Service Entrance Sizing

**Electrical Engineering Workflow**:
1. Sum all connected loads (VA)
2. Apply demand factors (not all loads run simultaneously)
3. Add 125% multiplier for continuous loads (run ≥3 hours)
4. Calculate service ampacity: `I = VA / (√3 × V × PF)`
5. Select conductor size from NEC Table 310.16
6. Select main breaker size (next standard size up)

**Code Implementation**:
```typescript
// services/calculations/loadCalculation.ts
export function calculateServiceLoad(loads: LoadItem[]): ServiceLoadResult {
  // 1. Separate continuous/non-continuous
  const continuousLoads = loads.filter(l => l.isContinuous);
  const nonContinuousLoads = loads.filter(l => !l.isContinuous);

  // 2. Apply 125% to continuous loads (NEC 210.19(A)(1))
  const continuousVA = sum(continuousLoads) * 1.25;
  const nonContinuousVA = sum(nonContinuousLoads);

  // 3. Apply demand factors from NEC Table 220.42
  const lightingDemand = applyLightingDemandFactor(lightingVA, occupancyType);

  // 4. Calculate ampacity
  const totalVA = continuousVA + nonContinuousVA + lightingDemand;
  const ampacity = totalVA / (Math.sqrt(3) * voltage * powerFactor);

  // 5. Size conductor
  const conductorSize = lookupConductorSize(ampacity, wireType, tempRating);

  return { totalVA, ampacity, conductorSize };
}
```

### Calculation 2: Feeder Sizing for Subpanels

**Electrical Engineering Workflow**:
1. Sum all circuits in destination panel
2. Add 125% for continuous loads
3. Size feeder conductors (phase, neutral, ground)
4. Calculate voltage drop over feeder length
5. Upsize if voltage drop >3%
6. Proportionally upsize EGC if phase conductors upsized

**Code Implementation**:
```typescript
// services/calculations/feederSizing.ts
export function sizeFeeder(panel: Panel, circuits: Circuit[]): FeederResult {
  // 1. Calculate panel load
  const panelLoad = calculatePanelLoad(circuits);

  // 2. Size phase conductors
  const phaseConductor = sizeConductor(panelLoad.ampacity, conditions);

  // 3. Check voltage drop
  const voltageDrop = calculateVoltageDrop({
    current: panelLoad.ampacity,
    length: feederLength,
    conductor: phaseConductor
  });

  // 4. Upsize if needed
  if (voltageDrop > 3.0) {
    phaseConductor = upsizeForVoltageDrop(phaseConductor, voltageDrop);
  }

  // 5. Size neutral (NEC 220.61 demand factors)
  const neutralConductor = sizeNeutralConductor(panelLoad);

  // 6. Size EGC with proportional upsizing (NEC 250.122(B))
  const egc = sizeEGC(breakerSize, phaseConductor);

  return { phase: phaseConductor, neutral: neutralConductor, egc };
}
```

---

## 📊 How Electrical Concepts Map to Code Structure

### Database Schema Reflects Physical Hierarchy

```sql
-- Physical: Utility → Meter → MDP
-- Database: service_voltage/service_phase → panels.is_main = true

-- Physical: MDP → Subpanel via feeder
-- Database: panels.fed_from (parent panel ID)

-- Physical: MDP → Transformer → Panel
-- Database: transformers.fed_from_panel_id, panels.fed_from_transformer_id

-- Physical: Panel → Circuit (breaker slot)
-- Database: circuits.panel_id (foreign key)
```

### Component Hierarchy Reflects Electrical Hierarchy

```typescript
// OneLineDiagram.tsx renders electrical hierarchy visually
<svg>
  {/* Utility service entrance */}
  <UtilitySymbol voltage={480} phase={3} />

  {/* Main Distribution Panel */}
  <PanelBox panel={mdp} isMain={true} />

  {/* Horizontal bus bar (power distribution) */}
  <BusBar panels={level1Panels} />

  {/* Subpanels fed from MDP */}
  {subpanels.map(panel => (
    <PanelBox panel={panel} />
  ))}

  {/* Transformers with voltage transformation */}
  {transformers.map(xfmr => (
    <TransformerBox transformer={xfmr} />
  ))}
</svg>
```

### Custom Hooks Manage Equipment State

```typescript
// Equipment type → Custom hook
usePanels(projectId)       // Manages electrical panels
useCircuits(projectId)     // Manages branch circuits
useTransformers(projectId) // Manages transformers
useLoads(projectId)        // Manages load entries
```

---

## 🎯 Who Uses This Software?

### User Persona 1: Electrical Contractor
**Name**: Mike, runs a small electrical contracting business
**Projects**: Residential homes, small commercial buildings
**Pain Points**:
- Spends 4+ hours on load calculations per project
- Errors in calculations cause inspection failures
- Manual panel schedules in Excel are tedious

**How He Uses SparkPlan**:
1. Creates new project: "Johnson Residence, 3500 sq ft"
2. Uses "Residential Home" template → Auto-generates 200A service, MDP, circuits
3. Customizes circuits for specific needs (add EV charger, pool equipment)
4. Exports panel schedule PDF → Submits to building inspector
5. Uses AI assistant to verify grounding electrode system (NEC 250.50)

### User Persona 2: Electrical Engineer
**Name**: Sarah, PE (Professional Engineer) at consulting firm
**Projects**: Commercial buildings, industrial facilities
**Pain Points**:
- Complex systems with transformers, multiple voltage levels
- Voltage drop calculations for long feeders
- Short circuit analysis for equipment ratings

**How She Uses SparkPlan**:
1. Creates project: "Office Complex, 480V 3-phase service"
2. Adds MDP (800A bus rating)
3. Adds transformer (480V → 208V, 75kVA) fed from MDP
4. Adds 208V panels fed from transformer
5. Sizes feeders with voltage drop validation
6. Runs short circuit analysis → Verifies breaker AIC ratings
7. Exports one-line diagram → Includes in construction documents

---

## 🚀 Now You Understand the Electrical Engineering Context

**Before reading code, you should be able to answer**:
- [ ] What is the NEC? (National Electrical Code - regulatory standard)
- [ ] What is a load calculation? (Determining total electrical demand)
- [ ] What is conductor sizing? (Selecting wire gauge based on ampacity)
- [ ] What is voltage drop? (Voltage loss over wire length, limit 3%)
- [ ] What is an MDP? (Main Distribution Panel - where service enters building)
- [ ] What is a feeder? (Conductors from one panel to another panel)
- [ ] What is an EGC? (Equipment Grounding Conductor - safety ground wire)
- [ ] What is a panel schedule? (Circuit-by-circuit documentation for permit)
- [ ] What is a one-line diagram? (Visual representation of electrical hierarchy)

If you can answer these questions, you're ready to read the code.

---

# 📚 PHASE-BY-PHASE READING GUIDE

## Phase 1: Core Architecture Understanding (45 minutes)

**Read in this exact order:**

### 1. **START HERE: `/CLAUDE.md`** (15 min)
   - Read "Security Status" section (lines 7-41)
   - Read "Documentation Index" section (lines 33-69)
   - Read "Architecture Overview" section (lines 120-175)
   - Read "Current Project Status" section (lines 683-724)
   - **Goal**: Understand tech stack, what's built, what's production-ready

### 2. **`/docs/architecture.md`** (20 min)
   - Focus on "State Management Strategy" (lines 15-45)
   - Study "Data Flow Patterns" diagrams (lines 80-150)
   - Understand "Optimistic Updates + Real-Time Sync" pattern (lines 120-180)
   - **Goal**: Understand the core state management pattern used throughout

### 3. **`/hooks/usePanels.ts`** (10 min)
   - Read JSDoc header (lines 1-72)
   - Study the pattern: fetch → subscribe → optimistic update
   - **Goal**: See the architecture pattern in actual code

**At this point, you should understand:**
- ✅ Database-first architecture (Supabase = single source of truth)
- ✅ Optimistic UI updates (local state → async DB → real-time sync)
- ✅ Real-time subscriptions (changes sync across browser tabs)
- ✅ No Redux/Zustand - custom hooks manage all state

---

## Phase 2: Why Decisions Were Made (30 minutes)

**Read all 6 ADRs to understand the "why" behind architecture:**

### 4. **`/docs/adr/001-optimistic-ui-updates.md`** (5 min)
   - **Why**: UI updates immediately before DB confirms
   - **Trade-off**: Brief inconsistency, but self-correcting

### 5. **`/docs/adr/002-custom-hooks-over-react-query.md`** (5 min)
   - **Why**: Supabase real-time subscriptions replace polling/caching
   - **Trade-off**: Manual implementation, but perfect integration

### 6. **`/docs/adr/003-supabase-realtime-state-management.md`** (5 min)
   - **Why**: Database as single source of truth
   - **Trade-off**: Network dependency, no offline support

### 7. **`/docs/adr/004-hashrouter-for-github-pages.md`** (5 min)
   - **Why**: HashRouter for zero-config static hosting
   - **Trade-off**: Ugly URLs (#/project/123), acceptable for SaaS

### 8. **`/docs/adr/005-panel-hierarchy-discriminated-union.md`** (5 min)
   - **Why**: 3 columns (fed_from_type, fed_from, fed_from_transformer_id)
   - **Trade-off**: More columns, but type-safe + referential integrity

### 9. **`/docs/adr/006-one-line-diagram-monolith.md`** (5 min)
   - **Why**: 1614-line OneLineDiagram.tsx is intentional
   - **Trade-off**: Long file, but easier debugging of complex hierarchy

**At this point, you should understand:**
- ✅ Why we chose this architecture (not arbitrary)
- ✅ What trade-offs were made (and why they're acceptable)
- ✅ When to follow patterns vs when to deviate

---

## Phase 3: Database Schema & Relationships (30 minutes)

### 10. **`/docs/database-architecture.md`** (30 min)
    - Read "Entity Relationship Diagram" (lines 15-80)
    - Study "Panel Hierarchy Pattern" (lines 120-200)
    - Review "RLS Policies" table-by-table (lines 300-450)
    - **Goal**: Understand data model and security policies

**At this point, you should understand:**
- ✅ All 9 database tables and their relationships
- ✅ Panel hierarchy: service → MDP → subpanels → transformers
- ✅ RLS policies (users only see their own projects)
- ✅ Cascading deletes behavior

---

## Phase 4: Development Workflow (30 minutes)

### 11. **`/docs/development-guide.md`** (30 min)
    - Read "Adding New Features" complete example (lines 50-250)
    - Study "Database Migration Pattern" (lines 280-350)
    - Review "Common Pitfalls" section (lines 500-600)
    - **Goal**: Learn step-by-step workflow for making changes

**At this point, you should be able to:**
- ✅ Add a new feature end-to-end (database → hook → component → route)
- ✅ Create database migrations safely
- ✅ Avoid common mistakes (e.g., props drilling, missing subscriptions)

---

## Phase 5: Security & Testing (15 minutes)

### 12. **`/docs/security.md`** (10 min)
    - Read "Security Status Overview" table (lines 24-43)
    - Study "Gemini API Security" backend proxy pattern (lines 49-208)
    - **Goal**: Understand production-grade security already implemented

### 13. **`/tests/examples/hook-testing-example.test.ts`** (5 min)
    - Skim patterns for testing custom hooks
    - **Goal**: Know where to look when writing tests

**At this point, you should know:**
- ✅ Application is production-secure (no vulnerabilities)
- ✅ How to test hooks and components

---

## Phase 6: Complex Component Deep-Dive (20 minutes)

### 14. **`/components/OneLineDiagram.tsx`** (20 min)
    - Read architecture header comments (lines 1-115)
    - Study coordinate system diagram (lines 20-40)
    - Understand bus bar rendering logic (lines 50-80)
    - **Goal**: See how to document complex components

**At this point, you should understand:**
- ✅ How to navigate a 1600-line component
- ✅ IEEE Std 315 electrical diagram standards
- ✅ When monolithic components are acceptable

---

## Phase 7: NEC Calculation Engines (30 minutes)

### 15. **`/services/calculations/loadCalculation.ts`** (10 min)
    - Read file header comments
    - Study `calculateDwellingLoad()` function (NEC 220.82)
    - Understand demand factor application (Table 220.42, 220.55)
    - **Goal**: See how NEC code translates to TypeScript

### 16. **`/services/calculations/conductorSizing.ts`** (10 min)
    - Study `sizeConductor()` function
    - Understand temperature/bundling corrections
    - See NEC Table 310.16 lookup logic
    - **Goal**: Understand conductor ampacity calculations

### 17. **`/services/calculations/feederSizing.ts`** (10 min)
    - Study `sizeFeeder()` function
    - Understand voltage drop validation
    - See EGC proportional upsizing (NEC 250.122(B))
    - **Goal**: Understand complete feeder design workflow

**At this point, you should understand:**
- ✅ How NEC code articles map to calculation functions
- ✅ Demand factors reduce connected load to actual demand
- ✅ 125% continuous load factor applied everywhere
- ✅ Voltage drop limits conductor sizing

---

# 📖 QUICK REFERENCE AFTER READING

**When adding a new feature:**
1. Check `/docs/development-guide.md` - "Adding New Features" section
2. Follow the 7-step workflow (database → types → hook → component → route)

**When you see unfamiliar patterns:**
1. Check `/docs/adr/` directory - likely an ADR explains it
2. Check `/docs/architecture.md` - patterns documented there

**When writing tests:**
1. Look at `/tests/examples/hook-testing-example.test.ts`
2. Look at `/tests/examples/component-testing-example.test.tsx`

**When deploying:**
1. Read `/docs/deployment.md` - environment variables, build config

**When debugging security:**
1. Read `/docs/security.md` - all security architecture documented

**When implementing NEC calculations:**
1. Check `/data/nec/` directory for reference tables
2. Study existing calculation services in `/services/calculations/`
3. Write unit tests first (see `/tests/calculations/`)

---

# ✅ YOU'RE READY WHEN YOU CAN ANSWER:

## Software Architecture Questions:
- [ ] How does state management work? (Optimistic updates + real-time sync)
- [ ] Where is the Gemini API key? (Server-side in Supabase Edge Functions)
- [ ] How do panels track hierarchy? (Discriminated union: fed_from_type)
- [ ] Why is OneLineDiagram.tsx 1600 lines? (Intentional monolith per ADR-006)
- [ ] How do I add a new feature? (7-step workflow in development-guide.md)
- [ ] Is the app production-ready? (Yes, security + core features complete)

## Electrical Engineering Questions:
- [ ] What is NEC Article 220? (Load calculations)
- [ ] What is NEC Article 310? (Conductor sizing and ampacity)
- [ ] What is NEC Article 250? (Grounding and bonding)
- [ ] What is the 125% continuous load factor? (NEC 210.19(A)(1) - loads running ≥3 hours)
- [ ] What is a demand factor? (Ratio reducing connected load to actual demand)
- [ ] What is the 3% voltage drop rule? (NEC informational note for branch circuits)
- [ ] What is Table 250.122? (Equipment grounding conductor sizing)
- [ ] What is a panel schedule? (Circuit-by-circuit documentation for permits)

---

# 🎯 ESTIMATED TIME TO FULL CONTEXT

- **Phase 1 (Architecture)**: 45 minutes
- **Phase 2 (ADRs)**: 30 minutes
- **Phase 3 (Database)**: 30 minutes
- **Phase 4 (Development)**: 30 minutes
- **Phase 5 (Security)**: 15 minutes
- **Phase 6 (Complex Components)**: 20 minutes
- **Phase 7 (NEC Calculations)**: 30 minutes

**Total**: 3-4 hours of focused reading

---

# 🚀 START HERE

Begin with `/CLAUDE.md` and work through the phases above in order.

After completing all phases, you'll have:
- ✅ Full understanding of software architecture
- ✅ Context for why decisions were made
- ✅ Knowledge of electrical engineering domain
- ✅ Ability to add features and fix bugs
- ✅ Understanding of NEC compliance requirements

**You're ready to take over the codebase. Good luck!** ⚡

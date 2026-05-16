# Multi-Family EV Readiness Calculator - Technical Specification

**Status**: Proposed (Forum-Validated)
**Created**: 2026-01-19
**Priority**: Phase 2.5 (Months 6-8)
**Author**: AI Strategy Analysis

---

## Executive Summary

### The Problem (Forum-Validated)

From Mike Holt Forums and Electrician Talk research:

> "What size service I will need for 4 48amp ev chargers. It's for an apartment complex... **I don't even know where to start.**" — jimjones, Electrician Talk

> "We've **stopped installing multi unit ac's and chargers**... We can do it but usually tell them it's **$2-10k to calculate the demands**... **Zero customers have been willing to pay so far.**" — deltasparky, Electrician Talk

> "There is **no FEASABLE / REASONABLE answer for your problem.**" — power, Electrician Talk (responding to condo EV question)

### The Opportunity

- **Contractors are turning down $10K-50K jobs** because they can't produce the documentation
- **Engineering firms charge $2-10K** for load calculations we can automate
- **$100K+ quotes** for load management systems that could be right-sized with proper calculations
- **NEC 220.84 demand factors** allow massive load reductions that most contractors don't know exist

### Our Solution

**Multi-Family EV Readiness Calculator** - A comprehensive tool that:
1. Calculates building-wide service capacity using NEC 220.84 demand factors
2. Determines how many EV chargers a building can support
3. Right-sizes EVEMS load management systems
4. Generates permit-ready documentation for inspectors and utilities

---

## Target Users

### Primary: Multi-Family EV Specialists

| Characteristic | Details |
|----------------|---------|
| **Job Volume** | 3-10 multi-family EV projects/month |
| **Project Types** | Apartment complexes, condos, HOAs, parking garages |
| **Pain Level** | CRITICAL - turning down work due to complexity |
| **Current Solution** | Engineering firms ($2-10K) or decline the job |
| **Willingness to Pay** | $199-499/project or $149/mo Business tier |

### Secondary: General Electricians

Residential electricians who occasionally get multi-family EV requests and need guidance.

---

## NEC Code Foundation

### Key NEC Articles

| Article | Description | How We Use It |
|---------|-------------|---------------|
| **NEC 220.84** | Optional Calculation for Multi-Family Dwellings | Demand factors that reduce service load by 50-75% |
| **NEC 220.57** | Electric Vehicle Supply Equipment | 7200VA or nameplate (whichever larger) per EVSE |
| **NEC 220.53(5)** | Appliance Load | Demand factor SHALL NOT apply to EVSE |
| **NEC 625.42** | Rating (EVEMS) | Load management provisions for multiple EVs |
| **NEC 230.42** | Service Conductor Sizing | Minimum service conductor requirements |

### Critical Insight: NEC 220.84 Demand Factors

**Most contractors don't know this exists:**

| Number of Dwelling Units | Demand Factor |
|--------------------------|---------------|
| 3 | 45% |
| 4-5 | 40% |
| 6-7 | 35% |
| 8-10 | 30% |
| 11-13 | 27% |
| 14-16 | 24% |
| 17-19 | 21% |
| 20 | 20% |
| 21 | 19% |
| 22-25 | 18% |
| 26-40 | 17% |
| 41-60 | 16% |
| 61+ | 15% |

**Example Impact:**
- 40-unit building with 200A/unit = 8,000A raw load
- With NEC 220.84 demand factor (17%) = **1,360A calculated load**
- That's **6,640A of "headroom"** for EV chargers most contractors don't know exists

---

## Feature Specification

### 1. Building Profile Input

**Purpose:** Capture building characteristics to calculate baseline service capacity.

#### Required Inputs

| Field | Type | Validation | NEC Reference |
|-------|------|------------|---------------|
| Number of Dwelling Units | Number | 3+ (for optional calc) | 220.84(A) |
| Square Footage per Unit | Number | Or select from presets | 220.84(C)(2) |
| Voltage (Phase) | Select | 120/240V 1Φ, 208Y/120V 3Φ, 480Y/277V 3Φ | - |
| Existing Service Size | Select | 200A, 400A, 600A, 800A, etc. | - |
| Service Type | Select | Utility-metered, House service, Individual meters | - |

#### Optional Inputs (Refinement)

| Field | Type | Purpose |
|-------|------|---------|
| Electric Heat (Yes/No) | Toggle | Adds 65% of largest unit's heat (220.84(C)(4)) |
| Electric Cooking (Yes/No) | Toggle | Uses Table 220.55 for ranges |
| Common Area Loads | Number (VA) | Elevators, lighting, pool, etc. |
| Existing EV Chargers | Number | Subtract from available capacity |

### 2. Building Service Calculator

**Purpose:** Calculate total building service load per NEC 220.84.

#### Calculation Steps

```
Step 1: Base Load Calculation
   - General lighting: 3 VA/sq ft × total sq ft × demand factor (Table 220.84)
   - Small appliance circuits: 1,500 VA × 2 circuits/unit × units × demand factor
   - Laundry circuit: 1,500 VA/unit × units × demand factor

Step 2: Major Appliances
   - Cooking: Per Table 220.55 (Column C for electric ranges)
   - Dryers: 5,000 VA/unit or nameplate × demand factor
   - HVAC: 65% of largest unit's heating load (if electric heat)

Step 3: Apply NEC 220.84 Demand Factor
   - Based on number of dwelling units (see table above)

Step 4: Common Area Loads
   - 100% of common area loads (no demand factor)

Step 5: Total Building Load
   = (Unit loads × demand factor) + Common area loads
```

#### Output Display

| Metric | Value | Visual |
|--------|-------|--------|
| Total Building Load | X amps | - |
| Available Service Capacity | Y amps | - |
| Current Utilization | Z% | Color-coded gauge |
| Available for EV | W amps | Highlighted |

### 3. EV Capacity Calculator

**Purpose:** Determine how many EV chargers the building can support.

#### Scenarios to Calculate

| Scenario | Description | Calculation |
|----------|-------------|-------------|
| **Without EVEMS** | Direct connection (no load management) | Available amps ÷ 48A per charger |
| **With EVEMS** | Load-managed installation | See EVEMS sizing below |
| **Service Upgrade** | If current service insufficient | Calculate new service size required |

#### EVEMS Load Management Calculator

Based on existing `services/calculations/evems.ts`:

| Mode | Description | Formula |
|------|-------------|---------|
| **Time-Based Scheduling** | Different power at different times | Peak load = (chargers × amps) × schedule_factor |
| **Power Sharing** | Split available capacity among active chargers | Max amps per charger = available_capacity ÷ max_simultaneous |
| **Dynamic Load Management** | Real-time adjustment based on building load | Charger limit = available_capacity - (current_load × safety_factor) |

#### Output: EV Capacity Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ EV CHARGER CAPACITY ANALYSIS                                    │
├─────────────────────────────────────────────────────────────────┤
│ Building: 40-Unit Apartment Complex                             │
│ Existing Service: 1600A 208Y/120V 3Φ                           │
│                                                                 │
│ Calculated Building Load: 1,360A (17% demand factor applied)    │
│ Available Capacity: 240A                                        │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ OPTION A: No Load Management                                │ │
│ │ • Maximum chargers: 5 (48A Level 2)                        │ │
│ │ • Per-charger cost: Standard installation                  │ │
│ │ • Limitation: Fixed capacity, no flexibility               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ OPTION B: With EVEMS (Power Sharing)                        │ │
│ │ • Maximum chargers: 20 (48A Level 2, shared to 12A each)   │ │
│ │ • EVEMS equipment: ~$15,000-25,000                         │ │
│ │ • Per-charger yield: 4 hrs = ~12 kWh overnight             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ OPTION C: Service Upgrade Required                          │ │
│ │ • For 40 chargers at full capacity (no sharing)            │ │
│ │ • Required service: 3,200A (+1,600A upgrade)               │ │
│ │ • Estimated cost: $150,000-250,000                         │ │
│ │ • Utility coordination: Required                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Transformer Capacity Check

**Purpose:** Address the "ticking time bomb" mentioned in forums.

From Mike Holt Forums:
> "Nobody is first looking into seeing if the primary transformer can handle the load... There was a transformer fire in an apartment building complex after they added a bunch of EV chargers in Florida a few months ago." — herding_cats

#### Inputs

| Field | Type | Source |
|-------|------|--------|
| Transformer kVA Rating | Number | Utility data or nameplate |
| Secondary Voltage | Select | 208Y/120V, 480Y/277V |
| Number of Buildings/Units Fed | Number | Site knowledge |

#### Calculation

```
Transformer Capacity (A) = (kVA × 1000) ÷ (Voltage × √3)

Example: 500 kVA transformer at 208Y/120V
= (500 × 1000) ÷ (208 × 1.732)
= 1,388A capacity

If building calculated load + EV load > 80% of transformer capacity:
⚠️ WARNING: Transformer may be undersized. Contact utility.
```

#### Output

| Status | Condition | Recommendation |
|--------|-----------|----------------|
| ✅ GREEN | <70% utilized | Proceed with installation |
| ⚠️ YELLOW | 70-85% utilized | Contact utility for verification |
| 🔴 RED | >85% utilized | Service upgrade required - utility coordination mandatory |

### 5. 3-Phase Load Balancing

**Purpose:** Ensure EV chargers are balanced across phases.

From forums:
> "3-phase balancing math is complex (1.73 factor)" — Multiple forum users

#### Calculation

For 3-phase 208Y/120V systems:

```
Per-Phase Load (A) = Total Load (VA) ÷ (Voltage × √3)

Example: 10 × 48A chargers = 480A total
Per-phase: 480 ÷ 3 = 160A per phase (balanced)

If chargers don't divide evenly:
- Phase A: 4 chargers = 192A
- Phase B: 3 chargers = 144A
- Phase C: 3 chargers = 144A
- Imbalance: 48A (10%) - ACCEPTABLE
```

#### Visual Output

```
Phase Balancing Analysis:
┌───────────────────────────────────────────────────────┐
│ Phase A  ████████████████████░░░░░░░░░░  192A (80%)  │
│ Phase B  ████████████████░░░░░░░░░░░░░░  144A (60%)  │
│ Phase C  ████████████████░░░░░░░░░░░░░░  144A (60%)  │
└───────────────────────────────────────────────────────┘
Imbalance: 48A (10%) - ✅ Acceptable (<15%)
```

### 6. Permit-Ready Documentation Package

**Purpose:** Generate everything needed for permit and utility approval.

#### Documents Generated

| Document | Format | Purpose | NEC Reference |
|----------|--------|---------|---------------|
| **Building Load Calculation** | PDF | Inspector review | 220.84 |
| **EV Load Analysis** | PDF | Show EV impact | 220.57 |
| **EVEMS Sizing Report** | PDF | Justify load management | 625.42 |
| **One-Line Diagram** | PDF/PNG | Visual system layout | - |
| **Utility Coordination Letter** | PDF | Service upgrade request | Varies |
| **Equipment Schedule** | PDF | Bill of materials | - |

#### Building Load Calculation PDF

```
┌─────────────────────────────────────────────────────────────────┐
│                  BUILDING LOAD CALCULATION                      │
│                    Per NEC 220.84 (Optional Method)            │
├─────────────────────────────────────────────────────────────────┤
│ Project: Sunset Apartments EV Charging                          │
│ Address: 1234 Main Street, City, State 12345                   │
│ Prepared by: [Company Name]                                     │
│ Date: 2026-01-19                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ BUILDING PARAMETERS                                             │
│ ─────────────────────────────────────────────────────────────── │
│ Number of Dwelling Units: 40                                    │
│ Average Unit Size: 1,000 sq ft                                  │
│ Total Building Area: 40,000 sq ft                              │
│ Service Voltage: 208Y/120V 3Φ                                  │
│ Existing Service: 1,600A                                        │
│                                                                 │
│ LOAD CALCULATION                                                │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ 1. General Lighting & Receptacles                               │
│    3 VA × 40,000 sq ft = 120,000 VA                            │
│                                                                 │
│ 2. Small Appliance Circuits                                     │
│    1,500 VA × 2 × 40 units = 120,000 VA                        │
│                                                                 │
│ 3. Laundry Circuit                                              │
│    1,500 VA × 40 units = 60,000 VA                             │
│                                                                 │
│ 4. Cooking (Electric Ranges)                                    │
│    Per Table 220.55, 40 units = 25,000 VA                      │
│                                                                 │
│ 5. Dryers (5,000 VA each)                                       │
│    5,000 VA × 40 units = 200,000 VA                            │
│                                                                 │
│ SUBTOTAL: 525,000 VA                                            │
│                                                                 │
│ NEC 220.84 DEMAND FACTOR APPLICATION                            │
│ ─────────────────────────────────────────────────────────────── │
│ 40 units = 17% demand factor (Table 220.84)                    │
│ 525,000 VA × 0.17 = 89,250 VA                                  │
│                                                                 │
│ 6. Common Area Loads (100% - no demand factor)                  │
│    Lighting, elevators, pool: 50,000 VA                        │
│                                                                 │
│ TOTAL BUILDING LOAD: 139,250 VA                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ SERVICE CALCULATION                                             │
│ Load (A) = 139,250 VA ÷ (208V × 1.732) = 387A                  │
│                                                                 │
│ AVAILABLE CAPACITY                                              │
│ Existing Service: 1,600A                                        │
│ Calculated Load: 387A                                           │
│ Available for EV: 1,213A                                        │
│                                                                 │
│ EV CHARGER CAPACITY                                             │
│ At 48A/charger: 1,213 ÷ 48 = 25 chargers (no EVEMS)           │
│ With EVEMS power sharing: Up to 80+ chargers possible          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Existing Features to Leverage

| Feature | Location | Reuse Strategy |
|---------|----------|----------------|
| **NEC 220.84 Calculator** | `services/calculations/loadCalculation.ts` | Core demand factor logic exists |
| **Service Upgrade Wizard** | `components/ServiceUpgradeWizard.tsx` | Available capacity analysis |
| **EVEMS Calculator** | `services/calculations/evems.ts` | Load management sizing |
| **PDF Export** | `services/pdfExport/` | Document generation framework |
| **One-Line Diagram** | `components/OneLineDiagram.tsx` | Visual system layout |

### New Components Required

| Component | Estimated Effort | Dependencies |
|-----------|------------------|--------------|
| `MultiFamilyEVWizard.tsx` | 12-15 hours | Existing calculations |
| `BuildingProfileForm.tsx` | 4-6 hours | Form patterns exist |
| `EVCapacityAnalysis.tsx` | 6-8 hours | EVEMS calculator |
| `TransformerCapacityCheck.tsx` | 3-4 hours | Simple calculation |
| `PhaseBalancingVisual.tsx` | 3-4 hours | D3 or Chart.js |
| `multiFamilyEVPDF.ts` | 8-10 hours | PDF framework exists |

### Database Schema Additions

```sql
-- Multi-family EV analysis results storage
CREATE TABLE multi_family_ev_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- Building profile
  dwelling_units INTEGER NOT NULL,
  avg_unit_sqft NUMERIC NOT NULL,
  voltage TEXT NOT NULL,
  phase TEXT NOT NULL,
  existing_service_amps INTEGER NOT NULL,

  -- Calculated values
  building_load_va NUMERIC NOT NULL,
  building_load_amps NUMERIC NOT NULL,
  demand_factor_percent NUMERIC NOT NULL,
  available_capacity_amps NUMERIC NOT NULL,

  -- EV analysis
  ev_chargers_without_evems INTEGER NOT NULL,
  ev_chargers_with_evems INTEGER NOT NULL,
  evems_configuration JSONB,

  -- Transformer (optional)
  transformer_kva NUMERIC,
  transformer_utilization_percent NUMERIC,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS policies
ALTER TABLE multi_family_ev_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses"
  ON multi_family_ev_analyses FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Users can create analyses"
  ON multi_family_ev_analyses FOR INSERT
  WITH CHECK (created_by = auth.uid());
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/multi-family-ev/calculate` | POST | Run full analysis |
| `/api/multi-family-ev/save` | POST | Save analysis to database |
| `/api/multi-family-ev/export` | GET | Generate PDF package |

---

## Validation Approach

### Phase 1: "Done-For-You" Validation (2 weeks)

Following the Alex Becker / Stripe "install it for them" approach:

1. **Identify 5-10 multi-family EV contractors** from forum contacts
2. **Offer FREE analysis** for their next project
3. **Manually use existing tools** (Service Upgrade Wizard, EVEMS Calculator)
4. **Generate documentation manually** in PDF
5. **Deliver permit-ready package** and gather feedback

**Success Criteria:**
- Contractor says "I would have paid $X for this"
- Contractor wins the job using our documentation
- Contractor refers another contractor

### Phase 2: MVP Development (4 weeks)

Build the integrated tool based on Phase 1 feedback:

1. Combine existing calculators into unified workflow
2. Build multi-family specific input forms
3. Generate PDF documentation automatically
4. Test with 10+ real projects

### Phase 3: Pricing Validation (2 weeks)

Test pricing models:

| Model | Price | Test |
|-------|-------|------|
| **Per-project** | $199 | "Would you pay $199 for this analysis?" |
| **Per-project premium** | $499 | Include utility coordination package |
| **Subscription** | $149/mo | Unlimited analyses (Business tier) |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Time to first analysis** | <15 minutes | Track wizard completion time |
| **Permit approval rate** | >90% | Follow-up survey |
| **Customer acquisition cost** | <$200 | Ad spend / conversions |
| **Revenue per customer** | $199-499/project or $149/mo | Direct sales tracking |
| **NPS score** | >50 | Post-project survey |

---

## Competitive Positioning

### What Competitors Offer

| Competitor | Multi-Family EV Support | Price |
|------------|-------------------------|-------|
| ETAP | ❌ Not specialized | $15-50K/year |
| SKM | ❌ Not specialized | $10-30K/year |
| Design Master | ⚠️ Manual only | $1-2K/year |
| Engineering Firms | ✅ Manual service | $2-10K/project |

### Our Advantage

| Factor | Us | Engineering Firm |
|--------|-----|------------------|
| **Time to completion** | 15 minutes | 1-2 weeks |
| **Price** | $199-499 | $2,000-10,000 |
| **Availability** | 24/7 self-service | Business hours, backlog |
| **Consistency** | Same NEC-compliant output | Varies by engineer |
| **Documentation** | Automatic PDF package | Manual formatting |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **NEC interpretation errors** | Have PE review calculation logic before launch |
| **Utility requirements vary** | Start with major utilities (PG&E, SCE, FPL), expand based on demand |
| **Complex buildings** | Add "Request Engineering Review" option for edge cases |
| **Liability concerns** | Clear disclaimers: "Consult with licensed engineer for final approval" |

---

## Timeline

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 1-2 | Done-For-You validation | 5 manual analyses completed |
| 3-4 | Feedback synthesis | Feature priority list |
| 5-8 | MVP development | Working wizard in staging |
| 9-10 | Beta testing | 10 real projects completed |
| 11-12 | Production launch | Available to Business tier |

---

## Appendix: Forum Research Evidence

### Key Quotes Supporting This Feature

1. **"I don't even know where to start"** (jimjones, Mike Holt Forums)
   - Problem: Apartment complex with 4 EV chargers
   - Solution: Our wizard guides them step-by-step

2. **"No feasible answer for your problem"** (power, Electrician Talk)
   - Problem: 35-unit condo with individual metering
   - Solution: We show EVEMS options that make it feasible

3. **"$2-10K to calculate the demands"** (deltasparky, Electrician Talk)
   - Problem: Engineering cost is prohibitive
   - Solution: We automate this for $199-499

4. **"Transformer fire in Florida"** (herding_cats, Mike Holt Forums)
   - Problem: Nobody checks transformer capacity
   - Solution: We include transformer capacity check

5. **"$100K+ for load management system"** (RAD COM, Electrician Talk)
   - Problem: Oversized quotes from vendors
   - Solution: We right-size the EVEMS

---

*Specification created 2026-01-19 based on forum research validation*

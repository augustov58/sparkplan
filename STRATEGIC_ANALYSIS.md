# NEC Pro Compliance - Multi-Family EV Strategic Analysis

**Last Updated:** January 21, 2026
**Focus:** Multi-Family EV Readiness Calculator
**Validation:** Forum research (Mike Holt Forums, Electrician Talk)

---

## Executive Summary

### The Market Opportunity

Multi-Family EV charging represents the highest-pain, highest-WTP segment in the electrical contracting market. Contractors are **turning down $10,000-$50,000 jobs** because they cannot produce the paperwork inspectors require.

**Key Quote from Forum Research:**
> "We've stopped installing multi unit ac's and chargers... We can do it but usually tell them it's $2-10k to calculate the demands... Zero customers have been willing to pay so far."
> — deltasparky, Electrician Talk Forum

### Our Solution

**NEC Pro Multi-Family EV Calculator** automates the $2-10K engineering calculation that contractors are paying for OR turning away business to avoid.

| Current State | Our Solution |
|---------------|--------------|
| Contractor turns down job | Contractor bids confidently |
| $2-10K engineering fee | $500 one-time or $149-299/mo subscription |
| 2-4 week wait for engineer | 30-minute self-service |
| Often "no feasible answer" | Always get clear yes/no with path forward |

---

## Validated Pain Points

### From Forum Research (January 2026)

| Pain Point | Evidence | Impact |
|------------|----------|--------|
| **"I don't know how to do EV load calculations"** | Master electricians asking basic questions | Lost revenue |
| **Contractors turning down profitable work** | "We've stopped installing multi unit chargers" | $10K-$50K/job lost |
| **Multi-family = impossible** | "There is no FEASABLE answer for your problem" | Jobs never quoted |
| **$2-10K engineering quotes** | Contractors paying or walking away | Profit margin killed |
| **Inspection failures** | Permits issued, finals fail for missing calcs | Re-work costs |

### What's Blocking Contractors

1. Cannot access other units to inventory loads
2. Don't have original building plans/load calcs
3. Don't know NEC 220.84 (multi-unit) calculation methods
4. Complex math with demand factors, diversity factors
5. 3-phase balancing calculations
6. EVEMS sizing requirements (NEC 625.42)

### The Hidden Opportunity

**Most contractors don't know NEC 220.84 allows massive demand factor reductions:**
- First 3-5 units: 45% demand factor
- 6-20 units: 38-44% demand factor
- 21-62+ units: 23-36% demand factor

**Example: 35-unit building**
- Naive calculation: 35 × 100A = 3,500A needed
- NEC 220.84 method: ~1,400A actual demand

**Contractors are concluding "impossible" when "feasible" is the correct answer.**

---

## NEC 220.87 - Calculation vs Measurement Discovery

### Critical Insight (January 21, 2026)

**NEC 220.87 provides two paths for determining existing building demand:**

| Method | NEC Reference | Data Source | Result |
|--------|--------------|-------------|--------|
| **Measurement** | 220.87(A) | Utility bills or 30-day load study | More favorable |
| **Calculation** | 220.87(B) | Article 220 calculations | More conservative |

### Why This Matters

The measurement path often shows **30-50% more available capacity** than calculation:

1. NEC 220.84 calculations assume worst-case scenarios
2. Actual building usage reflects vacancy, efficiency, behavioral patterns
3. A building calculated at 400A demand might only use 180A peak
4. This means 220A available for EV vs 0A using calculation alone

**Impact:** The difference between "turn down the job" and "submit the bid."

### Implementation Status

Our tool now supports both paths:
- ✅ NEC 220.84 Calculation (default, always accepted)
- ✅ 12-Month Utility Billing data input
- ✅ 30-Day Load Study data input
- ✅ Smart building type presets for quick estimates

---

## Implementation Status (January 2026)

### ✅ COMPLETE

| Feature | Status | File |
|---------|--------|------|
| Multi-Family EV Calculator Engine | ✅ Complete | `services/calculations/multiFamilyEV.ts` |
| NEC 220.84 Demand Factors | ✅ Complete | 23-45% tiered (3-62+ units) |
| NEC 220.57 Per-EVSE Load | ✅ Complete | max(7,200 VA, nameplate) |
| NEC 625.42 EVEMS Integration | ✅ Complete | Size to setpoint |
| Calculator UI Component | ✅ Complete | `components/MultiFamilyEVCalculator.tsx` |
| PDF Export (Standalone) | ✅ Complete | 3-page professional report |
| Permit Packet Integration | ✅ Complete | Included in full permit packet |
| Tools Hub Integration | ✅ Complete | Available in Calculators.tsx |
| NEC 220.87 Measurement Path | ✅ Complete | Utility billing / load study input |
| Building Type Presets | ✅ Complete | Smart defaults for common building types |
| Common Area Load Itemization | ✅ Complete | NEC demand factors per category |

### Calculator Features

**Building Profile:**
- Dwelling unit count
- Average unit square footage
- Existing service (amps, voltage, phase)
- Electric heat/cooking configuration
- Common area loads (quick or itemized)
- Building type presets (studio, 1BR, 2BR, condos, etc.)

**NEC 220.87 Load Determination:**
- NEC 220.84 Calculation (standard)
- 12-Month Utility Billing (measured)
- 30-Day Load Study (measured)

**EV Charger Configuration:**
- Number of chargers
- Level 1/2 selection
- Amps per charger
- EVEMS load management option

**Analysis Output:**
- Building demand (calculated or measured)
- EV load calculation
- Available capacity analysis
- Service upgrade recommendation (none/panel/full)
- EVEMS right-sizing guidance
- EV capacity scenarios comparison

**PDF Export:**
- 3-page professional permit package
- NEC code references
- Load breakdown with demand factors
- Compliance summary

---

## Future Roadmap

### Phase 1: Multi-Family Dwelling Calculator (18-25 hours)

**Prerequisite for auto-generation features.**

| Feature | Effort | Status |
|---------|--------|--------|
| NEC 220.84 Calculation Engine | 8-10h | Pending |
| Unit Count & Load Aggregation | 4-6h | Pending |
| Load Category Breakdown | 2-3h | Pending |
| Multi-Family PDF Reports | 4-6h | Pending |

### Phase 2: Auto-Generation Features (30-40 hours)

| Feature | Effort | Description |
|---------|--------|-------------|
| Multi-Family Circuit Auto-Gen | 8-12h | Generate apartment load schedules |
| EVEMS Circuit Templates | 4-6h | Pre-designed EV infrastructure |
| Unit Feeder Auto-Sizing | 3-4h | Size feeders from house panel to units |
| Meter Room Panel Generation | 6-8h | CT cabinet + house panels |
| Database Schema Updates | 2-3h | Building/unit relationships |
| Multi-Family Permit PDFs | 8-10h | Unit-specific panel schedules |

---

## Pricing Strategy

### Market-Validated Pricing (January 2026)

**Context:** Engineering firms charging $2,000-$10,000 for load calculations we automate.

| Tier | Price | Target | Multi-Family EV Access |
|------|-------|--------|------------------------|
| **Free** | $0 | Lead gen | 3 calculations/month |
| **Pro** | $49/mo | Active contractors | Unlimited calculations |
| **Business** | $149/mo | High-volume specialists | Everything + priority support |

### Per-Project Alternative

For contractors doing occasional multi-family work:
- $199-499/analysis (vs $2-10K engineering fees)
- One-time payment, no subscription
- Full permit-ready package

### Value Proposition

| Cost | Traditional | NEC Pro |
|------|-------------|---------|
| Engineering fee | $2,000-$10,000 | $0-199 |
| Turnaround time | 2-4 weeks | 30 minutes |
| Revision cost | $500-1,000/each | Unlimited |

**ROI:** First multi-family EV project saves $2,000+ (40x return on annual subscription)

---

## Competitive Advantages

### Why We Win

| Advantage | Details |
|-----------|---------|
| **NEC 220.84 Expertise** | Demand factors most contractors don't know exist |
| **Both Calculation Paths** | NEC 220.87(A) measurement + 220.87(B) calculation |
| **EVEMS Right-Sizing** | NEC 625.42 compliance, not oversized quotes |
| **Modern UX** | Cloud-native, mobile-friendly, instant results |
| **Permit-Ready Output** | PDF package with NEC references for AHJ |
| **Smart Defaults** | Building type presets when data is limited |

### What Competitors Miss

| Tool | Multi-Family EV Support | NEC 220.87 Measurement Path |
|------|------------------------|------------------------------|
| ETAP | ❌ Enterprise overkill | ❌ No |
| SKM | ❌ Industrial focus | ❌ No |
| EasyPower | ❌ Too expensive | ❌ No |
| Mike Holt | ❌ Single calcs only | ❌ No |
| **NEC Pro** | ✅ **Built for this** | ✅ **Yes** |

---

## Technical Implementation

### Core Files

| File | Purpose |
|------|---------|
| `services/calculations/multiFamilyEV.ts` | Calculation engine (~1000 lines) |
| `components/MultiFamilyEVCalculator.tsx` | UI component |
| `services/pdfExport/MultiFamilyEVDocuments.tsx` | PDF generation |
| `services/pdfExport/multiFamilyEVPDF.tsx` | Export service |

### NEC References Implemented

| Article | Purpose |
|---------|---------|
| NEC 220.84 | Multi-Family Dwelling Demand Factors |
| NEC 220.57 | Electric Vehicle Supply Equipment Load |
| NEC 220.87 | Existing Load Determination Methods |
| NEC 625.42 | EVEMS Load Management |
| NEC 230.42 | Service Conductor Sizing |

### Key Interfaces

```typescript
// Input configuration
interface MultiFamilyEVInput {
  dwellingUnits: number;
  avgUnitSqFt: number;
  voltage: 120 | 208 | 240 | 277 | 480;
  phase: 1 | 3;
  existingServiceAmps: number;
  evChargers: { count, level, ampsPerCharger };
  hasElectricHeat?: boolean;
  hasElectricCooking?: boolean;
  commonAreaLoadVA?: number;
  commonAreaLoads?: CommonAreaLoadItem[];
  useEVEMS?: boolean;
  // NEC 220.87 options
  existingLoadMethod?: 'calculated' | 'utility_bill' | 'load_study';
  measuredPeakDemandKW?: number;
  measurementPeriod?: string;
  utilityCompany?: string;
}

// Result structure
interface MultiFamilyEVResult {
  buildingLoad: { totalConnectedVA, buildingDemandVA, breakdown, loadDeterminationMethod };
  evLoad: { totalConnectedVA, demandVA, loadAmps };
  serviceAnalysis: { availableCapacityAmps, upgradeRequired, upgradeType };
  scenarios: { noEVEMS, withEVEMS, withUpgrade };
  compliance: { isCompliant, necArticles, warnings, recommendations };
}
```

---

## Success Metrics

### Target Outcomes

| Metric | Target | Measurement |
|--------|--------|-------------|
| Multi-Family EV calculations/month | 100+ | Analytics |
| Customer acquisition (MF specialists) | 50+ subscribers | Stripe |
| Jobs won vs turned down | Track via feedback | Survey |
| Time saved per project | 4-8 hours | User reports |

### Validation Signals

- Forum mentions ("I used this tool")
- Case studies with real projects
- Referrals from satisfied contractors
- Inspection pass rate improvement
- Engineering firm referrals (too small for them)

---

## Data Collection Guide for Contractors

### Always Needed (Easy)

- [ ] Number of dwelling units
- [ ] Existing service amperage (main breaker/meter)
- [ ] Voltage configuration (120/208V or 277/480V)
- [ ] Phase configuration (1-phase or 3-phase)

### Helpful if Available (Medium)

- [ ] Property records for unit square footage
- [ ] 12-month utility billing with kW demand
- [ ] Common area amenities list (gym, pool, elevators)
- [ ] Building vintage (affects assumed appliances)

### Nice to Have (Harder)

- [ ] Original electrical plans
- [ ] Individual unit load inventories
- [ ] 30-day metering data

**Key Message:** You don't need perfect data. Our tool works with estimates and provides conservative results. The utility billing path often reveals capacity that calculation misses.

---

## Summary

**Multi-Family EV is our beachhead market because:**

1. ✅ Highest pain (contractors turning down profitable work)
2. ✅ Highest willingness to pay ($2-10K alternatives)
3. ✅ Technical complexity creates moat
4. ✅ We already have 100% of the calculation engines built
5. ✅ Clear differentiation (NEC 220.87 measurement path)
6. ✅ Forum-validated demand

**Next priority:** Customer acquisition and feedback collection to refine the tool based on real-world usage.

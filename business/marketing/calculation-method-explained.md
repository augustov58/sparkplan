# NEC Calculation Method: What We Actually Use

**Date:** January 4, 2026
**Purpose:** Clarify calculation methodology and required inputs from contractors

---

## 🔍 The Confusion: NEC 220.87 vs. Standard Method

### What We Claimed (Incorrect Emphasis):
> "NEC 220.87 compliant with four determination methods"

### What We ACTUALLY Use:
> **NEC Article 220 Standard Method** (220.82 for residential, 220.40-220.56 for commercial)

### Why This Matters:
**NEC 220.87** is an **optional alternative method** specifically for determining existing loads when you have actual demand data (utility bills or load studies).

**NEC 220.82** is the **standard calculation method** that ALL electricians learn and use daily.

---

## 📖 NEC Code Structure Explained

### NEC Article 220: Branch-Circuit, Feeder, and Service Load Calculations

**Part III: Feeder and Service Load Calculations (Standard Methods)**
- **220.40** - General Requirements
- **220.42** - Lighting Load (general illumination)
- **220.43** - Show-Window and Track Lighting
- **220.44** - Receptacle Loads (Nondwelling Units)
- **220.50** - Motors
- **220.51** - Fixed Electric Space Heating
- **220.52** - Small-Appliance and Laundry Loads
- **220.53** - Appliance Load (Dwelling Units)
- **220.54** - Electric Clothes Dryers
- **220.55** - Electric Ranges and Cooking Appliances
- **220.56** - Kitchen Equipment (Commercial)

**Part IV: Optional Feeder and Service Load Calculations**
- **220.82** - Dwelling Unit (Residential - Standard Optional Method)
- **220.83** - Existing Dwelling Unit
- **220.84** - Multifamily Dwelling
- **220.85** - Two Dwelling Units
- **220.86** - Schools
- **220.87** - Determining Existing Loads (The one we over-emphasized!)

---

## ⚡ What NEC 220.87 Actually Is

**Purpose:** Provides an easier way to determine **existing loads** when you have actual usage data

**The Four Methods (from NEC 220.87):**

### Method 1: 12-Month Utility Billing Data
- Use actual peak demand from utility bills
- No calculations needed
- **Apply 125% multiplier** before adding new loads
- **Reality:** Contractors rarely use (customer friction, privacy concerns)

### Method 2: 30-Day Continuous Load Recording
- Install recording ammeter on service for 30 days
- Capture actual peak demand
- **Apply 125% multiplier** before adding new loads
- **Reality:** Almost never used (expensive equipment, 30-day delay)

### Method 3: Calculated from Panel Schedule
- Standard NEC 220 calculations
- Use appliance nameplates, square footage, etc.
- **Apply 125% multiplier** before adding new loads
- **Reality:** This is what 99% of contractors do!

### Method 4: Manual Entry
- User enters estimated existing load
- **Apply 125% multiplier** before adding new loads
- **Reality:** Used for quick estimates

**KEY POINT:** NEC 220.87 methods #3 and #4 STILL REQUIRE NEC 220 standard calculations! They're not alternatives to NEC 220 - they're alternatives to measuring actual demand.

---

## ✅ What We ACTUALLY Use: NEC 220.82 Standard Method

### NEC 220.82: Dwelling Unit - Standard Calculation

This is the method every electrician learns in apprenticeship and uses daily.

**Formula (Simplified):**

```
STEP 1: General Lighting and Receptacles
  = 3 VA × square footage

STEP 2: Small Appliance and Laundry Circuits
  = 3,000 VA (small appliances) + 1,500 VA (laundry) = 4,500 VA

STEP 3: Apply Demand Factor to Steps 1 & 2
  First 10,000 VA @ 100%
  Remaining @ 40%

STEP 4: Major Appliances (nameplates or estimates)
  Examples:
  - Electric range: 12,000 VA (demand factor: 8,000 VA per 220.55)
  - Electric dryer: 5,500 VA (demand factor: 5,000 VA per 220.54)
  - Electric water heater: 4,500 VA @ 100%
  - Dishwasher: 1,500 VA @ 100%

STEP 5: HVAC (largest of heating or cooling)
  - Central A/C: nameplate VA @ 100%
  - Electric heat: nameplate VA @ 100%
  (Only count the larger one)

STEP 6: Add New Load (EV Charger)
  = EV charger VA @ 100% (continuous load)

STEP 7: Convert to Amperes
  = Total VA ÷ 240V

STEP 8: Compare to Service Rating
  If Total Amps ≤ Service Rating → OK
  If Total Amps > Service Rating → Upgrade needed
```

**Source:** NEC 2023 Article 220.82

---

## 📋 What Contractors Need to Provide (Our "Quick Check" Mode)

### Minimum Required Information:

#### 1. Existing Service (30 seconds)
**Question:** "What size is your electrical service?"
- **How to find it:** "Look at the main breaker - it should say 100, 150, 200, etc."
- **Options:** 60A, 100A, 125A, 150A, 200A, 225A, 300A, 400A
- **Voltage:** 120/240V (residential), 120/208V (multi-family), 277/480V (commercial)
- **Phase:** Single-phase (1Φ) or Three-phase (3Φ)

#### 2. Home Size (10 seconds)
**Question:** "How many square feet is the home?"
- **Options:**
  - Small (< 1,500 sq ft)
  - Medium (1,500-2,500 sq ft)
  - Large (2,500-4,000 sq ft)
  - Very Large (> 4,000 sq ft)
- **Alternative:** Enter exact square footage

**Why we need this:** NEC 220.82 requires 3 VA per square foot for general lighting

#### 3. Major Appliances (60 seconds)

**Heating/Cooling:**
- ☐ Electric heat (forced air, baseboard, heat pump)
- ☐ Gas heat
- ☐ Central A/C (size: 2-ton, 3-ton, 4-ton, 5-ton)
- ☐ No A/C

**Kitchen:**
- ☐ Electric range/oven
- ☐ Gas range/oven

**Water Heating:**
- ☐ Electric water heater (size: 30, 40, 50, 80 gallon)
- ☐ Gas water heater
- ☐ Tankless electric
- ☐ Heat pump water heater

**Laundry:**
- ☐ Electric dryer
- ☐ Gas dryer

**Optional (for more accuracy):**
- ☐ Pool pump (HP: ___)
- ☐ Hot tub (Amps: ___)
- ☐ Workshop equipment (Amps: ___)
- ☐ Electric car charger (existing)

#### 4. Proposed New Load (15 seconds)

**EV Charger Selection:**
- **Option A: Choose from templates**
  - Tesla Wall Connector (48A)
  - ChargePoint Home Flex (50A)
  - JuiceBox 40 (40A)
  - Grizzl-E (40A)
  - Emporia EV Charger (48A)

- **Option B: Enter custom**
  - Charger amperage: ___ A
  - Continuous load: Yes (EV chargers run 3+ hours)

**Total time to gather info:** 2 minutes

---

## 🎯 Our Calculation Engine (Behind the Scenes)

### What Happens When Contractor Clicks "Calculate":

```typescript
// STEP 1: General Lighting (NEC 220.82(B)(1))
const generalLighting = squareFeet × 3; // VA

// STEP 2: Small Appliance + Laundry (NEC 220.82(B)(2))
const smallAppliances = 3000 + 1500; // VA

// STEP 3: Apply Demand Factor (NEC 220.82(B))
const subtotal = generalLighting + smallAppliances;
const demandedGeneralLoad =
  Math.min(subtotal, 10000) +
  Math.max(0, subtotal - 10000) × 0.40;

// STEP 4: Major Appliances with Demand Factors

// Electric Range (NEC 220.55, Table 220.55)
const rangeDemand = 8000; // VA (for typical 12kW range)

// Electric Dryer (NEC 220.54)
const dryerDemand = 5000; // VA (5.5kW nameplate × 100%)

// Water Heater (NEC 220.82(B)(3))
const waterHeaterDemand = 4500; // VA (100% demand factor)

// STEP 5: HVAC (largest of heating or cooling)
// NEC 220.82(C) - use largest load
const hvacDemand = Math.max(heatingLoad, coolingLoad);

// STEP 6: EV Charger (100% continuous)
// NEC 220.82(B)(3) - continuous loads at 100%
const evChargerDemand = evChargerAmps × 240; // VA

// STEP 7: Total Calculated Load
const totalVA =
  demandedGeneralLoad +
  rangeDemand +
  dryerDemand +
  waterHeaterDemand +
  hvacDemand +
  evChargerDemand;

// STEP 8: Convert to Amperes
const totalAmps = totalVA / 240; // For 240V service

// STEP 9: Compare to Service Rating
const utilization = (totalAmps / serviceRating) × 100;

// STEP 10: Determine Result
if (utilization <= 80%) {
  return "✅ No upgrade needed";
} else if (utilization <= 100%) {
  return "⚠️ Near capacity - verify with detailed calculation";
} else {
  return "❌ Service upgrade required";
}
```

**Result Display:**
```
✅ No service upgrade needed

Service Utilization: 78%
Current Load: 156A
With EV Charger: 186A
Service Rating: 240A (200A × 1.2 max)
Available Headroom: 54A

Recommended Circuit:
- Breaker: 60A (50A charger × 1.25 per NEC 210.19)
- Conductor: #6 AWG copper (or #4 aluminum)
- Conduit: 3/4" EMT

Next Steps:
1. Verify panel has space for 60A double-pole breaker
2. Check distance from panel to charger location
3. Calculate voltage drop if run exceeds 75 feet
```

---

## 🔍 Comparison: Our Method vs. NEC 220.87

| Aspect | NEC 220.87 (What we claimed) | NEC 220.82 (What we use) |
|--------|------------------------------|--------------------------|
| **Code Section** | Article 220, Part IV (Optional) | Article 220, Part IV (Standard Optional for Dwellings) |
| **Purpose** | Determine existing loads easier | Calculate total service load |
| **When Used** | Service upgrades (existing buildings) | New services AND upgrades |
| **Input Required** | Utility bills OR calculations | Standard electrical data (appliances, sq ft) |
| **Contractor Familiarity** | Methods 1-2 rarely used | Used daily by all electricians |
| **Accuracy** | Methods 1-2: High (actual data) | High (conservative demand factors) |
| **Speed** | Method 1-2: Slow (customer must provide bills) | Fast (standard info) |
| **NEC Compliance** | ✅ Compliant | ✅ Compliant |

**CRITICAL INSIGHT:**
- **NEC 220.87** is about **determining existing loads** (the starting point)
- **NEC 220.82** is about **calculating total loads** (including new additions)
- Most contractors use **NEC 220.82 for the whole process** (both existing + new)
- We do the same - it's faster and doesn't require utility bills

---

## ✅ What We Should Say (Corrected Messaging)

### OLD (Overcomplicated):
> "NEC 220.87 compliant service upgrade calculator with four determination methods including 12-month utility billing, 30-day load study, calculated loads, and manual entry."

### NEW (Clear & Accurate):
> "NEC 220.82 compliant load calculator. Enter basic home info (square footage, appliances) and get instant service capacity results. No utility bills needed."

### Hero Section (Updated):
**Headline:**
> "Know if they need a service upgrade in 60 seconds"

**Subheadline:**
> "NEC-compliant load calculation from basic home info. No utility bills, no load studies, no driving to the site."

**What contractors provide:**
- ✅ Service size (from breaker label)
- ✅ Square footage (from plans or estimate)
- ✅ Appliances (electric or gas?)
- ✅ EV charger size (from template or custom)

**What they DON'T need:**
- ❌ 12-month utility bills
- ❌ 30-day load study
- ❌ Nameplate data from every appliance
- ❌ Site visit

---

## 🎯 Technical Accuracy: Are We NEC Compliant?

### Question: "Is NEC 220.82 valid for service upgrades?"

**Answer: YES**

NEC 220.82 can be used for:
1. ✅ New service installations
2. ✅ Service upgrades (calculating total load after upgrade)
3. ✅ Feeder sizing
4. ✅ Panel sizing

NEC 220.87 is an **optional alternative** for determining existing loads, but it's NOT required.

### Question: "Do we need to apply the 125% multiplier?"

**Answer: It depends on WHAT you're calculating**

**For existing load determination (NEC 220.87 Method 3 or 4):**
- ✅ Apply 125% to existing calculated load
- ✅ Then add new load at 100%

**For total load calculation (NEC 220.82):**
- ❌ Do NOT apply 125% to the total
- ✅ Individual continuous loads already calculated at 100% demand
- ✅ Demand factors already built into NEC 220.82 method

**Example:**
```
NEC 220.82 Method (What we use):
  Existing load: 140A (calculated per 220.82)
  New EV charger: 50A (calculated at 100% continuous)
  Total: 190A
  Service requirement: 190A ÷ 0.8 = 237.5A → Need 300A service

NEC 220.87 Method 3 (Alternative):
  Existing load: 140A (calculated per 220.82)
  Apply 125%: 140 × 1.25 = 175A
  New EV charger: 50A
  Total: 225A
  Service requirement: 225A → Need 300A service

Both methods arrive at same conclusion: Need upgrade
```

**Our Implementation:**
We use **NEC 220.82 throughout** - no 125% multiplier needed because demand factors are already conservative.

---

## 📊 Input Requirements by Building Type

### Residential (Single-Family) - NEC 220.82
**Required:**
1. Service size (A)
2. Square footage
3. Heating type (electric/gas)
4. Cooling size (tons or kW)
5. Water heater (electric/gas)
6. Range/oven (electric/gas)
7. Dryer (electric/gas)

**Optional (for accuracy):**
- Pool pump
- Hot tub
- Workshop loads

**Calculation time:** 30 seconds

---

### Multi-Family (Apartments) - NEC 220.84
**Required:**
1. Number of units
2. Largest unit square footage
3. Cooking equipment (per unit)
4. Common area loads:
   - Elevator
   - Hallway lighting
   - HVAC
   - Laundry room

**Demand factors:**
- 3 units @ 100%
- 4-5 units @ 65%
- 6-7 units @ 50%
- 8+ units @ 40%

**Calculation time:** 2-3 minutes

---

### Commercial - NEC 220.40-220.56
**Required:**
1. Service size (A)
2. Square footage by use type:
   - Office
   - Retail
   - Warehouse
3. Lighting load (VA/sq ft or fixtures)
4. Receptacle load (VA/sq ft)
5. HVAC (nameplate data)
6. Major equipment (nameplates)

**Calculation time:** 5-10 minutes (more complex)

---

## 🚀 What This Means for Our Product

### ✅ Strengths
1. **We're 100% NEC compliant** (just using different code section than we claimed)
2. **Faster than NEC 220.87 methods** (no utility bills needed)
3. **More familiar to contractors** (NEC 220.82 is taught in every apprenticeship)
4. **Accurate and conservative** (demand factors built into code)

### ⚠️ What to Change
1. **Stop emphasizing NEC 220.87** in marketing
2. **Highlight NEC 220.82 instead** ("Standard method electricians already know")
3. **Remove "four methods" messaging** (confusing and unnecessary)
4. **Focus on speed and simplicity** ("No utility bills needed")

### 🎯 Updated Value Proposition

**Technical accuracy:**
> "NEC 220.82 compliant load calculator for residential, multi-family, and commercial installations. Uses standard calculation methods from square footage and appliance data - no utility bills required."

**Customer-facing:**
> "Know if they need a service upgrade in 60 seconds. Just enter service size, square footage, and appliances. No site visit, no utility bills, no complex calculations."

---

## 📚 Code References

- **NEC 2023 Article 220** - Branch-Circuit, Feeder, and Service Calculations
- **NEC 220.82** - Dwelling Unit (Standard Optional Method)
- **NEC 220.84** - Multifamily Dwelling
- **NEC 220.87** - Determining Existing Loads (optional alternative)
- **NEC 210.19(A)** - Conductor sizing for continuous loads (125% rule)
- **NEC 625.41-625.44** - Electric Vehicle Supply Equipment (EVSE)

---

**Document Version:** 1.0
**Last Updated:** January 4, 2026
**Technical Review:** Required before marketing materials updated
**Status:** Draft - Needs validation

# EV Installer Niche: Online Forum Research Findings

**Research Date**: 2026-01-16
**Sources**: Mike Holt Forums, Electrician Talk, Reddit (partial), Industry blogs

---

## Executive Summary

**VERDICT: STRONG VALIDATION** - The EV installer niche shows significant pain points that SparkPlan directly solves. Professional electricians are:
- Confused about NEC load calculations for EV chargers
- Turning down profitable work due to calculation complexity
- Getting inspection failures they don't know how to resolve
- Struggling with multi-family/condo scenarios
- Dealing with slow utility coordination

---

## Key Pain Points Discovered

### 1. Load Calculation Confusion (CRITICAL)

**Mike Holt Forum - "EV charger load calc" thread**
> "It is an existing house with a 200amp panel and the inspector wants a load calculation because we are adding a EV charger. **How would you do something like this?**"
> — ElecBolt12, NJ Electrician

**Response from Tom Baker (First Chief Moderator & NEC Expert)**:
> "Tip #1 use the alternate calculation
> Tip #2 see the examples in the annex
> Tip #3 take pictures of nameplates for HVAC, Dryer, range, etc"

**Key Quote - ramsy (Service Electrician)**:
> "There is 'A Pocket Guide to All-Electric Retrofits of Single-Family Homes' with some interesting ways to avoid service upgrades with clever load calcs."

**Pain Point**: Electricians don't know the standard vs. optional calculation methods, and are searching for workarounds.

---

### 2. "I Don't Even Know Where to Start" (CRITICAL)

**Mike Holt Forum - "EV Chargers Service Calculation" thread (July 2024)**
> "What size service I will need for 4 48amp ev chargers. It's for an apartment complex... **I don't even know where to start. I know how to do dwelling load calculation, but this is a little different**"
> — jimjones, Electrician, Kathleen, GA

**Discussion showed**:
- Confusion about 125% continuous load requirement
- Confusion about whether demand factors apply (they DON'T for EV per 220.53(5))
- 3-phase balancing math is complex (1.73 factor)
- Questions about 208V vs 240V charger behavior

**Exact NEC references discussed**:
- 220.57 - EVSE Load (7200VA or nameplate, whichever larger)
- 625.42 - Rating (continuous loads, EVEMS provisions)
- 220.53 - Appliance Load (demand factor SHALL NOT apply to EVSE)

---

### 3. Multi-Family/Condo = Nightmare Scenario (CRITICAL)

**Electrician Talk - "Condo EV chargers" thread (Jan 2025)**
> "I have a condo that has 35 units, and they want to install EV Chargers so each tenant has to pay for their own charge. It's impossible to run from the panels because they are located in each condo... **I really don't know what to do**"
> — morg123452000, 235 posts

**Another electrician's response**:
> "I've been through this MANY times now. The answer for you, unfortunately, is **you can't. There is no FEASABLE / REASONABLE answer for your problem.**"
> — power, 1,163 posts

**Real-world example from RAD COM (Jan 2025)**:
- 40-unit condo complex, installed 6 chargers over 8 years
- Condo board STILL hasn't figured out billing
- Quote received: **$100K+ for load management system**
- Concerns about coring through slab near 4kV feeders

---

### 4. Transformer Capacity = Ticking Time Bomb

**Mike Holt Forum - herding_cats**:
> "I see these EV questions and threads a lot. **Nobody is first looking into seeing if the primary transformer can handle the load.** This is the first thing to look into before assuming or adding a bunch of EV circuits. **There was a transformer fire in an apartment building complex after they added a bunch of EV chargers in Florida a few months ago.**"

**brycenesbitt (Senior Member)**:
> "The Pocos don't share the secondary and transformer loads willingly in my areas: they reserve the exclusive right to size them. So nobody can 'check' - they have to go through a **multi-week and highly variable process** for a new load directly with an insane bureaucracy."

---

### 5. Inspection Failures & Permit Issues

**Electrician Talk - "EV charger in a townhouse unit" thread (BC, Canada)**:
> "Permit got issued, rough wire passed (EV and EVEMS installed already at this time) then came final inspection and now **the inspector is requiring an accurate main service load calc**."
> — Dig Deeper, Discussion starter

**Inspector's response**:
> "You are required to perform a load calculation for the service not just for the dwelling unit. The installation of the product you attached when installed in the dwelling unit **does not reduce the load on the main service**."

**Result**: Contractor stuck - can't get load data from other units in the complex.

---

### 6. Contractors TURNING DOWN WORK

**Electrician Talk - deltasparky (Aug 2024)**:
> "We've **stopped installing multi unit ac's and chargers** until next year when stratas are required to have hired an engineering firm to calculate the complexes current demand...
> We can do it but usually tell them it's **$2-10k to calculate the demands** depending on the number of units and that won't even guarantee we will be able to install their equipment after. **Zero customers have been willing to pay so far.**"

**Sabba (Mar 2025)**:
> "I just **turned down an EV charger install** in a 100A townhouse unit for this exact reason."

---

### 7. NEC Code Confusion Is Rampant

**Mike Holt Forum - "Residential Calculations" thread (Sept 2025)**:
> "For dwelling unit calculations, **is an EVSE load required?** My understanding is that it is required. Am I in error?"
> — xformer, Master Electrician, Dallas, TX

**Debate in thread**:
- 220.57 requires 7200VA OR nameplate (whichever higher) IF you install EVSE
- But NEC doesn't REQUIRE you to include EV in base calculation
- State codes may differ (Illinois requires 40A space for each dwelling)
- Confusion between 2020, 2023, 2026 NEC editions

**brycenesbitt's innovative approach**:
> "I calculate EVSE load at Zero VA... it's better at zero, which just requires installing equipment to ensure the EVSE is either non-coincident, or dynamically limited."

---

### 8. Service Upgrade = Expensive Last Resort

**Mike Holt Forum - 5,000 sq ft house thread**
- User wants EV charger + tankless water heater + pool + solar
- Calculated load: 185-196A on 200A service
- Options discussed: load shedding, circuit sharing devices, service upgrade

**Cost concern**: Service upgrades are expensive and often require utility coordination, trenching, and significant labor.

---

## Quantified Pain Points

| Pain Point | Frequency in Forums | Severity | Our Solution |
|------------|---------------------|----------|--------------|
| Load calculation confusion | VERY HIGH | Critical | Automated calculations |
| Multi-family service calc | HIGH | Critical | Service Upgrade Wizard |
| Inspection failures | MEDIUM | High | Pre-inspection audit + PDF export |
| Utility coordination | MEDIUM | High | Documentation for utility |
| 3-phase balancing | MEDIUM | Medium | EVEMS Calculator |
| NEC code version confusion | HIGH | Medium | Edition-aware calculations |
| Turning down profitable work | HIGH | Critical | Makes complex jobs accessible |

---

## Competitor Analysis from Forums

**Tools mentioned by electricians**:
1. **DCC-9 / DCC-12** (RVE USA) - Load management device, ~$500-800
2. **BlackBox** - Load management device
3. **EmonDemon** - Sub-metering, ~$4K hardware + $10K software
4. **NeoCharge, Dryer Buddy, SplitVolt, SimpleSwitch** - Circuit sharing plugs
5. **Listo EMS** - Multi-unit load management (mentioned once)

**What they're NOT mentioning**:
- Any comprehensive NEC compliance calculation software
- Automated load calculation tools
- Permit packet generators
- One-line diagram generators

---

## Validation Scorecard

Based on Alex Becker's "Find Breakage" framework:

| Criteria | Score | Evidence |
|----------|-------|----------|
| **Waste identified** | 10/10 | Contractors turning down jobs, paying $2-10K for engineering calcs |
| **Scale blocker identified** | 10/10 | "No feasible answer" for multi-family scenarios |
| **Money on the table** | 9/10 | $100K+ quotes for load management, lost jobs |
| **Pain is CURRENT** | 10/10 | Threads from Jan 2025 - active problem |
| **Professionals seeking help** | 10/10 | Master electricians asking basic questions |

---

## Recommended Next Steps

### Immediate Actions

1. **Niche down further**: Focus on multi-family EV charging specialists
   - These are the "freak out if you take it away" customers
   - Highest pain, highest willingness to pay

2. **Pricing validation needed**:
   - Engineering firms charging $2-10K for load calcs
   - If we can automate this, $500-1,000/project is justified
   - Monthly subscription for unlimited calcs could be $200-500/month

3. **Feature priorities confirmed**:
   - ✅ Service Upgrade Wizard (EVEMS/220.87) - CRITICAL
   - ✅ Load calculation automation - CRITICAL
   - ✅ PDF export for inspectors/utilities - CRITICAL
   - ❓ Multi-unit building service calc - NEW PRIORITY

### Validation Interview Questions (Mom Test)

Based on forum pain points, ask potential customers:

1. "Tell me about the last EV charger job you turned down."
2. "What happened at your last EV charger inspection?"
3. "How do you currently calculate service loads for multi-unit buildings?"
4. "How much time do you spend on load calculations vs actual installation?"
5. "What would happen if you could do load calcs in 5 minutes instead of 2 hours?"

### High-Value Target ICPs (from forum data)

1. **Electrical contractors doing multi-family EV** - Highest pain, complex jobs
2. **Contractors in jurisdictions with strict inspection** - Need documentation
3. **Contractors approaching service capacity limits** - Need load management sizing

---

## Raw Data Sources

### Mike Holt Forums (forums.mikeholt.com)
- "EV charger load calc" - https://forums.mikeholt.com/threads/ev-charger-load-calc.2569134/
- "EV Chargers Service Calculation" - https://forums.mikeholt.com/threads/ev-chargers-service-calculation.2582188/
- "Residential Calculations" - https://forums.mikeholt.com/threads/residential-calculations.2588979/
- "Electrical Load Calculations / Panel Size" - https://forums.mikeholt.com/threads/electrical-load-calculations-panel-size.2576612/
- "200-amps for 5,000 sq ft house" - https://forums.mikeholt.com/threads/200-amps-for-5-000-sq-ft-house.138045/

### Electrician Talk (electriciantalk.com)
- "Condo EV chargers" - https://www.electriciantalk.com/threads/condo-ev-chargers.303158/
- "EV charger in a townhouse unit - main service load calc" - https://www.electriciantalk.com/threads/ev-charger-in-a-townhouse-unit-main-service-load-calc-bc.300759/

### Reddit (403 blocked but snippets captured)
- r/electricians - "EV charger installations becoming a big headache" (Jan 2024)
- r/electricians - "Failed inspection for not putting a sticker on charge point EV charger"
- r/electricians - Various permit/inspection discussion threads

---

## Conclusion

**The EV installer niche is VALIDATED.** Forum research shows:

1. ✅ **Clear pain** - Electricians are confused, frustrated, and turning down work
2. ✅ **Money involved** - $2-10K engineering quotes, $100K+ system quotes
3. ✅ **Recurring problem** - New threads appear regularly (2024-2025)
4. ✅ **No good solution** - They're asking peers, not using software
5. ✅ **Our features match** - Load calcs, service upgrade, EVEMS, PDF export

**Next step**: Conduct 5-10 Mom Test interviews with EV-focused electrical contractors to validate pricing and prioritize features.

---

*Research compiled from online forum scraping on 2026-01-16*

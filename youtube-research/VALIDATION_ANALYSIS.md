# NEC Pro Compliance - Validation Analysis

**Date:** January 15, 2026
**Purpose:** Compare YouTube research insights against STRATEGIC_ANALYSIS.md and identify validation gaps

---

## 1. CRITICAL GAPS IDENTIFIED

### Gap #1: Niche Depth (Alex Becker's 3-Level Rule)

**Current Strategy:**
> "EV Charging Installers" → 50,000+ installers

**Problem:** This is only Level 2 niching. Becker says go to Level 3.

| Level | Your Current | Should Be |
|-------|--------------|-----------|
| 1 | Electricians | Electricians |
| 2 | EV Installers | EV Installers |
| 3 | ❌ Missing | **ChargePoint-certified commercial fleet installers in California** |

**Why Level 3 Matters:**
- At Level 2, you compete with 10+ other tools
- At Level 3, you're the ONLY solution for that exact problem
- Becker: "The secret is having a hot dog stand in a desert"

**Potential Level 3 Niches:**
1. **Tesla Wall Connector certified installers** doing 10+/week
2. **Commercial fleet EV installers** (Amazon, FedEx, utilities)
3. **Multi-family EV infrastructure installers** (parking garages)
4. **California EV installers** (strictest codes, highest volume)

---

### Gap #2: No Customer Validation (Becker's "Do Things That Don't Scale")

**Current Strategy:**
> "You're 95% feature-complete for this market. No major dev work needed."

**Problem:** Built product BEFORE validating with paying customers.

**What Becker/Andre Say:**
- Install for FREE for 10-50 customers first
- Get results, THEN bill
- "There's no reason to be billing upfront other than the need for cash flow"
- Stripe installed for free for first 50 users before charging

**What's Missing:**
- Zero paying customers mentioned
- Zero testimonials with real metrics
- Zero case studies showing actual time saved
- Zero evidence that EV installers will pay

**The PMF Test (Becker):**
> "Do you have 20-50 customers who would freak out if you turned off your product?"

**Honest Answer:** No. The product hasn't been validated with real users.

---

### Gap #3: Pricing Way Too Low (Value-Based Pricing Failure)

**Current Strategy:**
| Metric | Current | Problem |
|--------|---------|---------|
| Annual Price | $588/year ($49/mo) | |
| Value Created | $45,000-143,000/year | Per STRATEGIC_ANALYSIS |
| ROI Claimed | 77-243x | |
| Value Capture | **0.4-1.3%** | Should be 10-20% |

**What This Means:**
- If the value is REAL → You're leaving $4,000-14,000/year on the table
- If no one will pay $4,000/year → The value isn't as real as claimed

**Becker's Pricing Rule:**
> "If you're making them an extra $50K/month, you can easily bill $2K/month"

**Applied to NEC Pro:**
- Claimed savings: $45K-143K/year
- Should charge: $4,500-14,300/year (10% of value)
- That's **$375-1,200/month**, not $49/month

**The Real Question:**
Will EV installers pay $500/month? If not, either:
1. The value isn't as high as estimated, OR
2. The pain isn't acute enough, OR
3. It's the wrong niche

---

### Gap #4: No "Freak Out" Test

**Becker's Definition of PMF:**
> "20-50 customers who would actively freak out if you turned off your product"

**Test to Run:**
- Turn off product for 30 minutes
- Do customers pound on the door?
- Do they demand you turn it back on?

**Current Reality:**
EV installers have survived for years with:
- Pencil and paper
- Mike Holt worksheets
- Excel spreadsheets
- Guessing (and sometimes getting change orders)

**The Hard Truth:**
They might appreciate NEC Pro, but would they "freak out" if it disappeared? Probably not. This suggests:
- Pain isn't acute enough, OR
- Solution isn't differentiated enough, OR
- We're targeting the wrong segment

---

### Gap #5: No Signal Loop (YouTube vs Quibi Lesson)

**Current Strategy:**
Lots of features built, but no feedback loop:
- No usage analytics mentioned
- No customer interviews documented
- No iteration based on real user behavior

**What Should Exist:**
- Weekly calls with 10 beta users
- Usage tracking (which features do they actually use?)
- NPS scores
- Churn analysis (why do people leave?)

---

## 2. VALIDATION FRAMEWORK

### Step 1: Find the Starving Crowd (Online Research)

**Where to Look:**

| Platform | What to Search | What to Look For |
|----------|----------------|------------------|
| **Facebook Groups** | "EV Charging Installers", "ChargePoint Installers", "Tesla Certified Electricians" | Complaints about service upgrades, permit delays, quotes |
| **Reddit** | r/electricians, r/evcharging, r/solar | Questions about NEC 220.87, load calculations, service sizing |
| **Mike Holt Forum** | "EV charger" + "service upgrade" | Technical questions, pain points, frustrations |
| **LinkedIn** | "EV installer" OR "ChargePoint certified" | Company profiles, job posts, content about challenges |
| **Google Trends** | "service upgrade calculator", "EV charger permit" | Search volume, trending up or down? |
| **YouTube Comments** | NEC 220.87 tutorial videos | What questions do people ask? |

**Specific Searches to Run:**
1. `site:reddit.com "EV charger" "service upgrade" pain`
2. `site:mikeholt.com "220.87" "EV" difficult`
3. Facebook: Search "EV installer" groups → look for posts about quotes, permits, change orders

**What You're Looking For:**
- People actively complaining about manual calculations
- Questions about NEC 220.87 + EV charging specifically
- Stories about lost jobs due to bad quotes
- Change order horror stories
- "I wish there was a tool that..."

---

### Step 2: The "Mom Test" Interviews (Direct Outreach)

**Target:** 20 high-volume EV installers (5+ installs/week)

**How to Find Them:**
1. ChargePoint installer directory
2. Tesla certified installer list
3. Wallbox partner network
4. LinkedIn search: "EV installation" + "owner" OR "operations"
5. Google Maps: "EV charger installation" in major metro areas

**Cold Outreach Script (LinkedIn/Email):**

```
Subject: Quick question about your EV installation process

Hey [Name],

I saw you're doing EV charger installations in [City]. Quick question:

When you quote a job that needs a service upgrade, how long does it take you to figure out if the existing service can handle the load?

I'm researching pain points for EV installers and trying to understand the bottlenecks.

Thanks,
[Your name]
```

**Interview Questions (The Mom Test - No Pitching):**

1. "Walk me through your last EV installation quote from start to finish"
2. "How do you currently determine if a service upgrade is needed?"
3. "How long does that analysis take?"
4. "Have you ever lost a job because your quote was too high?"
5. "Have you ever had a change order because you undersized the service?"
6. "How much did that cost you?"
7. "What tools do you currently use for load calculations?"
8. "What's the most frustrating part of the quoting process?"

**DO NOT:**
- Pitch your product
- Ask "would you use a tool that..."
- Lead the witness

**DO:**
- Listen for pain
- Note specific dollar amounts
- Ask follow-up questions on pain points
- Record exact quotes

---

### Step 3: The "Done-For-You" Test (Becker's Stripe Method)

**Offer:**
> "I'll run your next 5 service upgrade calculations completely free. No strings attached. I just want to see if my method is faster than yours."

**What to Track:**
- Time it takes you vs. their current method
- Accuracy (did your calculation match reality?)
- Their reaction when they see the output
- Whether they ask "how can I get this all the time?"

**Success Criteria:**
- If they eagerly accept → Pain is real
- If they say "nah, I'm fine" → Pain isn't acute
- If they ask about price after seeing results → Ready to convert

---

### Step 4: Pricing Discovery

**Never Say Your Price First**

**Question to Ask:**
> "If I could guarantee you accurate service upgrade quotes in 15 minutes instead of 2-3 hours, and you never lost another job to a bad quote or faced a change order from undersizing... what would that be worth to you?"

**Interpretation:**
| Their Answer | What It Means |
|--------------|---------------|
| "$50-100/month" | Pain isn't acute, wrong niche |
| "$200-300/month" | Moderate pain, might work at scale |
| "$500-1000/month" | Strong pain, good niche |
| "$2000+/month" | Acute pain, jackpot niche |

**Follow-Up:**
> "What if I charged $500/month with a guarantee - if you don't save at least 10 hours that month, you don't pay?"

---

## 3. PRICING ANALYSIS: WHAT CAN WE ACTUALLY CHARGE?

### Current Pricing Problem

**STRATEGIC_ANALYSIS Claims:**
- Time saved: 455-1,430 hours/year
- Value at $100/hr: $45,500-143,000/year
- Price: $588/year
- ROI: 77-243x

**Reality Check:**
If ROI is 77-243x, why would anyone NOT buy this? Something doesn't add up.

**Possibilities:**
1. The time savings are exaggerated
2. The $100/hr rate is too high (maybe $50-75/hr is more realistic)
3. Not all installers are "high-volume" (5-10/week)
4. Manual calculations don't actually take 2-3 hours

---

### Revised Value Calculation (Conservative)

**Assumptions:**
- Average EV installer: 2-3 jobs/week (not 5-10)
- Service upgrade analysis: 1-2 hours (not 2-3)
- Effective rate: $60/hr (not $100)

| Metric | Optimistic | Realistic | Conservative |
|--------|------------|-----------|--------------|
| Jobs/month | 40 | 12 | 8 |
| Service upgrade % | 70% | 50% | 40% |
| Analysis per job (hours) | 2.5 | 1.5 | 1.0 |
| Hours saved/month | 70 | 9 | 3.2 |
| Value at $60/hr | $4,200 | $540 | $192 |
| 10% value capture | $420/mo | $54/mo | $19/mo |

**Insight:** At realistic assumptions, current $49/mo pricing might actually be correct for AVERAGE installers. But for HIGH-VOLUME installers (5-10/week), you could charge $300-500/mo.

---

### Tiered Pricing Strategy (Based on Volume)

| Tier | Target | Jobs/Month | Value/Month | Price | Value Capture |
|------|--------|------------|-------------|-------|---------------|
| **Starter** | Low-volume (side work) | 4-8 | $192-384 | $49/mo | 13-26% |
| **Pro** | Medium-volume | 8-16 | $384-768 | $149/mo | 19-39% |
| **Enterprise** | High-volume specialists | 20-40 | $960-1,920 | $499/mo | 26-52% |

**Key Insight:**
- Don't lower price → raise value for high-volume users
- Create an "Enterprise" tier at $499/mo for 5+ installs/week shops
- Include: priority support, custom reports, API access, dedicated CSM

---

### What Would Justify $500+/Month?

**Current Features:**
- Service Upgrade Wizard (NEC 220.87) ✅
- EVEMS Calculator (NEC 625.42) ✅
- Permit Packet Generator ✅
- AI Inspector Mode ✅

**Additional Value to Justify $500/mo:**

| Feature | Value Add | Development |
|---------|-----------|-------------|
| **Done-For-You Quote Service** | We run the calc, send you the report within 1 hour | Operations cost |
| **Permit Concierge** | We fill out the permit application for you | Operations cost |
| **Guaranteed Accuracy** | If permit fails inspection due to our calc, we pay re-inspection fee | Insurance cost |
| **Utility Interconnection Forms** | Auto-generate PG&E, SCE, SDG&E paperwork | 8-10 hrs dev |
| **White-Label Reports** | Your branding, professional deliverables for customers | Already built |
| **Slack/SMS Support** | Real-time help during job site visits | Operations cost |
| **Exclusive Jurisdiction Database** | Pre-filled requirements for 500+ jurisdictions | Data collection |

**The Key:** High-volume installers will pay $500/mo for SERVICE, not just software. They want someone to handle the paperwork so they can focus on installations.

---

## 4. ALTERNATIVE NICHES TO CONSIDER

If EV installer validation fails, consider these:

### Option A: Commercial Fleet EV Installers

**Why:**
- Bigger projects ($50K-500K vs $2K-5K)
- More complexity (EVEMS required, utility coordination)
- Fewer competitors
- Higher willingness to pay

**Pain Points:**
- Multiple chargers, load management mandatory
- Utility demand charges
- Peak shaving requirements
- Complex permit packages

**Pricing Potential:** $1,000-2,500/month per project

---

### Option B: Solar + Storage Installers

**Why:**
- Battery storage adds NEC 706 complexity
- Existing EV installer overlap (30-40%)
- Higher project values ($25K-45K)

**Gap:** Need battery storage calculator (15-20 hrs dev)

---

### Option C: Electrical Engineers at Small Firms (2-5 person)

**Why:**
- Do 20-50 projects/year (not episodic like large firms)
- Can't afford ETAP/SKM ($10K-50K/year)
- Need professional deliverables

**Pricing Potential:** $299-499/month (team license)

---

### Option D: The "Permit Mill" - High-Volume Permit Expeditors

**Profile:**
- Companies that specialize in pulling permits for contractors
- Do 50-200 permits/month
- Time is money - every minute saved = profit

**Why This Could Be Goldmine:**
- Highest volume users possible
- Clear ROI (time = money)
- Would pay for speed and accuracy

**Pricing Potential:** $500-1,000/month

---

## 5. RECOMMENDED NEXT STEPS

### Week 1: Online Research (Validate Pain Exists)

**Day 1-2:**
- [ ] Join 5 Facebook groups (EV Charging Installers, ChargePoint Partners, etc.)
- [ ] Search for pain point posts, screenshot the best ones
- [ ] Note: How many people complain about service upgrades? Permit delays?

**Day 3-4:**
- [ ] Reddit deep dive: r/electricians, r/evcharging
- [ ] Search: "service upgrade" + "EV" + (pain OR frustrating OR difficult)
- [ ] Document: Specific complaints, dollar amounts mentioned

**Day 5:**
- [ ] Mike Holt Forum search
- [ ] LinkedIn research: Find 50 high-volume EV installer profiles
- [ ] Google Trends analysis

**Deliverable:** Pain Point Evidence Document (screenshots, quotes, links)

---

### Week 2: Direct Outreach (Validate Willingness to Pay)

**Day 1-2:**
- [ ] Write cold outreach scripts (LinkedIn, email)
- [ ] Create list of 50 target installers

**Day 3-7:**
- [ ] Send 10 messages/day
- [ ] Goal: 10 conversations booked
- [ ] Use Mom Test questions (no pitching)

**Deliverable:** Interview notes from 10+ EV installers

---

### Week 3: Done-For-You Test (Validate Product Fit)

- [ ] Offer free service upgrade calculations to 5 installers
- [ ] Track time saved, accuracy, reaction
- [ ] Ask pricing discovery question after delivering value

**Deliverable:** 5 case studies with real metrics

---

### Week 4: Decision Point

**If Validation Succeeds (5+ willing to pay $200+/month):**
- Create "EV Pro" landing page
- Launch at $149-299/month (not $49)
- Offer 90-day guarantee
- Get 10 paying customers

**If Validation Fails (no one will pay $200+/month):**
- Test alternative niches (commercial fleet, solar+storage, permit expeditors)
- Or pivot to done-for-you service model
- Or acknowledge this market isn't ready

---

## 6. THE HARD QUESTIONS

Before proceeding, honestly answer these:

### Question 1: Is the Pain Acute?
> "Would EV installers freak out if this tool disappeared?"

If the answer is "probably not" → the pain isn't acute enough. Find a market where people are desperate for a solution.

### Question 2: Are You Solving a Real Problem?
> "Do EV installers actually spend 2-3 hours on service upgrade calculations?"

Talk to 10 installers. If most say "nah, it takes me 30 minutes" → the value prop collapses.

### Question 3: Can They Afford It?
> "Can a solo EV installer afford $200-500/month?"

If their profit margin on a $2,500 job is $500, they might not pay $500/month for software. Find customers with bigger margins.

### Question 4: Is the Market Big Enough?
> "How many HIGH-VOLUME EV installers actually exist?"

STRATEGIC_ANALYSIS says 5,000-7,500. If it's actually 500-1,000, the TAM is too small.

### Question 5: Why Would They Choose You Over Excel?
> "What does NEC Pro do that a spreadsheet can't?"

The AI features are the differentiator. But do EV installers actually care about AI? Or do they just want the answer fast?

---

## 7. PRICING RECOMMENDATION

### Don't Lower Price → Raise Value

**Current:** $49/mo for everyone
**Problem:** Underprices for high-volume, overprices for low-volume

**Recommended Pricing:**

| Tier | Price | Target | What They Get |
|------|-------|--------|---------------|
| **Free** | $0 | Lead gen | 3 calcs/month, basic features |
| **Starter** | $49/mo | 4-8 jobs/month | All calculators, 10 permits/month |
| **Pro** | $149/mo | 8-20 jobs/month | Unlimited, AI Inspector, jurisdiction wizard |
| **Enterprise** | $499/mo | 20+ jobs/month | Everything + priority support + SLA + API |

**The Key:**
- $49 is fine for low-volume
- $149-499 is justified for high-volume IF you prove the value
- But you need to VALIDATE this with real conversations

---

### Ultimate Pricing Test

Ask 10 high-volume EV installers:

> "If I could save you 20 hours/month on service upgrade analysis, and you never lost another job to a bad quote, what would you pay?"

Document their answers. That's your pricing ceiling.

---

## 8. CONCLUSION

### What STRATEGIC_ANALYSIS Gets Right:
- EV installers ARE a good potential niche
- The features ARE relevant to their workflow
- The value proposition MAKES SENSE on paper

### What STRATEGIC_ANALYSIS Gets Wrong:
- Assumed PMF without validation
- Priced based on theory, not customer conversations
- Didn't validate the 2-3 hour time savings claim
- Didn't talk to actual customers about willingness to pay

### The Path Forward:
1. **Validate before building more** - Talk to 20 EV installers
2. **Prove the time savings** - Do 5 free calculations, measure real time saved
3. **Test pricing elasticity** - Ask what they'd pay, don't assume
4. **Find the starving crowd** - Look for people DESPERATE for a solution

**The Bottom Line:**
> "You can have the best product in the world. If nobody wants to pay for it, you have nothing."

Validate first. Then build.

---

## 9. FORUM RESEARCH FINDINGS (January 16, 2026)

### Online Research Completed

Full forum scraping completed across Mike Holt Forums, Electrician Talk, and Reddit. See `FORUM_RESEARCH_FINDINGS.md` for complete data.

### Key Validated Pain Points

| Pain Point | Evidence | Frequency |
|------------|----------|-----------|
| **"I don't know how to do EV load calculations"** | Master electricians asking basic questions | VERY HIGH |
| **Contractors turning down profitable work** | "We've stopped installing multi unit chargers" | HIGH |
| **Multi-family = impossible** | "There is no FEASABLE answer for your problem" | HIGH |
| **$2-10K engineering quotes** | Contractors paying or walking away | MEDIUM |
| **Inspection failures** | Permits issued, finals fail for missing calcs | MEDIUM |
| **Utility coordination nightmare** | "Multi-week and highly variable process" | MEDIUM |

### Multi-Family EV: The Highest-Pain Niche

**The Core Insight:** Multi-family EV contractors are turning down $10,000-$50,000 jobs because they can't produce the paperwork inspectors require.

**What's blocking them:**
1. Can't access other units to inventory loads
2. Don't have original building plans/load calcs
3. Don't know how to do NEC 220.84 (multi-unit) calculations
4. Complex math with demand factors, diversity factors
5. 3-phase balancing calculations
6. EVEMS sizing requirements (NEC 625.42)

**The Opportunity:** Most contractors don't know NEC 220.84 allows massive demand factor reductions:
- First 3 units: 45% demand factor
- Units 4-42: 35% demand factor
- Units 43+: 25% demand factor

This means a 35-unit building:
- Naive calculation: 35 × 100A = 3,500A needed
- NEC 220.84 method: ~1,400A actual demand

**Contractors are concluding "impossible" when "feasible" is the correct answer.**

### Proposed Solution: Multi-Family EV Readiness Calculator

**Product Vision:** Turn a $10K engineering bottleneck into a $500, 30-minute workflow.

| Current State | Our Solution |
|---------------|--------------|
| Contractor turns down job | Contractor bids confidently |
| $2-10K engineering fee | $500 one-time or $299/mo subscription |
| 2-4 week wait for engineer | 30-minute self-service |
| Often "no feasible answer" | Always get clear yes/no/maybe with path forward |

**What the tool would calculate:**
1. Existing service capacity analysis (using NEC 220.84 with assumptions)
2. EV load scenarios (with/without EVEMS)
3. EVEMS sizing requirements per NEC 625.42
4. Risk assessment (Red/Yellow/Green)
5. Utility coordination package

**Output: Permit-Ready Package**
- Cover Sheet (Project summary)
- Service Load Calculation (NEC 220.84)
- EV Load Analysis (NEC 625, 220.57)
- EVEMS Specification (if applicable)
- One-Line Diagram (showing EV additions)
- Utility Coordination Letter
- Inspector Notes (code references)

### Validation Approach: "Do Things That Don't Scale"

**Phase 1: Concierge Service (Validate Demand)**
- Offer to produce the Multi-Family EV Package manually
- Price: $500-1,500 per building (vs $2-10K from engineering)
- We do the calculations using our existing tools
- Time investment: 2-4 hours per project
- Goal: Complete 10-20 projects to understand edge cases

**Phase 2: Guided Self-Service**
- Build the automated tool based on Phase 1 learnings
- Price: $99-199 per project OR $299-499/month subscription

**Phase 3: Full Self-Service**
- Fully automated, no human review needed
- Price: $49-99 per project OR subscription tier

### Mom Test Interview Questions

For multi-family EV contractors:

1. "Tell me about the last multi-family EV project you quoted."
2. "What happened when you tried to get the service load calculation?"
3. "How much did you quote for the engineering portion?"
4. "Did you win or lose that job? Why?"
5. "What would you pay for a tool that generated the permit package in 30 minutes?"
6. "Would you pay $500 one-time or $300/month for unlimited projects?"

### Niche Refinement

Based on forum research, refine Level 3 niche from:
- ❌ "EV Charging Installers" (too broad)
- ✅ "Multi-Family EV Infrastructure Specialists" (highest pain, highest value)

**Why this niche works:**
- Contractors turning down work = acute pain
- Engineering firms charging $2-10K = price anchor
- "No feasible answer" = opportunity for us to BE the answer
- We already have 90% of the calculation engines built

---

## 10. UPDATED STRATEGIC RECOMMENDATIONS

### Immediate Priority: Multi-Family EV Calculator

**Development Required:**
- Combine existing Service Upgrade Wizard + EVEMS Calculator + NEC 220.84
- Add multi-unit estimation interface
- Generate utility coordination letter template
- Package outputs into professional PDF

**Estimated Effort:** 15-25 hours (most components already exist)

**Pricing Strategy:**
- Phase 1: $500-1,500 per project (done-for-you)
- Phase 2: $299-499/month subscription (self-service)
- This is 10-20x higher than current $49/month

### Updated Pricing Philosophy

**Forum research revealed:**
- Engineering firms charging $2,000-$10,000 for load calcs
- Contractors willing to pay OR turning down work entirely
- $100K+ quotes for load management systems in multi-unit buildings

**Conclusion:** Our $49/month pricing is validated for single-family EV work, but multi-family EV work justifies $200-500/month or per-project pricing.

### Feature Development Priority (Revised)

| Priority | Feature | Justification |
|----------|---------|---------------|
| 🥇 1 | Multi-Family EV Calculator | Highest pain, highest willingness to pay |
| 🥈 2 | NEC 220.84 estimation mode | Enables calcs without unit access |
| 🥉 3 | Utility coordination letters | Speeds up POCO approval |
| 4 | EVEMS equipment database | Product-specific recommendations |
| 5 | Transformer capacity estimator | Address utility coordination pain |

### Next Steps

1. **This Week:** Find 5 contractors who have bid on multi-family EV projects
2. **Next Week:** Conduct Mom Test interviews
3. **Week 3:** If validated, offer done-for-you service at $500-1,500
4. **Month 2:** Build automated tool based on learnings
5. **Month 3:** Launch Multi-Family EV Calculator as premium tier

---

## 11. NEC 220.87 - CALCULATION VS MEASUREMENT (January 21, 2026)

### Critical Discovery: Two Paths to Determine Existing Load

**NEC 220.87** provides two methods for determining existing building demand when adding new loads (like EV charging):

| Method | NEC Reference | Data Source | Multiplier | Result |
|--------|--------------|-------------|------------|--------|
| **Measurement** | 220.87(A) | Utility bills or 30-day load study | None | More favorable |
| **Calculation** | 220.87(B) | Article 220 calculations | 125% | More conservative |

### Why This Matters

**The measurement path often shows MORE available capacity than calculation:**

1. **NEC 220.84 calculations are conservative by design**
   - Assume all appliances running simultaneously
   - Include safety margins for worst-case scenarios
   - Result: Calculated demand often 2-3x actual usage

2. **Utility billing data reflects reality**
   - Shows what the building actually uses
   - Accounts for vacancy, efficiency improvements, behavioral patterns
   - 15-minute interval demand data is most accurate

3. **For EV charging capacity analysis:**
   - A building calculated at 400A demand might only use 180A peak
   - This means 220A of capacity for EV charging vs 0A using calculation
   - **Contractors are concluding "impossible" when "feasible" is correct**

### What Cities Typically Require

Based on forum research and jurisdictional analysis:

| Jurisdiction Type | Calculation Accepted? | Utility Data Accepted? | Preference |
|-------------------|----------------------|------------------------|------------|
| **Major metros** (LA, NYC, SF) | Yes | Yes | Either |
| **Suburban/mid-size** | Yes | Yes (with documentation) | Calculation |
| **Rural** | Yes | Rarely requested | Calculation |
| **California (Title 24)** | Yes | Yes | Either |

**Key Insight:** Most AHJs accept EITHER method. The measurement path is underutilized because:
- Contractors don't know it exists
- Utility data can be hard to obtain
- It requires explaining the approach to inspectors

### Feasibility Analysis: What Data Can Contractors Obtain?

| Data Needed | Feasibility | Notes |
|-------------|------------|-------|
| **Dwelling unit count** | ✅ Easy | Visual count, HOA records |
| **Average unit square footage** | ⚠️ Medium | May need property records or estimation |
| **Existing service size** | ✅ Easy | Read meter/main breaker |
| **Voltage/Phase** | ✅ Easy | Read meter |
| **12-month utility billing (kW demand)** | ⚠️ Medium | Requires property owner request to utility |
| **Individual unit loads** | ❌ Hard | Cannot access other units |
| **Electric heat/cooking** | ⚠️ Medium | May need to assume based on building type |
| **Common area loads** | ⚠️ Medium | Need building plans or estimation |
| **30-day load study** | ⚠️ Medium | Requires metering equipment rental |

### Our Solution: Support Both Paths

**Multi-Family EV Calculator now supports:**

1. **Calculation Path (NEC 220.87(B))**
   - Uses NEC 220.84 demand factors (23-45% based on unit count)
   - Conservative - always accepted by AHJs
   - Default mode when utility data unavailable

2. **Measurement Path (NEC 220.87(A))** ← NEW
   - Input measured peak demand from utility bills
   - No 125% multiplier applied
   - Often shows 30-50% more available capacity
   - Requires documentation of data source

3. **Smart Defaults** ← NEW
   - Building type presets (studio, 1BR, 2BR, condos, etc.)
   - Pre-filled typical values for unit sizes, common area loads
   - Enables quick estimates when detailed data unavailable

### Implementation Summary

**Code Changes (January 21, 2026):**

| File | Changes |
|------|---------|
| `services/calculations/multiFamilyEV.ts` | Added `existingLoadMethod`, `measuredPeakDemandKW`, `measurementPeriod`, `utilityCompany` fields |
| `components/MultiFamilyEVCalculator.tsx` | Added load determination method UI, building type presets |
| `services/pdfExport/MultiFamilyEVDocuments.tsx` | Shows load determination method in PDF |

**User Flow:**

```
1. Select "Existing Building Load" method:
   - NEC 220.84 Calculation (Standard) ← default
   - 12-Month Utility Billing (Measured)
   - 30-Day Load Study (Measured)

2. If Measurement selected:
   - Enter measured peak demand (kW)
   - Enter utility company name
   - Enter measurement period

3. Result shows:
   - Available capacity (often higher with measurement path)
   - Clear NEC reference for AHJ
   - Documentation for permit package
```

### Impact on Tool Value Proposition

**Before:** Tool only supported calculation - sometimes showing "impossible" results

**After:** Tool supports measurement path - often revealing significant available capacity

**Example Scenario:**
- 35-unit building with 800A service
- **Calculation method:** Calculated demand 720A → Only 80A available (1-2 chargers)
- **Measurement method:** Measured peak 350A → 450A available (9-12 chargers)

**This is the difference between "turn down the job" and "submit the bid."**

### Data Collection Guide for Contractors

When approaching a multi-family EV project, gather:

**Always Needed (Easy to Obtain):**
- [ ] Number of dwelling units
- [ ] Existing service amperage (main breaker/meter)
- [ ] Voltage configuration (120/208V or 277/480V)
- [ ] Phase configuration (1-phase or 3-phase)

**Helpful if Available (Medium Effort):**
- [ ] Property records for unit square footage
- [ ] 12-month utility billing with kW demand (request from property owner)
- [ ] Common area amenities list (gym, pool, elevators)
- [ ] Building vintage (affects assumed appliances)

**Nice to Have (Harder to Obtain):**
- [ ] Original electrical plans
- [ ] Individual unit load inventories
- [ ] 30-day metering data

**Key Message to Contractors:** You don't need perfect data. Our tool works with estimates and provides conservative results. The utility billing path often reveals capacity that calculation misses.

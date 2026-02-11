# NEC Pro Compliance - Validation Analysis

**Created:** January 15, 2026
**Last Updated:** February 9, 2026
**Purpose:** Track what's validated, what's assumed, and what to test next
**Parent doc:** [../STRATEGIC_ANALYSIS.md](../STRATEGIC_ANALYSIS.md)

---

## Validation Scorecard

### What's Been Validated

| Claim | Evidence | Date | Confidence |
|-------|----------|------|------------|
| Pain exists (MF EV calcs are hard) | Forum posts across Mike Holt, Electrician Talk, Reddit. Master electricians saying "it confused the heck out of me" | Jan 2026 | **High** |
| Contractors turn down profitable work | Direct quotes: "We've stopped installing multi unit chargers" | Jan 2026 | **High** |
| Engineering fees are $2-10K | Forum quotes, PE stamp pricing research ($150-$1,500 per stamp) | Jan-Feb 2026 | **High** |
| No competitor in this niche | Competitive landscape analysis: ETAP, SKM, EasyPower, Kopperfield, PowerCalc, KalcMate — none do MF EV + NEC 220.84 + permit output | Feb 2026 | **High** |
| Regulatory tailwinds | CA 2026 mandate (100% EV-ready), NY law, 11 states + DC, NEC code changes | Feb 2026 | **High** |
| Market is large enough | 251,789 US contractor businesses, SAM ~12,500, SOM 200-3,000 | Feb 2026 | **Medium** |
| NEC 220.84 demand factors are unknown to most | Forum evidence: contractors concluding "impossible" when feasible | Jan 2026 | **High** |
| NEC 220.87 measurement path is a differentiator | No competitor supports it; shows 30-50% more capacity | Jan 2026 | **High** |

### What's NOT Validated (Critical Unknowns)

| Assumption | Risk Level | How to Test | Status |
|------------|-----------|-------------|--------|
| Contractors will pay $49/mo | **HIGH** | Get 10 paying customers | Not started |
| Time savings are 1-2+ hours per project | **MEDIUM** | Run 10 free calculations, measure actual time | Not started |
| Permit-ready PDFs accepted by AHJs | **MEDIUM** | Submit 5 real permits using our output | Not started |
| Contractors won't just use spreadsheets | **MEDIUM** | Observe tool adoption vs manual fallback | Not started |
| "Freak out" test passes (users depend on tool) | **HIGH** | Only testable after having active users | Not started |
| California contractors are the right first target | **LOW** | Geographic analysis of first 50 signups | Not started |

---

## Gap Analysis (Updated Feb 2026)

### Gap #1: Niche Depth — RESOLVED

**Original concern (Jan 2026):** Targeting "EV Charging Installers" is too broad (Level 2).

**Resolution:** Niche refined to **Multi-Family EV Infrastructure Specialists in California**. This is Level 3:

| Level | Niche | Size |
|-------|-------|------|
| 1 | Electricians | 251,789 businesses |
| 2 | EV Installers | ~25,000 |
| **3** | **MF EV specialists, California-first** | **~2,000-5,000** |

California focus is justified by: strictest mandates, highest MF construction volume (27% national), and regulatory urgency.

### Gap #2: No Customer Validation — STILL OPEN

**Original concern:** Built product before validating with paying customers.

**Current status:** Product is now fully built (MF EV calculator, population pipeline, permit packets, Stripe integration). The "build first" ship has sailed. What matters now is getting to market FAST.

**Updated approach:** Skip the "validate before building" advice (product exists). Go directly to:
1. Offer 10 free calculations
2. Convert enthusiastic users to $49/mo
3. Iterate based on real usage

### Gap #3: Pricing — RESOLVED (for now)

**Original concern:** $49/mo is way too low; should charge $500/mo.

**Updated analysis (Feb 2026 market intelligence):**

| Scenario | Jobs/mo | Hours saved/mo | Value at $60/hr | 10% capture |
|----------|---------|---------------|-----------------|-------------|
| Conservative | 8 | 3.2 | $192 | $19/mo |
| Realistic | 12 | 9 | $540 | $54/mo |
| Optimistic | 40 | 70 | $4,200 | $420/mo |

**Conclusion:** $49/mo is correctly priced for the average contractor. The Becker $500/mo framework assumes enterprise B2B; 51% of electrical contractors are 1-9 employees making under $1M/year. They buy $49-149/mo tools, not $500/mo tools.

**Action:** Get 50 paying users at $49/mo first. Add premium tier ($499/mo) later for high-volume shops once you understand who they are.

### Gap #4: "Freak Out" Test — DEFERRED

**Original concern:** Would users panic if the tool disappeared?

**Updated take:** This test is only meaningful after you HAVE users. At 0 customers, it's a thought experiment. Revisit at 50+ active users.

**The real question at this stage:** Will contractors engage with a free offer? If yes → pain is real. If no → pain isn't acute enough, regardless of forum posts.

### Gap #5: No Signal Loop — STILL OPEN

**Original concern:** No feedback loop, no usage analytics, no customer interviews.

**What to build (minimal):**
- [ ] Basic analytics (calculation count, feature usage) — Supabase event tracking
- [ ] Post-calculation survey ("Was this helpful? Would you use this for a real project?")
- [ ] Monthly email to active users asking for feedback

**What NOT to build yet:** NPS scoring system, churn analysis dashboard, A/B testing framework. These are premature at 0 users.

---

## Validation Frameworks (Reference)

### The "Done-For-You" Test

**Offer to 10 contractors:**
> "Send me your building specs. I'll run the NEC 220.84 analysis and send you a permit-ready PDF. Free. I just want feedback."

**What to track:**
- Do they actually send specs? (pain is real)
- Do they use the output? (product fits workflow)
- Do they ask "how do I get more?" (willingness to pay)

**Success criteria:**
- 5+ out of 10 engage → pain validated
- 3+ ask about ongoing access → conversion potential
- 1+ uses output for a real permit → product-market fit signal

### Mom Test Interview Questions (Multi-Family Focus)

For contractors who've bid on MF EV projects:

1. "Tell me about the last multi-family EV project you quoted."
2. "What happened when you tried to get the service load calculation?"
3. "How much did you quote for the engineering portion?"
4. "Did you win or lose that job? Why?"
5. "How long did the calculation/engineering part take?"
6. "What tools do you currently use?"

**Rules:** Don't pitch. Don't ask "would you use a tool that..." Listen for pain, note dollar amounts, record exact quotes.

### Pricing Discovery

**After delivering a free calculation, ask:**
> "If you could get this for every project — accurate NEC 220.84 analysis with permit-ready PDF in 30 minutes — what would that be worth to you?"

| Their Answer | What It Means | Action |
|--------------|---------------|--------|
| "$20-50/month" | Low pain, wrong segment | Look for higher-volume users |
| "$50-100/month" | Moderate pain, $49/mo validated | Current pricing works |
| "$200-500/month" | High pain, premium tier opportunity | Consider Enterprise tier |
| "$500+/month" | Acute pain, underpriced | Test premium pricing |

---

## Alternative Niches (If Primary Fails)

These are backups. Do NOT pursue until MF EV is fully tested.

| Niche | Project Size | Complexity | WTP Estimate | Dev Required |
|-------|-------------|------------|-------------|-------------|
| Commercial Fleet EV | $50K-$500K | Very High | $500-2,500/mo | Moderate |
| Solar + Storage | $25K-$45K | High | $200-500/mo | 15-20h (NEC 706) |
| Small Engineering Firms (2-5 person) | Varies | High | $299-499/mo | Minimal |
| Permit Expeditors | Varies | Low | $500-1,000/mo | Minimal |

**Decision trigger:** If after 60 days of active outreach, fewer than 3 contractors engage with free calculation offers, reassess the niche.

---

## Validation Timeline

### Immediate (Feb 2026)

- [ ] Finish current branch (`feat/mdp-nec-220-84-demand-factor`)
- [ ] Record demo video: 35-unit building, calc vs measurement path
- [ ] Post on Mike Holt Forums with real NEC 220.84 example

### Month 1 (Feb-Mar 2026)

- [ ] Offer 10 free calculations to forum/Reddit contractors
- [ ] Track: engagement rate, output usage, follow-up questions
- [ ] Conduct 5 Mom Test interviews (no pitching)
- [ ] First paying customer

### Month 2 (Mar-Apr 2026)

- [ ] 10 paying customers
- [ ] 5 calculations used for real permits (AHJ acceptance test)
- [ ] Pricing discovery: ask 10 users what they'd pay
- [ ] Basic usage analytics in place

### Month 3 Decision Point (Apr 2026)

**Continue if:**
- 10+ paying customers
- 2+ contractors used output for real projects
- Positive feedback on AHJ acceptance
- Users return for second project (retention signal)

**Pivot if:**
- < 3 contractors engaged with free offers
- Nobody converts from free to paid
- AHJs reject the output format
- Users try once and never return

---

## Hard Questions (Revisit Monthly)

1. **Is the pain acute?** Forum evidence says yes. Customer behavior will confirm or deny.
2. **Are time savings real?** Claim: 1-2 hours/project. Must measure with real users.
3. **Can small contractors afford $49/mo?** 51% are 1-9 employees. $49/mo = cost of one lunch. ROI on first project = 40x. Should be affordable.
4. **Why us over Excel?** Multi-family NEC 220.84 calculations with demand factors, EVEMS sizing, and permit-ready PDF output. Excel can't do this without significant expertise. That's the moat.
5. **Is the market big enough?** SAM: ~12,500 contractors. Even 1% capture = 125 users = $73K ARR. 10% = $735K ARR. Market is sufficient.

---

## Sources

- Forum research: [FORUM_RESEARCH_FINDINGS.md](FORUM_RESEARCH_FINDINGS.md)
- Market intelligence: Feb 2026 competitive analysis (IBISWorld, NECA, Grand View Research, Verified Market Reports)
- YouTube strategy frameworks: [../youtube-research/](../youtube-research/) (Becker PMF checklist, Andre first-100-users)
- Pricing analysis: Based on NECA 2024 contractor profile + realistic value calculation

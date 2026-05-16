# SparkPlan — Strategic Analysis

**Last Updated:** 2026-05-15
**Status:** Pre-revenue. Product built. Entering Florida pilot.
**Authoritative source:** This file summarizes the operational decisions derived from the deeper analyses in the personal Obsidian vault (`SparkPlan Analysis/` — Reconciliation Notes May 2 2026, OAI Market Viability May 2026, Competitive Landscape Apr 2026, FL Pilot Revised Feb 2026). Where this file disagrees with the Obsidian Reconciliation Notes, Reconciliation Notes win.

---

## Executive Summary

### The Wedge

**Permit-acceptance for multi-family EV + EVEMS in Florida.** The product wins on whether AHJs accept the packet on first submittal — not on EV-mandate compliance.

Florida is the pilot because:
- §366.94 **preempts** local EV-charging ordinances. Mandate-tailwind narratives (CA 2026, NY MF law) do not apply here, so the product must justify itself on workflow value alone — a stronger validation signal.
- 443,911 registered electric vehicles statewide (FLHSMV Aug 2025); ~44% concentrated in Miami-Dade / Broward / Orange / Hillsborough.
- Right to Charge (FS §718.113(8)-(9)) forces condo associations to permit EV chargers, creating recurring multi-family permit volume in older buildings near electrical capacity.
- The FS 471.003(2)(h) PE-licensure exemption (≤$125k system value, ≤600A residential / ≤800A commercial @ 240V) creates a **dual-path workflow** — contractor-exempt lane + PE-sealed lane — that no national competitor productizes.

### What's Validated vs Assumed

| Item | Status | Evidence |
|---|---|---|
| Multi-family EV permit pain is real | **Validated** | Mike Holt forum threads, FORUM_RESEARCH_FINDINGS.md, AHJ checklist intensity (Pompano, Davie, Orlando) |
| No competitor unifies NEC calcs + permit packet + AHJ checklist + PE seal + EVEMS | **Validated** | Apr 2026 competitive matrix (Kopperfield, PermitFlow, PowerCalc, Design Master, FlashWorks) |
| Product works end-to-end | **Validated** | Calculator → PDF → permit packet pipeline functional |
| Florida AHJs explicitly demand riser + load calc + manuals + site plan + HOA letter | **Validated** | Pompano Beach EV checklist, Orlando engineering permit flow, Miami-Dade plan review guidelines |
| Contractors will pay $X/mo | **NOT VALIDATED** | Zero paying customers. Pricing is the open question (see below) |
| First-pass acceptance rate improves measurably | **NOT VALIDATED** | Need 20–40 real packets through 2–3 AHJs in pilot |

### The Single Most Important Thing Right Now

**Run the Florida pilot — 20–40 real permits across 2–3 AHJs.** The go-criterion is ≥70% first-pass acceptance in at least 2 AHJs (FL_PILOT_REVISED §9). Everything else is premature until that loop produces evidence.

---

## Current Pricing

Live tier ladder, wired in `hooks/useSubscription.ts`:

| Tier | Price | Limit | Key feature gate |
|---|---|---|---|
| Free | $0 | 3 projects | NEC search + basic calculators |
| **Starter** | $29/mo | 10 projects | Residential workflow + permit packet |
| **Pro** | $49/mo | Unlimited projects | Service Upgrade Wizard + EVEMS |
| **Business** | $149/mo | Unlimited projects | AI Copilot + Advanced Short Circuit + multi-seat |
| Enterprise | Custom | Unlimited | Custom workflows |

Permits are unlimited within Starter+; **projects** are the meter, not permits. Per-seal PE upsell (Sprint 3) sits on top of any tier — that's the Premium-PE-led layer that resolves the prior open-decision between PLG-only and PE-led.

---

## Market Sizing — Calibrated Anchors

The Obsidian OAI deep research replaces the older IBISWorld figures with more recent industry-sourced anchors:

| Anchor | Number | Source |
|---|---|---|
| US electrical contracting businesses | **81,046 (2023)** | IEC Economic Impact Report 2025 |
| US electrical contracting revenue | $260.1B/yr | IEC 2025 |
| US electricians employed | 818,700 (2024); 65% by ECs | BLS |
| FL electrical contractor licensees | ~18,000 | FL DBPR |
| FL registered EVs | 443,911 (Aug 2025) | FLHSMV — top 4 metros = 44% |
| FL multifamily under construction | 33,000+ units (Miami-Dade + Broward) | RentCafe Q2 2025 |

**Account-based ceiling (US):** 81,046 × $49/mo × 12 ≈ **$47.7M ARR** (ceiling, not forecast). At $149/mo: ~$144.9M. *This is not a multi-billion-ARR category* without expanding beyond contractors or layering high-ARPA services (PE review, enterprise workflows, broader construction ops).

**Florida pilot SAM (12-month):**
- Target metros: Miami-Dade, Broward, Orange, Hillsborough.
- Addressable: 150–600 firms doing EVSE / service upgrades / multi-family.
- Year-1 penetration: 2–8%.

**Year-1 ARR — realistic range**

| Scenario | ARR | Customers | Avg ARPU |
|---|---|---|---|
| Conservative | $50K–$75K | 20–30 | ~$200/mo |
| Moderate | $100K–$150K | 40–60 | ~$200/mo |
| Aggressive | $200K–$300K | 80–120 | ~$200/mo |

Calibration: median micro-SaaS MRR is $500/mo (Freemius 2025); only 12% of indie SaaS founders cross $100K ARR. The Moderate scenario places SparkPlan in the top ~15% of micro-SaaS outcomes.

---

## Competitive Landscape

### Direct competitor: Kopperfield

The benchmark customers will compare against. Verified Apr 2026:

- **Pricing:** $44.99–$99.99/mo (Commercial Pro at $99.99/mo); team add-ons at $14.99/seat.
- **Funding:** $5M (BIG Ventures, Climate Capital, Daft Capital).
- **Strengths:** NEC 2017/2020/2023 chatbot (and possibly NEC 2026 Article 120 Part III — *verify before claiming code parity*); generator sizing; AI panel-photo auto-population; "Smart Property Data" address lookup; SPAN/Emporia/WattBuy partnerships; iOS + Android.
- **Weaknesses (= our opening):** individual one-page PDFs (no assembled packet); zero FL AHJ awareness; no PE seal workflow; EVEMS support is line-item only, not NEC 625.42; declares "Data isn't encrypted" on Google Play.

### Adjacent / non-threats

| Player | Pricing | Why not a direct threat |
|---|---|---|
| **PermitFlow** | Custom ($91M raised, Series B) | General construction permit submission; does **no** electrical engineering. Could be an integration partner. |
| **PowerCalc** | $69.95–$89.95/user/mo | Cloud NEC engineering for engineers/architects. No permit packets, no AHJ awareness, no EVEMS. |
| **Design Master** | $125/seat/mo + AutoCAD (~$2k/yr) | Desktop AutoCAD plugin for MEP engineers. Total cost ~$290/mo — 6× our Pro tier. |
| **FlashWorks** | Not published (desktop) | FL-PE-built legacy NEC service calc tool; supports NEC 2017/2020 only. **Most culturally aligned competitor** — possible acquisition target rather than competitor. |
| **ETAP / SKM / EasyPower** | $2.8K–$25K/yr | Engineering-grade incumbents. Not at our price point; they shape arc-flash output expectations but don't compete for contractor permit workflow. |

### The defensible whitespace

**No tool unifies:** NEC Art. 220 calcs + permit packet assembly + FL AHJ checklists + PE seal workflow + multi-family EV/EVEMS at ≤$150/mo. That's the entire product positioning in one sentence.

**Moat sources, ranked:**
1. **PE license** — vertically integrated calculation + review + seal. Cannot be replicated without hiring/partnering with PEs in each jurisdiction.
2. **AHJ template accumulation** — every checklist learned, every passed packet, compounds. National tools cannot maintain this at our granularity.
3. **Multi-family EVEMS depth** — the EVEMS market is hardware-centric (Black Box Innovations, simpleSwitch, VariableGrid); no software produces the NEC-compliant engineering for it.

---

## Florida-Specific Pain Points (Validated)

| Pain | Evidence |
|---|---|
| EV permit packets explicitly require riser + load calcs + manuals + site plan + HOA letter | Pompano Beach, Davie, Orlando AHJ checklists |
| Orlando ties EV charging to an associated **engineering permit** + signed/sealed plans + NOC > $5k | City of Orlando permitting page |
| Miami-Dade specifies plan ID conventions ("E" prefix), Florida Building Code 8th ed (2023), NFPA-70 (2020) | Miami-Dade commercial electrical plan review guideline |
| Davie adds Knox-box emergency shutoff + NEC 625.42 breaker locking for commercial | Davie EV checklist |
| Multi-family EV requires demand factor knowledge (NEC 220.84) most contractors lack | Mike Holt forum threads ("there is no FEASABLE answer…") |
| Older condos run near service capacity → EVEMS or service upgrade needed | Forum threads, RentCafe MF data |
| FS 471.003(2)(h) creates a contractor design exemption — but AHJs may still demand sealed plans | FBPE guidance, Pompano anchoring requirements |

### Hidden opportunity: NEC 220.84 + 220.87 measurement path

Most contractors don't know:
- 220.84 demand factors drop multi-family load to **23–45%** of naive sum (35-unit building: 1,400A actual vs 3,500A naive).
- 220.87(A) measurement path often shows **30–50% more available capacity** than the 220.87(B) calculation path. Difference between "turn down the job" and "submit the bid."

**No competitor supports the measurement path.** Strongest single technical differentiator.

---

## Niches Ranked by Opportunity × Defensibility

| Rank | Niche | Why |
|---|---|---|
| **#1** | Multi-family EV + EVEMS | Highest WTP, regulatory pressure (Right to Charge), zero purpose-built software, hardware-only EVEMS market |
| **#2** | Permit completeness scoring / pre-submit QA for FL AHJs | Universal pain (rejection = "missing paperwork"); AHJ data accumulates as moat |
| **#3** | Service upgrade + load justification (non-EV, non-MF) | Less differentiated, but high-frequency commercial TI / restaurant / HVAC churn keeps revenue resilient if EV demand softens |
| **#4** | Emergency shutoff / EVSE labeling compliance (NEC 625.43) | Narrow but no tool exists; embed in #1 |
| **#5** | Solar PV + storage + interconnection | Aurora / OpenSolar / 10+ incumbents own this. Phase 2 only as the *electrical* complement (storage interconnection, MSP upgrade). |

---

## Risk Matrix

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Solo-developer bandwidth | **High (60%)** | High | Stop building, run pilot |
| Kopperfield adds MF EV / EVEMS | Medium (40%) | Medium | First-mover advantage in FL; PE seal moat unreachable |
| AHJs require sealing on workflows we hoped were exempt | Medium (35%) | Medium | Dual-path UX from day one (FS 471.003(2)(h) screening + PE seal workflow) |
| EV adoption stalls (federal incentives, tariffs) | Medium (30%) | High | Adjacent service-upgrade niche (#3 above) is non-EV; same outputs |
| Contractors won't adopt SaaS at all | Low (25%) | High | Free tier on-ramp; ROI on first packet = obvious |
| FlashWorks wakes up and modernizes | Low (15%) | Medium | They're desktop-only on NEC 2017/2020; treat as acquisition target |

---

## Pilot Plan (Florida)

**Phase 0 — pre-pilot (2 weeks):** pick 2–3 AHJs (Orlando + Tampa Bay + South FL); recruit 10 contractors covering res EVSE / small commercial / multi-family.

**Phase 1 — pilot (30–45 days):** 20–40 real permit packets through SparkPlan; measure resubmittal rate, reviewer comments per packet, turnaround, contractor time saved, first-pass acceptance %.

**Go criteria:**
- ≥70% first-pass acceptance in ≥2 AHJs, **or**
- ≥40% reduction in reviewer comments vs contractor baseline, **and**
- 5+ companies willing to pay during pilot month.

**Phase 2 — moat (60–90 days):** ship FL Permit Mode v1 (FS 471.003(2)(h) exemption screening + AHJ checklist engine for top-4); ship PE seal workflow MVP (review gate + tamper-evident lock + audit trail); publish 3–5 "Passed in X AHJ" case studies.

---

## What NOT to Do

1. Don't pitch on EV-mandate compliance in Florida — preempted.
2. Don't add features before running the pilot. Acceptance evidence > breadth.
3. Don't auto-stamp PE seals. Workflow only; cryptographic signing must remain under the PE's sole control (FBPE).
4. Don't expand to a second state until 3+ FL AHJs have repeatable acceptance evidence.
5. Don't write more strategy docs. Reference the Obsidian Reconciliation Notes and run.

---

## Reference Documents

| Document | Location | Purpose |
|---|---|---|
| Obsidian Reconciliation Notes | (private vault) `SparkPlan Analysis/Reconciliation Notes.md` | **Authoritative** — cross-reads Apr/May reports, flags contradictions |
| Obsidian OAI Market Viability | (private vault) `SparkPlan Analysis/Market Viability Analysis(Deep ResearchOAI).md` | Conditional Go (~68/100), market sizing anchors |
| Obsidian Competitive Landscape | (private vault) `SparkPlan Analysis/SparkPlan- competitive landscape...md` | Apr 2026 verified competitor matrix |
| Obsidian FL Pilot Revised | (private vault) `SparkPlan Analysis/FL_PILOT_REVISED_REPORT.md` | Pilot phasing + dual-path workflow (Feb 2026, revised) |
| Validation Analysis | [market-research/VALIDATION_ANALYSIS.md](market-research/VALIDATION_ANALYSIS.md) | PMF gap tracker |
| Forum Research | [market-research/FORUM_RESEARCH_FINDINGS.md](market-research/FORUM_RESEARCH_FINDINGS.md) | Raw contractor pain quotes |
| Distribution Playbook | [DISTRIBUTION_PLAYBOOK.md](DISTRIBUTION_PLAYBOOK.md) | FL-first channel strategy |
| Marketing Assets | [marketing/](marketing/) | Landing pages, case studies, launch kit |
| Product Roadmap | [../ROADMAP.md](../ROADMAP.md) | Engineering phases |

---

## Maintenance

**Review cadence:** monthly, plus on every milestone hit/miss in the pilot plan.

**When to re-sync this file with Obsidian:** any time the Reconciliation Notes change, or any time a contradiction in the Obsidian reports gets resolved (Kopperfield NEC 2026 verification, Florida EV figure source-lock, Miami parking ordinance preemption check, FlashWorks acquisition vs compete decision).

**Staleness flags:** Last Updated > 60 days, a Go/No-Go pilot milestone passed without assessment, a new direct competitor launches, or the live `hooks/useSubscription.ts` tier ladder diverges from the "Current Pricing" table above.

# Distribution Playbook

**Last Updated:** 2026-05-16
**Status:** Pre-revenue. Pilot phase.
**Parent doc:** [STRATEGIC_ANALYSIS.md](STRATEGIC_ANALYSIS.md)
**Authoritative source:** Obsidian `SparkPlan Analysis/` (Reconciliation Notes May 2 2026, Competitive Landscape Apr 2026).

---

## Guiding Principle

Go where Florida electrical contractors are already asking the question, answer it with the tool's output, and build acceptance evidence one AHJ at a time. **Don't generate demand — capture permit-friction frustration that already exists.**

The pilot is judged on **permit acceptance**, not feature breadth. Every channel below feeds back into "did the packet pass on first review."

---

## Why Florida-First (Not California-First)

The previous version of this playbook led with California because of the 2026 100%-MF-EV-ready mandate. The Obsidian May 2026 OAI deep research changed that conclusion:

- **FL §366.94 preempts local EV-charging ordinances.** Cities cannot enforce EV mandates; the FL energy code's EV appendices are not mandatory unless adopted by ordinance. So in Florida there is **no mandate-tailwind story** — winners win on workflow value alone, which is a stronger validation signal than "they had to buy something."
- Florida has **18,000 EC licensees**, **443,911 registered EVs** (FLHSMV Aug 2025), and **33,000+ multifamily units under construction in Miami-Dade + Broward**.
- The state's FS 471.003(2)(h) PE-licensure exemption creates a unique **dual-path workflow** (contractor-exempt vs PE-sealed) that we can productize and competitors cannot.
- The user is a Florida PE — operating in-state means the seal/review workflow is legally and operationally tractable from day one.

**California stays in the post-pilot expansion lane** (Phase 3) once FL AHJ packs are repeatable.

---

## Tier 1 — This Week (Free, High Intent)

### The "wow" moment: pick a city, packet auto-tunes

This is the strongest visual demo we have today (PR #51 + Sprint 2C M1, PRs #54 / #56, May 13–14). On the project setup screen, the contractor picks one of five FL pilot cities — **Orlando, Pompano Beach, Miami-Dade (unincorporated), Town of Davie, or Tampa (Hillsborough)** — and the AHJ manifest engine immediately retunes the packet:

- **General notes** swap to the AHJ's required boilerplate.
- **Code references** update (Florida Building Code edition, NFPA-70 edition — Miami-Dade forks NEC 2014 vs 2020 by building type).
- **Sheet-ID prefix** flips between `E-` (most AHJs) and `EL-` (Miami-Dade).
- **Upload slots** surface only what that AHJ asks for (HVHZ wind-anchoring shows up in Miami-Dade / Broward; HOA letter shows up where condo Right-to-Charge applies; NOC threshold shows up in Orlando).
- **Per-AHJ checklist** is rendered into the packet as a Jurisdiction Requirements page — engine-driven, not a static template.

Lead every demo (forum reply, DM, screen-recording) with this 60-second flow. It's the single visual that makes "no national tool does this" land in one breath. Pair with the **uploads UI** (PR #47, May 11): contractor drags in a site plan PDF, the merge engine (`mergePacket` + `stampSheetIds` + `compositeTitleBlock`) splices it behind a size-aware SparkPlan title sheet (Letter → ARCH D auto-match) with continuous sheet-ID stamping. That's the most contractor-visible feature shipped this month — the packet *looks* like a real engineered set the moment they hit Generate.

### 1. Mike Holt Forums — answer real FL multi-family EV / 220.84 questions

**Why #1:** Customers are literally there asking "how do I size a 30-unit MF building with EV chargers?" and getting wrong answers like "there is no feasible answer." Every helpful answer creates an evergreen permanent landing for that search query.

- Don't post "check out my tool" — instant ban.
- Find active threads on MF EV calcs, 220.84 confusion, service upgrade sizing, FL EV permitting.
- Post detailed math: demand factors, measurement path (220.87(A) vs (B)), what the numbers come out to.
- Include a screenshot of the SparkPlan PDF as "here's how I laid this out for a permit package."
- Link in your forum signature, never the post body.

**Search terms:** `220.84 + EV`, `multi-family + charger`, `service upgrade + multi unit`, `Florida + EV + permit`, `Pompano + EV`, `Miami-Dade + electrical + plan review`.

### 2. Reddit r/electricians — same approach, different audience

400K+ members. Search for "multi-family," "EV charger," "load calculation," "service upgrade" posts — focus on FL-tagged ones. Crossover subs: r/evcharging, r/solar.

### 3. Record one demo video — 35-unit FL building scenario

Walk through:
- Calculation path (220.87(B)) shows 80A available → 1–2 chargers → "impossible."
- Measurement path (220.87(A)) using utility billing shows 450A available → 9–12 chargers → "feasible."
- **Pick a FL city** (Pompano Beach) → packet auto-tunes general notes, code references, sheet-ID prefix, and applicable upload slots. Then switch to Miami-Dade → watch the prefix flip from `E-` to `EL-`, NEC edition recompute, HVHZ wind-anchoring slot appear.
- **Drag in a contractor's site plan PDF** → merge engine splices it behind a size-aware SparkPlan title sheet with continuous sheet-ID stamping in the bottom-right of every page. No Bluebeam, no manual stitching.
- Run the FL-specific permit packet with cover sheet, riser, load calc, jurisdiction requirements checklist, equipment cuts.
- 5–10 minutes, screen-recording with narration. Don't overthink production.

YouTube titles:
- "NEC 220.84 Multi-Family EV Load Calculation — Step by Step"
- "Florida EV Permit Packet: What Pompano / Davie / Miami-Dade Inspectors Want"
- "The 220.87 Measurement Path Most Florida Electricians Don't Know About"
- "Pick a Florida City, Get the Right Permit Packet — Live Demo"

---

## Tier 2 — Weeks 2–4 (Direct Outreach)

### 4. DM 10 Florida contractors from forum threads

Find people who posted about MF EV problems in FL in the last 6 months. DM:

> "Hey, I saw your post about the 24-unit building EV project in [Tampa/Miami/Orlando]. I built a tool that handles NEC 220.84 + the 220.87 measurement path and generates the full Florida permit packet — would you want me to run your numbers? Free, just want feedback. I'm a FL PE, so if the job lands outside the FS 471.003(2)(h) exemption (over $125k system value, over 600A residential / 800A commercial), my seal is the upsell — you don't have to go shop for a PE."

**The productized PE-as-service SKU:** contractor-exempt is the default lane on every tier (Free / Starter / Pro / Business — see `STRATEGIC_ANALYSIS.md` § Current Pricing). **The PE seal is a paid upsell that sits on top of any tier**, for the jobs where the contractor's self-screen against FS 471.003(2)(h) lands them in the "sealed" path. Lead with that — the seal is not a marketplace, it's a first-party SKU because Augusto IS the platform-owner PE. No national tool can offer this without recruiting state-by-state PE partnerships.

**What you're testing:**
- Do they engage? (pain real)
- Do they use the output? (workflow fit)
- Do they ask "how do I get more?" (WTP signal)
- Do they ask about the seal upsell when they hit a >$125k job? (PE-as-service demand signal)

**Success criteria:**
- 5+ of 10 engage → pain confirmed
- 3+ ask about ongoing access → conversion potential
- 1+ uses output for a real FL permit → product-market fit signal

### 5. LinkedIn — Florida EV contractors and condo property managers

Search: `"EV installation" + "Florida" + ("owner" OR "operations manager")` and `"property manager" + "condo" + "Florida"` (the Right to Charge law puts condo boards under pressure to permit chargers — they refer the work).

Same offer: free first calculation. Position the FL PE credential up-front, and frame the seal as **an in-platform paid SKU**, not an outside referral — that's the trust signal national tools can't match.

### 6. Permit expediter partnerships (South Florida)

At least 8 dedicated permit expediting firms operate in FL. The high-leverage ones:
- **Suncoast Permits** (statewide, electrical specialty, 20+ years)
- **Alliance Permitting Services** (15+ years, expanding)
- **All Florida Permits** (statewide electrical focus)

These firms touch electrical permits *daily* and interface with our exact buyer. Offer:
- A SparkPlan-generated packet that reduces their per-permit processing time, or
- A referral fee for contractors they hand off to us.

This is the highest-leverage early channel — they've already won the contractor's trust.

---

## Tier 3 — Month 2+ (Small Budget, Industry Channels)

### 7. Google Ads — long-tail FL + NEC keywords

| Keyword | Competition | Intent | Est. CPC |
|---|---|---|---|
| "NEC 220.84 calculator" | very low | very high | $2–5 |
| "multi-family EV load calculation" | very low | very high | $2–5 |
| "EV charging permit Florida" | low | very high | $3–6 |
| "Miami-Dade electrical permit checklist" | very low | high | $2–4 |
| "Pompano Beach EV charger permit" | very low | high | $2–4 |
| "Florida 471.003(2)(h) exemption" | very low | high | $2–4 |
| "service upgrade calculator EV" | low | high | $3–5 |

**Budget:** $200–500/mo. Almost no competition because nobody has a FL-specific product.

### 8. YouTube tutorial series — FL-flavored

| Video | Target search |
|---|---|
| "How to Calculate NEC 220.84 Demand Factors" | electricians learning MF calcs |
| "NEC 220.87: The Measurement Path Most Electricians Don't Know" | service upgrade questions |
| "Florida EV Charging Permits — Pompano / Davie / Miami-Dade Walkthrough" | FL EC searching specific city |
| "FS 471.003(2)(h): When You Need a PE in Florida" | EC confused about exemption |
| "EV Charger Permit Package: What FL Inspectors Want to See" | permit prep |

These rank for years.

### 9. NECA Florida chapters

Florida has **four NECA chapters**: North Florida (41 FL + 13 GA counties), Florida West Coast (Tampa/St. Pete), Central Florida (Orlando), and Atlantic Coast. They host seminars, training events, vendor brand-building workshops, and offer Associate membership for vendors.

**National NECA Convention 2026 (fall, exact dates / location TBV before any commitment):** historically 350+ exhibitors; published 2025-cycle attendee data (52.8% highly likely to purchase products seen within 12 months; 67.8% on purchasing teams; 82% attend no other trade show) make it the highest-leverage single contractor-facing event we could exhibit at. "The Grid: Startup Lab" is exhibit space designed for emerging companies — verify the 2026 application window from `necaconvention.org` before any spend.

### 10. SPAN installer program — possible OEM channel

SPAN's three-tier installer program (Authorized → Pro → Premier) lists Florida as one of four primary states. **Caveat:** Kopperfield is already embedded — SPAN advertises 55%-off Field Service Pro for SPAN Authorized Installers (~$199/mo). We can't displace that easily, but our **multi-family EVEMS depth** (which Kopperfield lacks) is a credible value proposition for SPAN installers handling MF projects. Approach SPAN B2B partnerships with the EVEMS angle, not as a Kopperfield replacement.

Secondary OEM channels: ChargePoint certification ($125–$175/cert), Tesla certified installer directory.

---

## What NOT to Spend Time On Yet

| Channel | Why not |
|---|---|
| Instagram / TikTok / Facebook ads | Wrong audience, low intent |
| Trade shows other than NECA | Too expensive and slow for pilot phase |
| Email campaigns | No list yet |
| SEO blog posts | YouTube ranks faster (6 months vs blog's 12+) |
| Partnerships with national networks (ChargePoint, Tesla, EVgo) | Premature — need traction signal first |
| Referral programs | Need users first |
| PR / press | Nobody covers pre-revenue niche tools |
| **California outreach** | Phase 3 only. Don't dilute the FL pilot signal. |
| **Generic "EV mandate" pitch in FL** | §366.94 preempted; you'll look uninformed |

---

## Execution Sequence

```
Week 1:  3–5 helpful answers on Mike Holt + Reddit (FL-tagged)
         Record + upload demo video (FL 35-unit scenario)
Week 2:  DM 10 FL contractors (Pompano / Miami / Orlando / Tampa metros)
         Reach out to Suncoast Permits, Alliance Permitting
Week 3:  Follow up, deliver calculations, log first permit submissions
Week 4:  Convert best lead → first paying customer
Month 2: Start Google Ads if Wk 1–4 shows engagement
         Record 2–3 more YouTube tutorials
         First NECA FL chapter outreach (Central FL, Atlantic Coast)
Month 3: Lock down which channel produced acceptance evidence;
         double down on whichever AHJs hit ≥70% first-pass.
Month 4–6: Verify 2026 NECA National convention dates + "The Grid: Startup Lab" application window, then apply if pilot acceptance evidence supports it
```

---

## Tracking

| Metric | Target | How |
|---|---|---|
| Forum posts made | 3–5/week | Manual |
| FL-specific DMs sent | 10 in first 2 weeks | Manual |
| Contractor responses | 5+/10 | Manual |
| Free calculations delivered | 5–10 | Manual |
| **Real permits submitted using our packet** | **5+ in pilot** | Manual / contractor follow-up |
| **First-pass acceptance rate** | **≥70% in ≥2 AHJs** | Pilot tracker |
| Demo video views (30 days) | 100+ | YouTube analytics |
| First paying customer | by end of Month 1 | Stripe |
| Google Ads CTR | >3% | GA dashboard |
| Google Ads → signup conv | >10% | Analytics |

The two **bold rows** are the only ones that decide whether the pilot passes the Go criteria in `STRATEGIC_ANALYSIS.md`. Everything else is leading-indicator noise.

---

## Decision Points

**End of Week 4:**
- 5+ FL contractors engaged → Tier 2 working, continue.
- < 3 engaged → reassess messaging or AHJ targeting (per [VALIDATION_ANALYSIS.md](market-research/VALIDATION_ANALYSIS.md)).

**End of Month 2:**
- 5+ paying FL customers → double down, raise Google Ads budget.
- 1–3 paying → iterate positioning + outreach.
- 0 paying → reassess wedge per Obsidian Reconciliation Notes (likely retreat to service-upgrade niche).

**End of Pilot (≈Month 3):**
- Acceptance evidence in ≥2 AHJs → ship FL Permit Mode v1 publicly, expand to 4 AHJs.
- Acceptance evidence in 0–1 AHJs → revise checklist engine; do not expand state coverage.

---

## Expansion Order (Post-Pilot)

1. **Replicate AHJ packs across Florida first — IN FLIGHT.** Five FL AHJ manifests are live as of 2026-05-14 (Sprint 2C M1, PRs #54 / #56): Orlando, Pompano Beach, Miami-Dade RER (unincorporated), Town of Davie, and Hillsborough/Tampa joint. The jurisdiction-checklist engine (`evaluatePacket()`) is wired and producing per-AHJ requirement checks in the packet. This step is no longer "future" — it's the live moat. Next FL targets: Broward (Fort Lauderdale, Hollywood), Orange beyond Orlando (Winter Park, Apopka), Palm Beach, Lee/Collier (Naples / Fort Myers).
2. **Adjacent niches in FL:** service-upgrade + load justification (#3 niche), multi-family meter stack / common area.
3. **Then 1–2 neighboring states with similar permitting friction** — Georgia (NECA North FL chapter already covers 13 GA counties), Alabama, Texas.
4. **California enters at Phase 3 only**, after AHJ playbook is repeatable. The CA mandate becomes a tailwind once the workflow is proven.

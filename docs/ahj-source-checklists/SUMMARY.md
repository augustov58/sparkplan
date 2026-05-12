# Sprint 2C parallel research — summary

**Date:** 2026-05-12 (revised 2026-05-12 second pass — Miami-Dade & Hillsborough/Tampa upgraded)
**Scope:** 4 non-Orlando FL pilot AHJs (Orlando was already line-by-line validated in Sprint 2A — see parent audit doc).
**Output:** Per-AHJ cross-walk matrices in this directory:

- [`pompano-beach.md`](./pompano-beach.md) — **High confidence** (official 01/29/2024 PDF verbatim)
- [`davie.md`](./davie.md) — **High confidence** (official EV PDF verbatim, commercial-only block intact)
- [`miami-dade.md`](./miami-dade.md) — **High confidence** (Commercial + Residential PRG PDFs both verbatim; EV-routing via PRG + Fee Sheet + Building Permit App confirmed; HVHZ scope confirmed county-wide) — *upgraded from Medium-High on 2026-05-12 second pass*
- [`hillsborough-tampa.md`](./hillsborough-tampa.md) — **Medium-High confidence** (Hillsborough commercial PDF verbatim; residential PDFs confirmed *deprecated by County*; Tampa residential trade-permit lane cross-validated; Fire Marshal Knox-box stance remains intractable without phone call) — *upgraded from Medium on 2026-05-12 second pass*

---

## Sourcing status

| AHJ | EV-specific official checklist? | Confidence | Outstanding research |
|---|---|---|---|
| Pompano Beach | ✅ Yes — `Vehicle-Charging-Station.pdf` (01/29/2024) | High | None blocking |
| Davie | ✅ Yes — EV PDF + commercial-only block | High | Knox Box model number disambiguation (~30 min) |
| Miami-Dade | ❌ No — EV-specific PDF still 404. Used Commercial + Residential PRG. | **High** *(was Medium-High; upgraded 2026-05-12 2nd pass)* | None blocking. Optional: 5-min phone call to RER (786-315-2000) to verify NEC 2014 vs 2020 distinction on Residential PRG (H34). |
| Hillsborough / Tampa | ❌ No — generic electrical only; residential PDFs *deprecated by County*. | **Medium-High** *(was Medium; upgraded 2026-05-12 2nd pass)* | Fire Marshal Knox-box stance for commercial EVSE retrofit — requires phone call (~30 min total: 813-744-5541 Hillsborough FM + 813-274-7000 Tampa Fire Rescue). Residential trade-permit intake-category lane (H35) — verify with HillsGovHub support (~10 min). |

---

## New candidate H-findings (H18–H33)

The Orlando line-by-line in the parent audit doc identified H1–H17. This research surfaced **16 additional candidate findings**. Severity ratings reflect intake-blocker likelihood, not engineering severity.

### From Miami-Dade

| ID | Finding | Severity |
|---|---|---|
| **H18** | Wet location / outdoor EVSE explicit callout (NEC 210.8 / 210.63 / 625.50) | Low–Medium |
| **H19** | **HVHZ wind-anchoring documentation** for outdoor pedestal/bollard EVSE (FL Product Approval / MD-NOA tie-down / signed-sealed structural) — **cross-validated by Pompano; applies to any outdoor EVSE statewide, not just HVHZ**. *2nd-pass confirmed: HVHZ scope covers ALL of Miami-Dade County (34 munis + unincorporated).* | **High** for outdoor multi-family / commercial |
| **H20** | Confirm sheet ID prefix is literally `E-` (not `EL-` / `ES-`). *2nd-pass note: Residential PRG does NOT prescribe sheet ID prefix; H20 applies to Commercial/multi-family lane only.* | Low |
| **H34** | **NEC edition mismatch between Miami-Dade Residential PRG (NEC 2014) and Commercial PRG (NEC 2020).** Could be a stale form artifact or deliberate distinction. SparkPlan packet code-basis block must be lane-aware. *(Surfaced 2nd-pass, 2026-05-12.)* | Low (5-min phone-call to RER to confirm) |

### From Pompano

| ID | Finding | Severity |
|---|---|---|
| **H21** | Zoning Compliance Permit Application (Pompano-specific intake form) | Medium |
| **H22** | Fire Review Application for non-single-family EVSE | Medium |
| **H23** | Building-final-structural inspection for ground-mounted pedestals (informational only — multi-trade inspection coordination) | Low |
| **H24** | Two-form Broward Uniform App split (Building-Checked + Electric-Checked) | Low (packaging, not content) |

### From Davie

| ID | Finding | Severity |
|---|---|---|
| **H25** | Signed/Notarized Addendum Form (contractor + owner) | Medium |
| **H26** | BCPA.NET property ownership search | Low |
| **H27** | Commercial switchboard signage + breaker locking-means callout (NEC 625.42) | Medium |
| **H28** | Commercial bollard protection for outdoor transformer/equipment | Medium–High |
| **H29** | Master manual shutdown shunt for multi-dispenser commercial sites + site-plan annotation | Medium–High |

### From Hillsborough / Tampa

| ID | Finding | Severity |
|---|---|---|
| **H30** | Design Flood Elevation on plans for flood-zone projects | Medium for flood zone |
| **H31** | Residential trade-permit lane (no plan review) — current packet is **over-spec** for Hillsborough residential; M1 needs a lighter `lane = 'residential_trade_permit_only'` mode. *2nd-pass: this lane is cross-validated for Tampa via TECO + Accela portal, but not officially documented by City of Tampa; final verification = 5-min call to 813-274-3100.* | Medium UX |
| **H32** | Two-portal jurisdiction split (HillsGovHub vs Tampa Accela) — manifest routing only | Low |
| **H33** | Private Provider documentation slot (FS 553.791) | Low |
| **H35** | **Hillsborough County has deprecated PDF-based residential checklists.** Index page now returns 0 rows. SparkPlan M1 manifest must use webpage URLs as source-of-truth, not PDFs. Pattern may extend to other FL AHJs in pilots 2/3. *(Surfaced 2nd-pass, 2026-05-12.)* | Low (packet) / Medium (manifest-build workflow) |
| **H36** | **Hillsborough residential plan-review threshold ambiguity.** `hcfl.gov` Residential Alterations page requires sealed plans, which contradicts the third-party "trade permit no plan review" narrative. The contractor's intake-category selection in HillsGovHub determines the lane. M1 must prescribe the right permit type. *(Surfaced 2nd-pass, 2026-05-12.)* | Medium UX |
| **H37** | **Tampa Fire Rescue's published "Codes In Use" page is stale** (lists 1985–1997 editions). Operative code is FFPC 8th ed (NFPA 1, 2021) statewide. SparkPlan should default to FFPC 8th / NFPA 1 2021 reference, ignore the Tampa page. *(Surfaced 2nd-pass, 2026-05-12.)* | Low informational |

---

## Cross-cutting architectural finding: `building_type` axis

The **residential vs multi-family vs commercial axis** is a real second-dimension lane, orthogonal to Sprint 2A's H17 contractor-exemption lane. Sprint 2C's M1 manifest schema should treat `building_type ∈ { single_family_residential, multi_family, commercial }` as a **first-class top-level field** — several requirements hinge on it:

- Pompano Fire Review Application excludes single-family residences (H22).
- Davie's Knox-box / bollard / multi-dispenser-shunt block applies only to commercial (H27–H29).
- Hillsborough's residential trade-permit lane bypasses plan review entirely (H31) — the SparkPlan packet is over-spec there.

**Implementation impact:** Sprint 2B PR-4's Orlando scaffold should include `building_type` even though Orlando's matrix doesn't currently vary on it. Retrofitting this field into 5 AHJs is more expensive than including it from day 1.

---

## Recommended M1 build order

**Updated 2026-05-12 (second pass):** Miami-Dade promoted ahead of Davie now that its sourcing is fully closed.

Build per-AHJ manifests in this order so the schema is stress-tested by the most diverse requirements early:

1. **Pompano first** — best-documented checklist (high-confidence verbatim source); aligns with existing Sprint 2B H6 (HOA letter); exercises 3-permit-form intake (Building + Electric + Zoning + optional Fire).
2. **Miami-Dade second** *(promoted from third)* — fully sourced after 2nd pass (Commercial + Residential PRG both verbatim; EV-routing confirmed; HVHZ scope locked county-wide). Exercises the **sub-jurisdiction routing axis** (`unincorporated_miami_dade` vs `city_of_miami` vs the other 32 munis) and the **NEC-edition-per-lane axis** (H34) — these two axes will stress-test M1 schema flexibility early.
3. **Davie third** *(demoted from second)* — best commercial-conditional test case; exercises Knox-box / bollard / shutdown shunt commercial-only requirements; validates that the `building_type` axis works. Davie's commercial-only block plus Miami-Dade's sub-jurisdiction split will jointly validate the manifest's conditional-block engine.
4. **Hillsborough / Tampa fourth** — most permissive (residential trade-permit lane H31), but also surfaces the most M1 manifest-build complexity (H35 deprecated PDFs, H36 intake-category ambiguity, H37 stale code references). Lowest **packet-content** blocker risk, but highest **manifest-tooling** risk. Build last so manifest engine is mature.

Orlando is already done (Sprint 2A line-by-line validated; manifest scaffold in Sprint 2B PR-4).

---

## Effort gap to close before M1 finalization

**Updated 2026-05-12 (second pass):**

| AHJ | Status | Remaining gap |
|---|---|---|
| **Pompano** | ✅ Closed | No blocking gaps. |
| **Davie** | ⚠️ Minor | ~30 min — Knox Box model number disambiguation (`KLS4-505` vs `KLS-4505` in source PDF). |
| **Miami-Dade** | ✅ Closed (2nd pass 2026-05-12) | All three first-pass gaps closed (Residential PRG extracted; EV-routing confirmed via PRG + Fee Sheet + Building Permit App; HVHZ scope confirmed county-wide). **Optional ~5-min phone call** to RER (786-315-2000) to confirm whether NEC 2014 citation on Residential PRG is intentional (H34) — non-blocking. |
| **Hillsborough/Tampa** | ⚠️ Partial (2nd pass 2026-05-12) | Hillsborough residential PDFs confirmed *deprecated by County* (now webpage-only). Tampa residential trade-permit lane cross-validated via TECO + Accela. **Remaining: Fire Marshal Knox-box stance (H37 / Davie analog) — intractable without phone calls.** ~30 min total: 813-744-5541 (Hillsborough FM) + 813-274-7000 (Tampa FR). Plus ~10 min HillsGovHub support call for H36 intake-category lane verification. |

**Revised total: ~75 min of phone-call follow-up.** Down from the prior ~4–6 hours estimate. None of these block PR-4 (Orlando-only scaffold). The Hillsborough Knox-box gap is the only remaining intake-blocker risk for commercial-EVSE M1 finalization.

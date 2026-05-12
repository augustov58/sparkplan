# Sprint 2C parallel research — summary

**Date:** 2026-05-12
**Scope:** 4 non-Orlando FL pilot AHJs (Orlando was already line-by-line validated in Sprint 2A — see parent audit doc).
**Output:** Per-AHJ cross-walk matrices in this directory:

- [`pompano-beach.md`](./pompano-beach.md) — **High confidence** (official 01/29/2024 PDF verbatim)
- [`davie.md`](./davie.md) — **High confidence** (official EV PDF verbatim, commercial-only block intact)
- [`miami-dade.md`](./miami-dade.md) — **Medium-High confidence** (no dedicated EV PDF — 404; sourced from Commercial Electrical PRG)
- [`hillsborough-tampa.md`](./hillsborough-tampa.md) — **Medium confidence** (no dedicated EV PDF; residential lane undocumented)

---

## Sourcing status

| AHJ | EV-specific official checklist? | Confidence | Outstanding research |
|---|---|---|---|
| Pompano Beach | ✅ Yes — `Vehicle-Charging-Station.pdf` (01/29/2024) | High | None blocking |
| Davie | ✅ Yes — EV PDF + commercial-only block | High | Knox Box model number disambiguation (~30 min) |
| Miami-Dade | ❌ No — EV-specific PDF 404. Used Commercial Electrical PRG. | Medium-High | Residential PRG + plans examiner confirmation (~1–2 hr) |
| Hillsborough / Tampa | ❌ No — generic electrical only. | Medium | Residential & Mobile Home Checklist PDFs; Tampa residential trade permit; Fire Marshal Knox-box stance (~2–3 hr, may need phone/email) |

---

## New candidate H-findings (H18–H33)

The Orlando line-by-line in the parent audit doc identified H1–H17. This research surfaced **16 additional candidate findings**. Severity ratings reflect intake-blocker likelihood, not engineering severity.

### From Miami-Dade

| ID | Finding | Severity |
|---|---|---|
| **H18** | Wet location / outdoor EVSE explicit callout (NEC 210.8 / 210.63 / 625.50) | Low–Medium |
| **H19** | **HVHZ wind-anchoring documentation** for outdoor pedestal/bollard EVSE (FL Product Approval / MD-NOA tie-down / signed-sealed structural) — **cross-validated by Pompano; applies to any outdoor EVSE statewide, not just HVHZ** | **High** for outdoor multi-family / commercial |
| **H20** | Confirm sheet ID prefix is literally `E-` (not `EL-` / `ES-`) | Low |

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
| **H31** | Residential trade-permit lane (no plan review) — current packet is **over-spec** for Hillsborough residential; M1 needs a lighter `lane = 'residential_trade_permit_only'` mode | Medium UX |
| **H32** | Two-portal jurisdiction split (HillsGovHub vs Tampa Accela) — manifest routing only | Low |
| **H33** | Private Provider documentation slot (FS 553.791) | Low |

---

## Cross-cutting architectural finding: `building_type` axis

The **residential vs multi-family vs commercial axis** is a real second-dimension lane, orthogonal to Sprint 2A's H17 contractor-exemption lane. Sprint 2C's M1 manifest schema should treat `building_type ∈ { single_family_residential, multi_family, commercial }` as a **first-class top-level field** — several requirements hinge on it:

- Pompano Fire Review Application excludes single-family residences (H22).
- Davie's Knox-box / bollard / multi-dispenser-shunt block applies only to commercial (H27–H29).
- Hillsborough's residential trade-permit lane bypasses plan review entirely (H31) — the SparkPlan packet is over-spec there.

**Implementation impact:** Sprint 2B PR-4's Orlando scaffold should include `building_type` even though Orlando's matrix doesn't currently vary on it. Retrofitting this field into 5 AHJs is more expensive than including it from day 1.

---

## Recommended M1 build order

Build per-AHJ manifests in this order so the schema is stress-tested by the most diverse requirements early:

1. **Pompano first** — best-documented checklist (high-confidence verbatim source); aligns with existing Sprint 2B H6 (HOA letter); exercises 3-permit-form intake (Building + Electric + Zoning + optional Fire).
2. **Davie second** — best commercial-conditional test case; exercises Knox-box / bollard / shutdown shunt commercial-only requirements; validates that the `building_type` axis works.
3. **Miami-Dade third** — after follow-up source pulls (Residential PRG); HVHZ anchoring already cross-validated by Pompano.
4. **Hillsborough / Tampa fourth** — most permissive; exercises the new `residential_trade_permit_only` lane; lowest blocker risk.

Orlando is already done (Sprint 2A line-by-line validated; manifest scaffold in Sprint 2B PR-4).

---

## Effort gap to close before M1 finalization

- **Miami-Dade**: ~1–2 hours of follow-up sourcing (Residential PRG; plans-examiner confirmation).
- **Davie**: ~30 minutes (Knox Box model number disambiguation — the source PDF shows both "KLS4-505" and "KLS-4505").
- **Hillsborough/Tampa**: ~2–3 hours, may require phone/email contact with City of Tampa (csdhelp@tampa.gov) and Hillsborough Fire Marshal.
- **Pompano**: no blocking gaps.

Total: ~4–6 hours of follow-up research; not blocking PR-4 (Orlando-only scaffold) but blocking Sprint 2C M1 finalization for the four non-Orlando AHJs.

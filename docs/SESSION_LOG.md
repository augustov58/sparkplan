# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-04-15

---

### Session: 2026-04-14 / 2026-04-15 - Commercial Load Calc UX + Export

**Focus**: Fix three bugs in the Commercial Load Calculator, fix the Riser diagram voltage label, and add PDF/CSV export from the load calculator tab.
**Status**: Complete (merged to main)

**Work Done:**

*Bug fixes (branch `fix/commercial-load-calc-bugs`, merged `c0d297e`):*
- Manual override dropdowns on Recommended Service Sizing (main breaker + bus rating) with auto-reset and utilization recalculation
- Motor FLA auto-populates from new NEC Tables 430.248 (1-phase) and 430.250 (3-phase) when HP/voltage/phase changes; manual override supported with "Reset to NEC" button
- New `<NumberInput>` component (`components/common/NumberInput.tsx`) fixes two UX bugs across all 15 number inputs in the calculator: can't clear the field (it snapped back to 0) and typing produced leading zeros

*Riser fix (branch `fix/riser-util-voltage-from-mdp`, merged `4a54533`):*
- UTIL symbol and "…V …Φ Service" badge in the one-line diagram now derive from the MDP's voltage/phase (via `is_main: true`) rather than `project.serviceVoltage`; falls back to project when no MDP exists

*Load Calc Export feature (branch `feat/commercial-load-calc-export`, merged `c380761`):*
- 1-page-flow PDF report (can expand to 2-3 pages with lots of inputs): project info, service sizing cards, load breakdown table with NEC refs, service sizing math, input parameters, warnings, notes, signature block
- Structured multi-section CSV: project info, service sizing summary, breakdown, per-category input tables, warnings, notes — RFC 4180-compliant with UTF-8 BOM for Excel
- PDF compacted after initial 3-page version per user feedback: single `<Page>` with natural flow, tighter spacing, signature moved to end

**Files Created:**
- `data/nec/table-430-248-250.ts` — NEC motor FLA tables + `getMotorFLA()`
- `components/common/NumberInput.tsx` — buffered string-state numeric input
- `services/pdfExport/CommercialLoadDocument.tsx` — React-PDF document
- `services/pdfExport/commercialLoadExport.ts` — PDF + CSV export helpers

**Files Modified:**
- `components/CommercialLoadCalculator.tsx` — all three features
- `components/OneLineDiagram.tsx` — effectiveServiceVoltage/Phase derivation (4 display sites + export)
- `services/calculations/commercialLoad.ts` — exported `STANDARD_OCPD_SIZES` + `STANDARD_SERVICE_BUS_RATINGS`
- `App.tsx` — pass `project` prop to CommercialLoadCalculator

**Pending (carried over):**
- Stripe webhook signature verification still disabled — must re-enable before real live-mode traffic

---

### Session: 2026-04-12 - Documentation: Billing & Admin Phases

**Focus**: Document the subscription/billing/Stripe/admin panel features in ROADMAP.md and CHANGELOG.md
**Status**: Complete

**Work Done:**
- Added Phase 2.9 (Subscriptions & Feature Gating) to ROADMAP.md
- Added Phase 3.0 (Stripe Live Mode & Admin Panel) to ROADMAP.md
- Updated "Latest Completed Phase" header to 3.0
- Renumbered future phases (Design Copilot → Phase 4, Solar → Phase 5)
- Added two CHANGELOG entries for Phase 2.9 and 3.0
- Updated SESSION_LOG

**Pending (non-code):**
- Resend SMTP setup for custom domain emails (user doing manually)
- Stripe statement descriptor change ("EEDUCATION" → "SPARKPLAN")

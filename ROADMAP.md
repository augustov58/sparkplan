# SparkPlan - Roadmap

## Current Phase: 3.6 (Permits Beta v1) - PLANNING (May 2026)

## Latest Completed Phase: 3.5 (Contractor Pivot — Sidebar Betas + Chatbot Restoration) - May 2026
## Active Sprint: 3.4 (AHJ Compliance Audit Sprint 2A) - 2 PRs merged, 3 still planned

---

## Phase 3.6: Permits Beta v1 - PLANNING (May 2026)

First contractor-pivot beta selected for actual implementation. Phase 3.5's demand-discovery stubs identified Permits as the highest-leverage entry point because it absorbs the existing `Inspection & Issues` page (already built in Phase 0) and adds a permit-submission lifecycle on top — fastest path from beta stub to a real shipped feature.

| Phase | Scope | Status |
|---|---|---|
| **Phase 1 (MVP)** | Tabbed Permits page (Overview / Permits / Inspections / Issues). New `permits` + `permit_inspections` tables. Permit + inspection CRUD with status-transition state machine. Existing `IssuesLog` UI relocated as Issues tab. Redirect `/issues` → `/permits?tab=issues`. Manual permit-status updates. | 📋 Planned (PR #30 — handoff doc) |
| **Phase 2** | AHJ contact integration (auto-populate from FL pilot AHJ database). Inspection scheduling via existing `CalendarView`. Expiration warnings (banner ≤30 days). Corrections-to-issue linkage in UI. | ⏳ Pending |
| **Phase 3** | AI assistance — chatbot tools `update_permit_status`, `schedule_inspection`, `summarize_corrections`. Auto-link generated permit packets to permits. Email notifications for status changes. | ⏳ Pending |
| **Phase 4** | AHJ portal scraping per-AHJ (Orange County, Miami-Dade, Pompano Beach). Automated status syncing. | ⏳ Pending |

**Implementation handoff doc**: [`docs/plans/permits-implementation.md`](docs/plans/permits-implementation.md) — 623-line self-contained plan written for handoff to a fresh Claude context after `/clear`. Includes: phase split, full data model with RLS + indexes, file tree, ASCII UI mockups, status-transition state machine, expiration thresholds, validation schemas, test plan, file-by-file implementation order, 9 decisions to confirm, 10 out-of-scope items, 16-point Definition of Done.

**Tier gating**: Already done in Phase 3.5 (PR #29). `permits` is in `FEATURE_TIERS` as `['business', 'enterprise']`. Trial users get access automatically via `effectivePlan` when `status === 'trialing'`. No tier work needed during implementation.

**Estimated PR size**: ~1,800 LOC across 3-4 commits for Phase 1.

---

## Phase 3.5: Contractor Pivot — Sidebar Betas + Chatbot Restoration - COMPLETE (May 2026)

Three-PR cluster spawned by verifying PR #25 (riser SE label + cumulative VD on diagrams/PDFs/FeederManager). Verification surfaced two follow-up gaps and one strategic UX issue.

| PR | Status | Closes |
|---|---|---|
| **#26** | ✅ MERGED 13:25 UTC | Chatbot teaches the AI about cumulative voltage drop (VD+), service-entrance feeders, NEC 215.2(A)(1) IN No. 2 + 210.19(A)(1) IN No. 4 thresholds. New `calculate_cumulative_voltage_drop` tool. `calculate_feeder_voltage_drop` augmented. All 3 system-instruction builders updated. |
| **#27** | ✅ MERGED 13:35 UTC | Inspector accuracy fixes (panel slot cap reads `num_spaces` not hard-coded 42; deleted noisy branch-conductor audit; generalized circuit-loading check from receptacle-only to all circuits with correct voltage derivation by pole count). Plus visible Slots stat card on panel header + bulk-create slot cap. |
| **#28** | ✅ MERGED 14:07 UTC | Restores chatbot write-tool functionality. Root cause: PR #13 (2026-04-24 security audit) added the `requiresConfirmation` server-side gate without shipping the matching UI. 5 write tools (`add_circuit`, `add_panel`, `fill_panel_with_test_loads`, `empty_panel`, `fill_with_spares`) unreachable for ~2 weeks. Fix: Apply / Cancel card UI + `bypassConfirmation` option + skip second Gemini round-trip on Apply. |
| **#29** | ✅ MERGED 2026-05-09 | Sidebar contractor pivot. Drops Site Visits + RFI Tracking (engineer-flavored). Adds 3 (beta) stubs: Estimating, Permits, T&M Billing — all gated to Business + Enterprise tier (matches sibling PM features; trial users get access automatically). New `feature_interest` table captures demand notes. Permits absorbs the inspection lifecycle conceptually (Phase 3.6 builds it for real). |

**Strategic context for Phase 3.5**: SparkPlan started as a calc/design tool (engineer territory), and engineer vocabulary leaked into the contractor-facing sidebar as PM features were added. Validated against external market research showing the top 3 unmet pain points for $1M-$10M small electrical shops: estimating + job costing (CRITICAL), permit + inspection lifecycle (HIGH), T&M billing (HIGH). Existing tools are either enterprise-priced (IntelliBid, Trimble Accubid) or wrong-shape for commercial T&M (Jobber, Housecall Pro). SparkPlan's electrical-specific data model (panels, circuits, feeders, transformers) is the differentiator — but only if the sidebar reflects what contractors actually do.

**Demand-discovery strategy**: betas ship as stub pages with feature description + "Tell us what you'd want from this" CTA. Each click inserts a row into `feature_interest`. Highest-signal beta gets prioritized for actual sprint work. Cheap demand validation (~150 LOC, 1 small migration) before committing build effort.

**Test count (after Phase 3.5):** 208/208 pass (was 198 post-Sprint-2A, +10 across Phase 3.5 PRs — no new tests this session, all changes covered by existing E2E + unit suites).

**Migrations applied:** `20260509_feature_interest.sql` (additive — `feature_interest` table for beta demand-discovery signals).

**Phase 1 (Permits build) → see Phase 3.6 above.** That work moved out of Phase 3.5's scope into its own dedicated phase since the implementation effort (~1,800 LOC) warrants its own planning doc + PR cycle.

---

## Phase 3.4: AHJ Compliance Audit Sprint 2A - IN PROGRESS (May 2026)

Form-factor and content-gap sweep on top of Sprint 1's engine-correctness fixes. Closes systemic intake-rejection vectors that affect every Florida AHJ — packet identification (cover edition stamp), per-sheet contractor signature, navigation (TOC, revision log, sheet IDs), and required content pages (general notes, EVEMS narrative, EVSE labeling, grounding detail, AIC labels). Work split into themed PRs ("Strategy C" — by category boundary, not per-commit).

| PR | Status | Closes |
|---|---|---|
| **PR 1** (merged `92126eb`) | ✅ MERGED 2026-05-08 | C7 (NEC edition selector), H4 (FBC + NFPA-70 reference), C8 (per-sheet contractor block), M8 (meter stack theme parity), H12 (general notes page), H13 (3/3/5 voltage drop convention), LOW (edition-stamp polish) |
| **PR #23** (open, mergeable CLEAN) | 🟡 PUSHED 2026-05-09 | H1 (cover TOC), H2 (revision log page), H3 (sheet IDs with `E-` prefix and category bands) — plus section toggle UI + projects.settings persistence + sheet ID styling fix + 42-circuit panel schedule overflow fix |
| **PR 3** (planned) | ⏳ PENDING | H14 (NEC 220.87 conditions narrative), H9+H15 (AIC labels on one-line + UL-2202/UL-2594 fields on EVSE specs + new "Available Fault Current Calculation" page when service-modification-type === 'new-service'), H10 (EVEMS operational narrative), H11 (EVSE labeling page per NEC 625.43) |
| **PR 4** (planned) | ⏳ PENDING | M3 (project-specific grounding detail with GEC sizing per NEC 250.66 / 250.122), M6 (riser diagram landscape mode for ≥10 panels OR pagination) |
| **PR 5** (planned) | ⏳ PENDING | H17 (FS 471.003(2)(h) contractor-exemption screening engine — pure function returning `{ lane, reason, ahjOverride? }`), schema additions to `projects.settings` (service_modification_type, scope_flags, estimated_value_usd) |

**Net packet structure (post-Sprint-2A target):**

| Sheet ID | What | Source |
|---|---|---|
| `E-001` | Cover sheet (NEC 2020 + FBC 8th ed stamp, applicable codes section) | C7 + H4 (PR 1) |
| `E-002` | Table of Contents (auto-populated from rendered sections) | H1 (PR #23) |
| `E-003` | Revision Log (auto Rev 0 row on first submittal) | H2 (PR #23) |
| `E-004` | General Notes (8-item FL pilot stack default, AHJ-manifest-driven in 2C) | H12 + H13 (PR 1) |
| `E-101+` | Engineering calculations (load calc, voltage drop, short circuit, arc flash, 220.87 narrative, AIC) | H14 + H9 (PR 3) |
| `E-201+` | Diagrams & equipment (riser, equipment schedule/specs, grounding detail with GEC sizing) | M3 + M6 (PR 4) |
| `E-301+` | Panel schedules (one per panel; 42-circuit + Load Summary + Dwelling Unit Demand on a single sheet) | C6 (Sprint 1) + 42-ckt fix (PR #23) |
| `E-401+` | Multi-family scope (meter stack 1-per-stack, MFEV 3-per-analysis) | M8 (PR 1) + multi-page split (PR #23) |
| `E-501+` | Compliance & AHJ (NEC 2020 compliance summary, jurisdiction requirements) | C7 (PR 1) |
| `E-601+` | Specialty (EVEMS operational narrative, EVSE labeling per NEC 625.43) | H10 + H11 (PR 3) |

**Per-sheet footer on every electrical sheet:** Contractor name + License # block on the left, Signature / Date line on the right (C8). Sheet ID badge in footer center, paired with page number (H3).

**Section toggles + persistence (PR #23):** Contractors choose which sections to include before generating. 16 toggles grouped into 6 categories. Cover always-on. Off-warning amber banners for ComplianceSummary + PanelSchedules. Auto-disable predicates with tooltips for missing-data sections. Preferences persist per-project to `projects.settings.section_preferences`.

**Test count (after PR #23):** 198/198 pass (was 181 post-Sprint-1, +17 across the two PRs). No DB migrations required.

**Audit doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md).

---

## Phase 3.3: AHJ Compliance Audit Sprint 1 - COMPLETE (May 2026)

Engine-correctness sweep of the permit-packet PDF against five Florida AHJ checklists (Orlando, Miami-Dade, Pompano Beach, Davie, Hillsborough). Six critical findings — all turned out to be consumer-side wiring/validation bugs, not calculation engine bugs. After this sprint, every page of the audit packet that does arithmetic produces the right number.

| Finding | Resolved | Highlight |
|---|---|---|
| **C1** — NEC 220.84 multifamily Optional Method not applied to PDF load-calc page | PR #15 | New `buildMultiFamilyContext` helper; in-app + PDF call same path |
| **C2** — EVSE feeders shown as 14 AWG / 0 A / "Compliant" (cached `total_load_va = 0`) | PR #16 | New `computeFeederLoadVA` live-derive helper; cached column preserved for future PE seal snapshot |
| **C3** — Permit metadata advisory (TBD/test placeholder warnings) | PR #17 | Three new advisory Zod schemas (`projectAddressSchema`, `flContractorLicenseSchema`, `permitNumberSchema`); blue heads-up alert, never blocks generation |
| **B-1** — Spark Copilot AI gave stale-cache answers on feeder voltage drop | PR #17 | `chatTools.ts` live-derives via the same C2 helper; raw rows plumbed alongside lossy `ProjectContext` |
| **C6** — PDF panel-schedule phase column lumped all loads to Phase A on split-phase 1Φ panels | PR #17 | PDF was reinventing broken inline phase logic; now calls existing `getCircuitPhase` helper |
| **C4** — Per-EVSE branch math (NEC 220.57) + EVEMS feeder reduction (NEC 625.42) | **PR #19** | Branch row at full nameplate; explicit "EVEMS Aggregate Setpoint" marker carrying the calculator's exact NEC 625.42 setpoint; clamp inside `calculateAggregatedLoad`; right-sized EV panel main breaker (400→300A) per NEC 215.2(A)(1); MDP feeder synthesis for PDF panel-schedule (M4); unit panel sizing using true NEC 220.82 Optional Method (Standard Method via misnamed function was producing 200A, Optional gives 125A); EV meter orphan cleanup; in-app twin of C6 for `calculatePanelDemand` 2-pole phase split; NEC 220.82 demand surfaced on dwelling unit panel summaries |

**Net packet correctness:**

| Page | Pre-audit | Post-Sprint-1 |
|---|---|---|
| Load calc summary | 🔴 498.4 kVA / "Other 220.14 @ 100%" / 2,077A | ✅ Three correct rows: Multi-Family Dwelling 220.84 41% + House 100% + EV 625.42 clamped → 239.8 kVA / 999A |
| Voltage drop | 🔴 14 AWG / 0 A / "Compliant" on EV feeder | ✅ Live-derived from destination panel demand |
| Per-EVSE branch | 🔴 3,996 VA per branch (EVEMS-shared) | ✅ 11,520 VA nameplate per NEC 220.57(A) |
| EVEMS aggregate row | ⚠️ "EVEMS Load Management System  500 VA" (controller power placeholder) | ✅ "EVEMS Aggregate Setpoint (NEC 625.42)  47.9 kVA" callout |
| EV Sub-Panel main breaker | ⚠️ 400 A heuristic | ✅ 300 A per NEC 215.2(A)(1) (setpoint × 1.25) |
| Panel schedule phase column | 🔴 All Phase A on split-phase 1Φ panels | ✅ Alternates A/B per row pair; 240V loads split 50/50 |
| MDP panel schedule | ⚠️ "No circuits defined" | ✅ 14 synthesized feeder rows showing each downstream panel's demand |
| Unit panel rating | ⚠️ 200 A (Standard Method) | ✅ 125 A (Optional NEC 220.82) |
| Unit panel summary demand | ⚠️ 150 A on 125 A panel (raw connected) | ✅ 95 A "(NEC 220.82)" annotation |
| Meter stack | ⚠️ Orphaned EV meters from prior testing | ✅ Orchestrator deletes by `meter_type='ev'` (catches orphans) |

**Key insight from the retrospective:** All six findings were consumer-side wiring bugs, not engine bugs. The pure-function calc engines (`upstreamLoadAggregation`, `feederSizing`, `conductorSizing`, `demandFactor.getCircuitPhase`, `multiFamilyEV.calculatePerEVSELoad`) were already correct. Bugs lived at PDF call sites, autogeneration time, validation gates, and AI tool handlers reading stale caches. Diagnostic shortcut: when in-app view is correct but PDF disagrees, look at the PDF call site or autogeneration — the engine is probably fine.

**Test count:** 123 → 181 (+58 regression tests across all six findings).

**Audit doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md). Open: C5 (PE seal workflow — Sprint 3); H1-H11 + M1-M8 (Sprint 2 polish + Permit Mode v1).

---

## Phase 0: Basic Project Management - COMPLETE (Dec 2025)
- RFI Tracking with AI PDF extraction
- Site Visit Logging with photo upload
- Open Items Dashboard (cross-project)
- Calendar/Timeline with events

---

## Phase 1: AI Killer Features - COMPLETE (Dec 2025)
- Inspector Mode AI (pre-inspection audit)
- Enhanced NEC Assistant (context-aware)
- Permit Packet Generator (Tier 1 + Tier 2)
- Arc Flash Calculator
- Short Circuit Calculator

---

## Phase 2: EV Niche Domination - COMPLETE (Dec 2025)
- EVEMS Load Management Calculator (NEC 625.42)
- Service Upgrade Wizard (NEC 220.87, 230.42)
- Utility Interconnection Forms (code complete, UI hidden)
- EV Panel Templates (4× & 8× Level 2, 2× DC Fast)

---

## Phase 2.5: Multi-Family EV Domination - COMPLETE (Jan 2026)

**Strategic Focus:** Highest-pain, highest-WTP segment. Contractors turning down $10K-50K jobs - we automate the $2-10K engineering calculation.

| Feature | NEC Reference | Status |
|---------|---------------|--------|
| Multi-Family EV Calculator | 220.84 + 220.57 + 625.42 | Complete |
| NEC 220.87 Measurement Path | 220.87(A) | Complete |
| Building Type Presets | - | Complete |
| Common Area Load Itemization | 220.42, 220.44, 620.14, 430.24 | Complete |
| PDF Export (Standalone) | - | Complete |
| Permit Packet Integration | - | Complete |

**Key Features:**
- NEC 220.84 multi-family demand factors (23-45% based on unit count)
- NEC 220.57 per-EVSE load calculation (max of 7,200 VA or nameplate)
- NEC 625.42 EVEMS right-sizing (size to setpoint, not full connected load)
- Dual-path load determination: Calculation (220.87(B)) OR Measurement (220.87(A))
- Measurement path often shows 30-50% MORE available capacity

---

## Phase 2.6: Enhanced AI Chatbot - COMPLETE (Jan 2026)

| Feature | Status | Impact |
|---------|--------|--------|
| Conversation Memory | Complete | Multi-turn conversations |
| Agentic Actions (12 tools) | Complete | Execute calculations via chat |

---

## Permit Packet Generator - Tier 2

| Feature | Status |
|---------|--------|
| Short Circuit Calculator | Complete |
| Arc Flash Calculator | Complete |
| Grounding Plan (NEC 250) | Complete |
| Equipment Specification Sheets | Complete |
| Voltage Drop Report | Complete |
| Jurisdiction Requirement Wizard | Complete (6 jurisdictions) |

**Result:** 100% commercial permit readiness

---

## Phase 2.7: Multi-Family Project Population - COMPLETE (Feb 2026)

**The missing link solved:** MF EV Calculator → Project Panels/Circuits → Permit Packet

### Workflow Achieved
```
MF EV Calculator → "Apply to Project" / "Add EV Infrastructure" buttons
                 → Auto-generates: MDP, meter stack, house panel,
                   EV sub-panel, unit panels, feeders, EVEMS circuits
                 → Permit Packet includes complete multi-family design
                   with meter stack schedule
```

| Feature | Status |
|---------|--------|
| Auto-Generation Service (2 generators + orchestrator) | Complete |
| Meter Stack & Meters DB Schema (migration applied) | Complete |
| CT Cabinet in One-Line Diagram (interactive + print) | Complete |
| Meter Stack Schedule in Permit Packet (PDF) | Complete |
| "Apply to Project" UI (basic MF + EV infrastructure flows) | Complete |
| Building/Unit Relationships (hooks + realtime sync) | Complete |
| Unit Feeder Stub Generation | Complete (deferred auto-sizing — users input actual distances) |

**Key Files:**
- `services/autogeneration/multiFamilyProjectGenerator.ts` — 3 generation modes
- `services/autogeneration/projectPopulationOrchestrator.ts` — DB insertion in FK order
- `services/pdfExport/MeterStackSchedulePDF.tsx` — Permit-ready meter schedule
- `supabase/migrations/20260208_meter_stacks.sql` — meter_stacks + meters tables

---

## Phase 2.8: User Profiles & Settings - COMPLETE (Feb 2026)

| Feature | Status |
|---------|--------|
| Profile creation trigger (auto-creates profile on signup) | Complete |
| Backfill existing auth.users into profiles | Complete |
| Account Settings page (/settings) | Complete |
| Permit Packet auto-fill (Prepared By, License #) | Complete |
| Sidebar display name from profile | Complete |

**Key Files:**
- `hooks/useProfile.ts` — Single-row profile fetch/update hook
- `components/UserProfile.tsx` — Settings page
- `supabase/migrations/20260217_profile_creation_trigger.sql` — Trigger + backfill

---

## Phase 2.9: Subscriptions & Feature Gating - COMPLETE (Mar 2026)

**Strategic Focus:** Monetization infrastructure. 5-tier subscription model with Stripe integration, feature gating, and 14-day trial funnel.

| Feature | Status |
|---------|--------|
| Subscriptions table + RLS + auto-create on signup | Complete |
| 5-tier plan system (Free → Starter → Pro → Business → Enterprise) | Complete |
| Feature access control (40+ features mapped to plans) | Complete |
| 14-day Business trial for new signups | Complete |
| Stripe Checkout integration (edge function) | Complete |
| Stripe Webhook handler (5 event types) | Complete |
| Stripe Billing Portal (self-service management) | Complete |
| Pricing page with feature comparison table + FAQ | Complete |
| FeatureGate component (blocking, subtle, inline modes) | Complete |
| Trial banner with countdown + urgency states | Complete |
| Promo code redemption UI | Complete |
| Real-time subscription sync via Supabase channels | Complete |

**Pricing:**
| Plan | Price | Target |
|------|-------|--------|
| Free | $0 | Entry point, 3 projects |
| Starter | $29/mo | Solo electricians |
| Pro | $49/mo | EV installers |
| Business | $149/mo | AI-powered teams |
| Enterprise | Custom | Large firms |

**Key Files:**
- `hooks/useSubscription.ts` — Plan state, feature checks, Stripe session creation
- `components/PricingPage.tsx` — Plan cards, comparison table, checkout flow
- `components/FeatureGate.tsx` — 3-mode feature access control component
- `components/TrialBanner.tsx` — Trial countdown + promo code input
- `supabase/functions/stripe-checkout/index.ts` — Checkout session creation
- `supabase/functions/stripe-webhook/index.ts` — Webhook event handler
- `supabase/functions/stripe-portal/index.ts` — Billing portal session
- `supabase/migrations/20260105_subscriptions.sql` — Subscriptions table + triggers

---

## Phase 3.0: Stripe Live Mode & Admin Panel - COMPLETE (Apr 2026)

**Strategic Focus:** Production-ready billing and admin tooling for launch.

| Feature | Status |
|---------|--------|
| Stripe test → live mode migration (new keys, products, prices) | Complete |
| Live webhook endpoint configured + signature verification | Complete |
| All edge functions redeployed with live credentials | Complete |
| Admin panel with user search (by email) | Complete |
| Admin: set user plan (bypass Stripe) | Complete |
| Admin: create user with specific plan | Complete |
| Admin: delete user (cascade) | Complete |
| Admin: confirm email manually | Complete |
| Admin: refund latest payment + cancel subscription | Complete |
| Trial expiration UI fixes (effectivePlan, button visibility) | Complete |
| Branded email confirmation template | Complete |
| SMTP setup guide (Resend + Vercel DNS) | Complete |

**Key Files:**
- `components/AdminPanel.tsx` — Full admin dashboard
- `supabase/functions/stripe-refund/index.ts` — Admin refund + cancel
- `supabase/migrations/20260212_trial_and_admin.sql` — Admin RPC functions
- `supabase/migrations/20260212_admin_user_management.sql` — Create/delete user RPCs
- `supabase/migrations/20260217_admin_confirm_user.sql` — Email confirmation RPC
- `supabase/email-templates/confirmation.html` — Branded signup email
- `supabase/email-templates/SETUP.md` — Resend SMTP setup guide

**Edge Function Versions (deployed):**
- `stripe-checkout` v16, `stripe-portal` v15, `stripe-webhook` v22, `stripe-refund` v2

---

## Phase 3.1: Commercial Load Calc UX & Export - COMPLETE (Apr 2026)

**Strategic Focus:** Make the Commercial Load Calculator submittal-ready. Fix long-standing UX paper cuts, round out the Recommended Service Sizing workflow with engineer-overrides, and produce professional PDF + CSV outputs so the tool can serve as the primary artifact for permit submittals.

| Feature | Status |
|---------|--------|
| Manual override of Main Breaker (OCPD) with auto-validated dropdown | Complete |
| Manual override of Service Bus Rating with dependency on main breaker | Complete |
| Motor FLA auto-populate from NEC 2023 Tables 430.248 / 430.250 | Complete |
| Reusable `<NumberInput>` fixing empty-field + leading-zero bugs | Complete |
| One-line diagram: UTIL symbol voltage derived from MDP (not project) | Complete |
| Commercial Load Calc PDF export (submittal-quality, single-flow) | Complete |
| Commercial Load Calc CSV export (RFC 4180, Excel-safe BOM) | Complete |

**Key Files:**
- `data/nec/table-430-248-250.ts` — NEC motor FLA tables with voltage-column mapping
- `components/common/NumberInput.tsx` — Buffered controlled numeric input
- `services/pdfExport/CommercialLoadDocument.tsx` — React-PDF document
- `services/pdfExport/commercialLoadExport.ts` — PDF + CSV export helpers
- `components/CommercialLoadCalculator.tsx` — Overrides, auto-populate, export UI
- `components/OneLineDiagram.tsx` — Effective service voltage derived from MDP

---

## Phase 3.2: In-App Support System - COMPLETE (Apr 2026)

**Strategic Focus:** Close the feedback loop with users. Replace the mailto-only support channel with a threaded in-app ticketing system that captures context (page URL, browser, plan tier), supports image attachments, and notifies both sides via email — with full bidirectional email replies so conversations can continue in Gmail or in-app interchangeably.

### 3.2a — In-App Ticketing (Apr 16, 2026)

| Feature | Status |
|---------|--------|
| Support ticket & reply schema with RLS (admin via `auth.jwt()` claim) | Complete |
| Floating support widget (bottom-left bubble, sidebar-aware positioning) | Complete |
| Ticket form with category / subject / message / image attachments | Complete |
| Ticket history + threaded reply view (user-side) | Complete |
| Admin Panel "Support" tab with search, status/priority controls, reply composer | Complete |
| Resend-powered email notifications (new ticket → inbox, admin reply → user) | Complete |
| Status-change email to user (open / in_progress / resolved / closed) | Complete |
| Realtime subscriptions (tickets + replies) + unread-reply badges | Complete |
| Per-ticket `user_last_seen_at` high-water mark for unread count | Complete |
| Image attachment storage bucket + RLS + signed-URL rendering | Complete |

### 3.2b — Inbound Email Pipeline + AI-Investigation Scaffolding (Apr 17–18, 2026)

| Feature | Status |
|---------|--------|
| Plus-addressed `Reply-To` on every outbound notification (`support+ticket-<uuid>@sparkplan.app`) | Complete |
| `support-inbound` edge function — Gmail API polling every 60s via pg_cron | Complete |
| Sender authentication (admin email OR shared mailbox OR ticket owner) | Complete |
| Quoted-reply stripping + empty-body detection | Complete |
| Admin reply auto-bumps `open → in_progress` (mirrors dashboard) | Complete |
| Cross-echo to the *other* party via `support-notify` service-role call | Complete |
| Append-only `support_ticket_events` log (7 event types, 4 sources) | Complete |
| `support_ticket_investigations` schema (forward-compatible with Claude Code runner) | Complete |
| `support-investigate` stub edge function | Complete |
| Live deployment + four-bug debug (gateway JWT, Vault placeholder, admin mailbox, service-role call) | Complete |
| 7-stage troubleshooting playbook with response-body fingerprint table | Complete |

**Key Files:**
- `components/SupportWidget.tsx` — Floating bubble, new-ticket form, ticket history, threaded reply view
- `components/AdminSupportPanel.tsx` — Admin ticket list, filters, status/priority controls, reply composer
- `hooks/useSupportTickets.ts` — CRUD + realtime + unread computation + mark-seen
- `supabase/functions/support-notify/index.ts` — Resend emails for new_ticket / admin_reply / status_changed / user_reply, with service-role internal-trust
- `supabase/functions/support-inbound/index.ts` — Gmail-polling reply ingestion
- `supabase/functions/support-investigate/index.ts` — AI-investigation stub (forward-compatible)
- `supabase/functions/_shared/gmail.ts` — Gmail API REST helpers (OAuth refresh, listing, MIME tree walk)
- `supabase/functions/_shared/supportEvents.ts` — Shared event emit + quoted-reply stripping + ticket-ID extraction
- `scripts/gmail-oauth.ts` — One-shot OAuth bootstrap (loopback-IP flow)
- `supabase/migrations/20260416161645_support_tickets.sql` — Tables + RLS + storage bucket
- `supabase/migrations/20260416193739_fix_support_rls_use_jwt.sql` — Admin policies via JWT email claim
- `supabase/migrations/20260416200057_support_tickets_last_seen.sql` — Unread-badge watermark column
- `supabase/migrations/20260417000000_support_events_and_investigations.sql` — Event log + investigations + Gmail sync state
- `supabase/migrations/20260417000001_support_inbound_cron.sql` — pg_cron schedule + pg_net call via Vault secrets

**Operational Docs:**
- `docs/SUPPORT_INBOUND_SETUP.md` — One-time setup (OAuth, Vault, secrets) + 7-stage diagnostic playbook
- `docs/database-architecture.md` — Schema docs for all 5 support tables with design-decision rationale

**Known Non-Blocking Limitations:**
- Gmail polling uses `is:unread newer_than:1d` — messages opened in the inbox before the 60s cron tick get stranded (fix: mark unread, or migrate to Gmail History API using already-provisioned `support_gmail_sync_state.last_history_id`)
- `support-investigate` is a stub that writes `status='skipped'` rows — wiring up the real Claude Code runner is a code-only change (schema is forward-compatible)

---

## Backlog

| Feature | Origin | Impact |
|---------|--------|--------|
| Streaming Responses | Phase 2.6 | Faster perceived AI response |
| Core NEC Tables RAG | Phase 2.6 | Accurate table lookups in chatbot |
| Full NEC RAG | Phase 2.6 | Complete NEC knowledge base |

---

## Phase 4: Design Copilot (Future)

AI-powered auto-design: "Design 15,000 sq ft medical office with X-ray room" → Complete electrical design

- Building type classifier
- Load schedule generator
- Panel layout optimizer

**Estimate:** 40-50 hours | **Impact:** Revolutionary

---

## Phase 5: Solar + Storage Expansion (Future)

- Battery energy storage (NEC 706)
- Hybrid inverter configuration
- Net metering calculations

---

## NEC Compliance Features

### Implemented

| Feature | NEC Reference |
|---------|---------------|
| Load Calculations | 220.82, 220.84, 220.40-220.60 (Commercial) |
| Conductor Sizing | 310.16, Table 310.16 |
| Motor Full-Load Currents | Tables 430.248 (1Φ), 430.250 (3Φ) |
| Voltage Drop | Chapter 9, Table 9 |
| Demand Factors | 220.42, 220.44, 220.55 |
| Feeder Sizing | Article 215 |
| EGC Sizing | 250.122 |
| Grounding System | Article 250 |
| EV Charging | Article 625 |
| Solar PV | Article 690 |
| Short Circuit Analysis | NEC 110.9, IEEE 141 |
| EVEMS Load Management | NEC 625.42 |
| Service Upgrade Analysis | NEC 220.87, 230.42 |
| Arc Flash Analysis | NFPA 70E |
| Multi-Family EV Analysis | NEC 220.84 + 220.57 + 625.42 |

### Planned

| Feature | NEC Reference | Priority |
|---------|---------------|----------|
| Selective Coordination | 700.27, 701.27 | Medium |
| Motor Starting | Article 430 | Medium |
| Harmonic Analysis | - | Low |

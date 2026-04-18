# Changelog

All notable changes to SparkPlan.

---

## 2026-04-18: Support Inbound Pipeline — Live Deployment + Debug Playbook

**Operational:**
- **End-to-end email-reply pipeline is live in production.** Admin replies from `support@sparkplan.app` and customer replies to notification emails now thread back into the originating ticket, get persisted to `support_replies`, and trigger a cross-echo email to the other party. Widget + Admin Panel update in realtime without refresh.
- Resolved migration history drift across 29 local migration files (timestamp prefixes normalized to unique 14-digit `YYYYMMDDHHMMSS` format so `supabase db push` can track them).

**Bugs Fixed During Live Validation:**
- **Gateway-level 401**: Supabase's default JWT verification rejected pg_cron's custom shared-secret header. Redeployed `support-inbound` with `--no-verify-jwt` (application-layer `verifySecret()` still enforces auth).
- **Vault placeholder never replaced**: `support_inbound_secret` Vault row held a literal template string instead of the 64-hex random value. Generated `openssl rand -hex 32` and synced both the Vault entry (via `vault.update_secret()`) and the edge function secret.
- **Admin identity too narrow**: Inbound function only recognized the admin's login email (augustovalbuena@gmail.com), so replies from the shared `support@sparkplan.app` mailbox were rejected as `ignored-unauthorized`. Widened `isSenderAdmin` to accept either `ADMIN_EMAIL` or `GMAIL_MAILBOX`.
- **Internal service-role call rejected**: `support-inbound` → `support-notify` invocations returned 401 because Supabase's new API key format (`sb_secret_...`) isn't a JWT. Redeployed `support-notify` with `--no-verify-jwt`; the function's own `isInternalCall` check continues to validate the service-role bearer.

**Known Limitation (Documented, Not Yet Fixed):**
- **`is:unread` strands opened messages**: If you preview a reply in Gmail before cron polls, it gets marked read and excluded from `to:support+ticket- is:unread newer_than:1d`. Workaround is to mark unread; future fix is to migrate to Gmail History API using the already-provisioned `support_gmail_sync_state.last_history_id` column.

**Documentation:**
- Expanded `docs/SUPPORT_INBOUND_SETUP.md` with a 7-stage diagnostic playbook (cron fired? response body fingerprint? Vault/secret parity? sender authorized? Gmail query returning? echo emitted? token valid?). Each stage lists the exact SQL query and the specific fix.
- Added a response-body fingerprint table mapping HTTP body → root cause → fix, so future debugging sessions start from a string match rather than first-principles.

**Files Modified:**
- `supabase/functions/support-inbound/index.ts` — accept shared mailbox as admin identity
- `docs/SUPPORT_INBOUND_SETUP.md` — comprehensive troubleshooting playbook
- 29 migration files renamed to unique 14-digit timestamps

---

## 2026-04-17: Support System — Inbound Email Replies (Gmail polling) + AI-Investigation Scaffolding

**New Features:**
- **Email replies thread back into tickets**: Both admin and customer email replies are now automatically attached to the originating ticket as `support_replies` rows. No dashboard visit required for quick back-and-forth. Realtime subscriptions mean the reply appears live in both SupportWidget and AdminSupportPanel without refresh.
- **Per-ticket plus-addressed `Reply-To`**: All outbound mail types (`new_ticket`, `admin_reply`, `status_changed`, and new `user_reply`) set `Reply-To: support+ticket-<uuid>@sparkplan.app`. Gmail delivers plus-addressed mail to the same inbox, so the ticket ID rides every thread for free — no extra MX records, no new domain.
- **`support-inbound` edge function (Gmail API polling)**: pg_cron fires the function every minute with a shared secret. It lists unread messages matching `to:support+ticket- is:unread newer_than:1d`, extracts the ticket UUID from the recipient, authenticates the sender (admin email or ticket owner), strips quoted reply history, inserts into `support_replies` via service_role, emits a `support_ticket_events` row, then echoes via `support-notify` to keep the *other* party informed. Admin email replies auto-bump `open → in_progress` matching dashboard behavior.
- **`support-investigate` edge function (stub)**: Architectural seam for a future Claude Code runner that picks up bug tickets, investigates, and reports findings to Slack + the admin dashboard. Currently returns 202 Accepted and writes `status='skipped'` investigation rows so the UI can show "deferred" without further migrations. The schema (`support_ticket_investigations`) already carries everything the runner will eventually write: `findings`, `artifacts` (JSONB), `notified_via`, `completed_at`, `error_message`.

**Architecture:**
- **Gmail API over Resend Inbound**: The existing Google Workspace mailbox handles receiving for free; Resend Pro ($20/mo) was avoided. Code structure is provider-agnostic — swapping to a webhook-based provider later would only touch `support-inbound`'s entry point.
- **Append-only event log**: New `support_ticket_events` table captures every lifecycle event (`ticket_created`, `user_reply`, `admin_reply`, `status_changed`, `priority_changed`, `investigation_requested`, `investigation_completed`) with a `source` discriminator (`widget` / `dashboard` / `email` / `system`). This is the integration point for the future AI-investigation handler and any other event-driven downstream (Slack, analytics, audit).
- **Investigation scaffolding is forward-compatible**: `investigator` column is a CHECK-constrained enum that already includes `'claude-code'`, `'human'`, `'automated-check'`. Status column covers the full lifecycle (`pending` → `running` → `completed` / `failed` / `skipped`). Adding the real runner is a code-only change.
- **Shared helpers**: `supabase/functions/_shared/gmail.ts` (OAuth refresh-token flow, message listing, base64url decoding, MIME tree walk) and `supabase/functions/_shared/supportEvents.ts` (event emit, ticket-ID extraction, quoted-reply stripping) keep edge functions thin.
- **Internal-trust bypass in support-notify**: `support-inbound` calls `support-notify` with the service_role bearer token to trigger user_reply echoes. support-notify now detects service_role callers and treats them as trusted system-level without requiring a user session.

**New Tables:**
- `support_ticket_events` — append-only event log (admin-read-only RLS, service_role writes)
- `support_ticket_investigations` — AI/human investigation records (realtime enabled for live dashboard updates)
- `support_gmail_sync_state` — singleton polling watermark for operational visibility

**Configuration Required Before Live Use:**
- Google Cloud Console: enable Gmail API on a project, create OAuth 2.0 Desktop-app credentials, grant `https://www.googleapis.com/auth/gmail.modify` scope
- Run `deno run --allow-net scripts/gmail-oauth.ts` once to obtain the offline refresh token
- Supabase Edge Function secrets: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_MAILBOX=support@sparkplan.app`, `SUPPORT_INBOUND_SECRET` (strong random), `SUPPORT_ADMIN_AUTH_USER_ID` (admin's `auth.users.id`)
- Supabase Vault: `support_inbound_secret` (same value as the env var) and `supabase_functions_base_url` (so the pg_cron migration can read them)
- Apply migrations: `20260417_support_events_and_investigations.sql`, `20260417_support_inbound_cron.sql`
- Deploy edge functions: `support-notify` (updated), `support-inbound` (new), `support-investigate` (new stub)

**Files Created:**
- `supabase/migrations/20260417_support_events_and_investigations.sql` — event log + investigations + Gmail sync state
- `supabase/migrations/20260417_support_inbound_cron.sql` — pg_cron schedule + pg_net call
- `supabase/functions/_shared/gmail.ts` — Gmail API REST helpers
- `supabase/functions/_shared/supportEvents.ts` — shared event emit + email parsing
- `supabase/functions/support-inbound/index.ts` — Gmail polling handler
- `supabase/functions/support-investigate/index.ts` — AI-investigation stub
- `scripts/gmail-oauth.ts` — one-shot OAuth bootstrap

**Files Modified:**
- `supabase/functions/support-notify/index.ts` — plus-addressed `Reply-To`, service_role internal-trust path, new `user_reply` payload type
- `lib/database.types.ts` — added 3 new table types

---

## 2026-04-16: In-App Support System (Phase 3.2)

**New Features:**
- **In-app support ticket system**: Users open tickets from a floating support bubble (bottom-left). Tickets capture category, subject, message, optional image attachments (up to 5), current page URL, plan tier, and browser info. Admin replies from the Admin Panel "Support" tab; threaded replies appear in the widget. No more mailto: hand-off — the entire conversation stays in-app.
- **Email notifications via Resend**: New ticket → `support@sparkplan.app` (with reply-to set to the user for quick email replies); admin reply → user's registered email with "continue in SparkPlan" CTA; status changes (open / in_progress / resolved / closed) → user email with a branded status badge.
- **Unread-reply badges**: Red badges appear on the floating bubble, the "My tickets" tab, and each ticket row when the admin has replied since the user last opened the ticket. Opening a ticket (or receiving a reply while the ticket is already open) clears it. Implementation uses a per-ticket `user_last_seen_at` high-water mark rather than per-reply read receipts.
- **Realtime sync**: Supabase postgres_changes subscriptions on both `support_tickets` and `support_replies` — new admin replies show up instantly with the badge incremented without refresh.
- **Admin Support Panel**: List / filter / search tickets by status or email; set priority (low / normal / high / urgent); set status; compose replies inline; view full user thread with image attachments rendered via signed URLs.

**Bug Fixes:**
- **"permission denied for table users" on ticket insert**: Root cause was admin RLS policies subquerying `auth.users`, but the `authenticated` role has no SELECT grant on that table. Because policies are OR-combined, every user (not just admins) hit the error. Fixed by switching admin checks to `(auth.jwt() ->> 'email') = 'augustovalbuena@gmail.com'`, which reads the email claim from the JWT instead of joining against auth.users. Applied to support_tickets, support_replies, and storage.objects.
- **Support bubble overlap**: Floating bubble position changed from `md:left-6` to `md:left-[17rem]` so it sits past the 16rem sidebar instead of covering "Sign Out" / "Account Settings".
- **Widget title readability**: Forced `text-white` on the heading (was reading as dark green on the dark-green gradient).

**Files Created:**
- `components/SupportWidget.tsx` — Floating bubble + form + history + threaded reply view
- `components/AdminSupportPanel.tsx` — Admin ticket dashboard
- `hooks/useSupportTickets.ts` — Supabase CRUD + realtime + unread computation
- `supabase/functions/support-notify/index.ts` — Resend edge function (new_ticket / admin_reply / status_changed)
- `supabase/migrations/20260416_support_tickets.sql` — Tables + RLS + storage bucket
- `supabase/migrations/20260416_fix_support_rls_use_jwt.sql` — JWT-claim admin policy fix
- `supabase/migrations/20260416_support_tickets_last_seen.sql` — Unread watermark column + restricted UPDATE grant

**Files Modified:**
- `App.tsx` — Mount SupportWidget + lazy-load AdminSupportPanel behind AdminPanel tab
- `components/AdminPanel.tsx` — New "Support" tab wiring
- `lib/database.types.ts` — support_tickets / support_replies / user_last_seen_at
- `lib/validation-schemas.ts` — Ticket form schemas
- `lib/toast.ts` — Support-flow toast messages
- `lib/dataRefreshEvents.ts` — Support entity refresh events

**Edge Functions Deployed:**
- `support-notify` v3 (via MCP `deploy_edge_function`)

---

## 2026-04-15: Commercial Load Calculator UX + Export

**New Features:**
- **PDF export from Commercial Load Calculator**: Submittal-quality report with project info, service sizing summary (main breaker / bus / utilization), itemized load breakdown with NEC refs, service sizing math, input parameters (HVAC/Motors/Kitchen/Special), warnings, NEC calculation notes, and a signature block. Single-page layout that flows naturally — small projects render on 1 sheet, dense projects expand to 2–3.
- **CSV export from Commercial Load Calculator**: Structured multi-section CSV (project info, service sizing, breakdown, inputs per category, warnings, notes). RFC 4180-compliant with UTF-8 BOM so Excel correctly renders Φ and ⚠️ symbols. Includes testable pure `buildCommercialLoadCSV()` helper.
- **Manual override of main breaker + bus rating** in the Recommended Service Sizing card: dropdown picks filtered to valid sizes (OCPD ≥ calculated amps, bus ≥ effective main breaker), utilization and color recalc live, "↺ Auto" resets to NEC-computed default. Overrides are tagged in both PDF and CSV exports with the NEC-auto value for audit trail.
- **Motor FLA auto-populate** from NEC 2023 Tables 430.248 (single-phase) and 430.250 (three-phase) when HP/voltage/phase changes. Manual edits are preserved until any driver input changes again. NEC reference value shown as a hint below each FLA field with a "Reset to NEC" button when overridden.

**Bug Fixes:**
- **Number input UX**: Fixed two long-standing bugs affecting all 15 number inputs in the Commercial Load Calculator: users couldn't clear the field to empty (Number('') coerced to 0 and snapped back) and typing produced leading zeros (e.g., "10" rendered as "010"). New reusable `<NumberInput>` component buffers typing as a local string, allowing empty/partial states mid-typing and normalizing on blur.
- **Riser / one-line diagram voltage label**: The UTIL symbol and "…V …Φ Service" badge in the top-left corner of the diagram were hardcoded to read `project.serviceVoltage` / `project.servicePhase`. Creating an MDP at a different voltage (e.g. 480V) left the labels stuck at the project default (e.g. 208V). Now derives from the MDP (`is_main: true`) when present, falling back to the project-level value.

**Files Created:**
- `data/nec/table-430-248-250.ts` — NEC 2023 motor full-load current tables + `getMotorFLA()` lookup with voltage-column mapping (120→115, 240→230, 480→460, 600→575)
- `components/common/NumberInput.tsx` — Reusable controlled numeric input
- `services/pdfExport/CommercialLoadDocument.tsx` — React-PDF Document component
- `services/pdfExport/commercialLoadExport.ts` — `exportCommercialLoadPDF()`, `exportCommercialLoadCSV()`, `buildCommercialLoadCSV()`

**Files Modified:**
- `components/CommercialLoadCalculator.tsx` — Manual overrides, motor FLA auto-populate, all inputs migrated to NumberInput, export buttons
- `components/OneLineDiagram.tsx` — Effective service voltage/phase derived from MDP at 4 display sites + export path
- `services/calculations/commercialLoad.ts` — Exported `STANDARD_OCPD_SIZES` and `STANDARD_SERVICE_BUS_RATINGS` for UI dropdowns
- `App.tsx` — Pass full `project` object (not just id) to CommercialLoadCalculator so exports can access metadata

---

## 2026-04-12: Stripe Live Mode & Admin Panel (Phase 3.0)

**New Features:**
- **Stripe live mode**: Migrated from test to live API keys, created live products/prices, deployed new webhook endpoint
- **Admin refund & cancel**: One-click refund of latest payment + subscription cancellation from admin panel
- **Trial expiration UI fixes**: FeatureGate now uses `effectivePlan` (not `plan`) so expired trials show "Free" correctly; fixed invisible "View Plans" button CSS
- **Branded email template**: SparkPlan-branded confirmation email with trial info and feature list
- **SMTP setup guide**: Step-by-step Resend + Vercel DNS configuration

**Files Created:**
- `supabase/functions/stripe-refund/index.ts` — Admin-only refund edge function
- `supabase/email-templates/confirmation.html` — Branded signup email
- `supabase/email-templates/SETUP.md` — Resend SMTP setup guide

**Files Modified:**
- `components/AdminPanel.tsx` — Refund button, confirmation dialog
- `components/FeatureGate.tsx` — `effectivePlan` fix for expired trials
- `components/TrialBanner.tsx` — Button visibility CSS fix

**Edge Functions Deployed:**
- `stripe-checkout` v16, `stripe-portal` v15, `stripe-webhook` v22, `stripe-refund` v2

---

## 2026-03-08: Subscriptions & Feature Gating (Phase 2.9)

**New Features:**
- **5-tier subscription system**: Free, Starter ($29), Pro ($49), Business ($149), Enterprise (custom)
- **Stripe Checkout**: Edge function creates checkout sessions with promo code support
- **Stripe Webhooks**: Handles checkout.session.completed, subscription CRUD, invoice.paid/failed
- **Stripe Billing Portal**: Self-service subscription management
- **Feature gating**: 40+ features mapped to plan tiers via `FeatureGate` component (blocking, subtle, inline modes)
- **14-day Business trial**: Auto-created on signup, countdown banner with urgency states
- **Pricing page**: Plan cards, feature comparison table, FAQ section
- **Admin panel**: User search, plan override, create/delete users, email confirmation
- **Real-time sync**: Subscription changes propagate instantly via Supabase channels

**Files Created:**
- `hooks/useSubscription.ts` — Subscription state, feature checks, Stripe integration
- `components/PricingPage.tsx` — Pricing page with comparison table
- `components/FeatureGate.tsx` — Feature access control component
- `components/TrialBanner.tsx` — Trial countdown + promo code input
- `components/AdminPanel.tsx` — Admin dashboard
- `supabase/functions/stripe-checkout/index.ts` — Checkout session creation
- `supabase/functions/stripe-webhook/index.ts` — Webhook event handler
- `supabase/functions/stripe-portal/index.ts` — Billing portal session
- `supabase/migrations/20260105_subscriptions.sql` — Subscriptions table
- `supabase/migrations/20260212_trial_and_admin.sql` — Admin RPC functions
- `supabase/migrations/20260212_admin_user_management.sql` — User management RPCs
- `supabase/migrations/20260217_admin_confirm_user.sql` — Email confirmation RPC

---

## 2026-02-22: User Profiles & Settings (Phase 2.8)

**New Features:**
- **Profile auto-creation**: Trigger creates profile row on user signup
- **Backfill migration**: Existing auth.users get profiles automatically
- **Account Settings page** (`/settings`): Name, company, license number, contact info
- **Permit Packet auto-fill**: "Prepared By" and license fields populate from profile
- **Sidebar display name**: Shows user's name from profile in navigation

**Files Created/Modified:**
- `hooks/useProfile.ts` — Single-row profile fetch/update hook
- `components/UserProfile.tsx` — Settings page
- `supabase/migrations/20260217_profile_creation_trigger.sql` — Trigger + backfill

---

## 2026-02-08: Multi-Family Project Population (Phase 2.7)

**New Features:**
- **Auto-Generation Service**: "Apply to Project" button creates full electrical hierarchy from MF EV calculator results — MDP, meter stack, house panel, EV sub-panel, unit panels, feeders, EVEMS circuits
- **Meter Stack & Meters**: New DB schema + hooks with realtime sync
- **CT Cabinet in One-Line Diagram**: Current transformer metering visualization (both interactive and print views)
- **Meter Stack Schedule PDF**: Permit-ready meter schedule in permit packet
- **Building/Unit Relationships**: Hooks + realtime subscription for multi-family hierarchy

**Files Created/Modified:**
- `services/autogeneration/multiFamilyProjectGenerator.ts` — 3 generation modes
- `services/autogeneration/projectPopulationOrchestrator.ts` — DB insertion in FK order
- `services/pdfExport/MeterStackSchedulePDF.tsx` — Permit-ready meter schedule
- `supabase/migrations/20260208_meter_stacks.sql` — meter_stacks + meters tables

---

## 2026-02-04: NEC 220.87 Measurement Path & Smart Defaults

**New Features:**
- **NEC 220.87 Dual-Path Support**: Can now determine building load via calculation (220.87(B)) OR measurement (220.87(A))
  - 12-month utility billing input (kW demand from utility records)
  - 30-day load study input (continuous metering data)
  - Measurement path often shows 30-50% MORE available capacity
- **Building Type Presets**: Smart defaults for common building types
  - Studio apartments, 1BR, 2BR, condos, townhomes, senior living
  - Auto-fills typical sq ft, common area loads, service size
  - "Don't know the details? Select building type" workflow
- **Documentation Updates**:
  - `STRATEGIC_ANALYSIS.md` refocused on Multi-Family EV only
  - `VALIDATION_ANALYSIS.md` updated with NEC 220.87 findings
  - Data collection guide for contractors added

**Files Modified:**
- `services/calculations/multiFamilyEV.ts` - NEC 220.87 measurement path logic
- `components/MultiFamilyEVCalculator.tsx` - Building presets UI, load method selector
- `services/pdfExport/MultiFamilyEVDocuments.tsx` - Shows load determination method

---

## 2026-01-31: Multi-Family EV Bug Fixes & Merge

**Branch**: `feature/multi-family-ev` → Merged to `main`

**Critical EVEMS Bug Fixes:**
- Bug #1: EVEMS showed fewer max chargers than direct connection (backwards!)
  - Added `directAlreadySufficient` check
  - Fixed missing variable references (`canAccommodateAllWithEVEMS`, `maxChargersWithEVEMS`)
- Bug #2: kW per charger exceeded physical charger limits (showed 11.4 kW for 32A @ 240V = 7.68 kW max)
  - Added cap at charger's physical maximum: `Math.min(perEVSEMaxKW, theoreticalKWPerCharger)`

**UI Cleanup:**
- Removed Cost Comparison card from calculator

**Commits:** `97ef322`, `5ed2640`, `4578565`, `68da43a`

---

## 2026-01-21: Multi-Family EV Calculator (Phase 2.5)

**New Features:**
- Multi-Family EV Readiness Calculator implementing NEC 220.84 + 220.57 + 625.42
- Building profile inputs (dwelling units, sq ft, common areas)
- EV charger configuration (Level 1/2, amps, chargers per unit)
- Itemized common area loads with NEC demand factors (220.42, 220.44, 620.14, 430.24)
- Building demand analysis with tiered demand factors
- EV capacity scenarios (with/without EVEMS load management)
- Service upgrade recommendation (none/panel-only/full-service)
- 3-page professional PDF export for city permits
- Integrated into Permit Packet Generator

**Files Created:**
- `services/calculations/multiFamilyEV.ts` (1400+ lines)
- `components/MultiFamilyEVCalculator.tsx` (~1100 lines)
- `services/pdfExport/MultiFamilyEVDocuments.tsx` (692 lines)
- `services/pdfExport/multiFamilyEVPDF.tsx` (84 lines)

---

## 2026-01-15: Feeder Sizing Bugs & UI Improvements

**Commit**: `8f80285`

**Bug Fixes:**
- Fixed transformer source → panel destination dropdown
- Added `getValidPanelDestinationsFromTransformer()` for connectivity validation
- Moved continuous load % slider to load-based sizing only (NEC 215.2(A)(1))
- Fixed transformer destination load aggregation

**UI Improvements:**
- Compact feeder and short circuit cards (50% height reduction)
- Cross-component feeder refresh via custom events

---

## 2026-01-12: AI Chatbot Enhancement & Tools

**New Action Tools:**
- `add_circuit`, `add_panel`, `fill_panel_with_test_loads`, `empty_panel`, `fill_with_spares`

**Read/Check Tools:**
- `get_project_summary`, `check_panel_capacity`, `calculate_feeder_voltage_drop`
- `check_conductor_sizing`, `check_service_upgrade`, `run_quick_inspection`

---

## 2025-12-30: UI/UX Improvements - Issues #24-27

**Issue #24: One-Line Diagram Separation**
- Added `diagramOnly` prop to OneLineDiagram component

**Issue #25: Inline Circuit Addition**
- Inline "+ Add Circuit" row in panel schedule table
- Comprehensive slot validation with multi-pole support

**Issue #26: Circuit Design Layout**
- 2-column layout (320px sidebar + 1fr diagram)
- Sticky diagram stays visible while scrolling

**Issue #27: Site Visit Status + Calendar Integration**
- Status dropdown: Scheduled ↔ In Progress ↔ Completed ↔ Cancelled
- Auto-sync with calendar events

---

## 2025-12-26: Python AI Backend Deployed

**URL**: https://neccompliance-production.up.railway.app

- Python FastAPI backend deployed to Railway
- 4 Pydantic AI agents operational
- Supabase integration configured
- Gemini AI 2.0 connected
- Real-time WebSocket subscriptions enabled

---

## 2025-12-20: Agentic PM System - Phase 0

- RFI Tracking with AI PDF extraction (Gemini Vision)
- Site Visit Logging with drag-and-drop photo upload
- Open Items Dashboard (cross-project aggregation)
- Calendar/Timeline with events, deadlines, meetings

---

## 2025-12-17: Service Upgrade Wizard

**Critical Compliance Fix:** Added 125% multiplier for calculated/manual loads per NEC 220.87
- Four determination methods: Utility Bill, Load Study, Calculated, Manual
- Only actual measurements skip 125% multiplier

---

## 2025-12-16: Short Circuit Calculator

- Service conductor parameters (real-world distance modeling)
- Critical bug fix: 3-phase impedance multiplier (was 40% underestimated)
- Calculation tracking system with results viewer
- PDF export (single calculation or full system report)
- Engineering accuracy per IEEE 141 (Red Book)

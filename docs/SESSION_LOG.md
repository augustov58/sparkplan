# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-04-16

---

### Session: 2026-04-16 — In-App Support System

**Focus**: Build an end-to-end support ticket system to replace the mailto-only channel. Deploy to Vercel preview for validation, then merge to main.
**Status**: Complete (merged to main via PR #3, merge commit `123324a`)

**Work Done:**

*Scaffold (branch `feat/support-system`, landed in `052ed7e`):*
- `support_tickets` + `support_replies` tables with RLS; storage bucket for image attachments
- `SupportWidget` floating bubble + ticket form + history + threaded reply view
- `AdminSupportPanel` with search/filter/status/priority controls and reply composer
- `useSupportTickets` hook: CRUD, realtime postgres_changes, optimistic updates
- `support-notify` edge function (Resend): `new_ticket` → support@sparkplan.app, `admin_reply` → user
- Deployed edge function v1/v2 via MCP `deploy_edge_function` (Supabase CLI wasn't authenticated)

*RLS fix (landed in `7896976`):*
- Diagnosed "permission denied for table users" error from Supabase postgres logs (MCP `get_logs`). Admin policies were subquerying `auth.users`, which `authenticated` role has no grant on. Because policies are OR-combined, every user hit the error — not just admins.
- Replaced all `(SELECT email FROM auth.users WHERE id = auth.uid())` subqueries with `(auth.jwt() ->> 'email')` which reads from the JWT claim.
- Migration: `supabase/migrations/20260416_fix_support_rls_use_jwt.sql`. Applied to support_tickets, support_replies, and storage.objects.

*Polish pass before merging (landed in `310d1a9`):*
- **Bubble position**: `md:left-6` → `md:left-[17rem]` so it clears the 16rem sidebar instead of overlapping "Sign Out" / "Account Settings"
- **Title color**: Forced `text-white` on the "Support" heading (was rendering as dark-green-on-dark-green)
- **Unread badges**: Added `user_last_seen_at` column + per-ticket `unread_count` computed via nested PostgREST select `'*, support_replies(created_at, is_admin)'`. Red badges on the floating bubble, "My tickets" tab, and individual ticket rows. Opening a ticket calls `markTicketSeen(id)` to bump the watermark.
- **Status-change email**: New `status_changed` payload type in `support-notify` (v3). Only fires from `adminMode` so the user's own reply auto-bumping to in_progress doesn't email them.
- **Replies realtime**: Added `support_replies` INSERT subscription so unread badge increments the instant an admin replies (no page refresh needed).

**Key Files:**
- `components/SupportWidget.tsx` — floating bubble, form, history, threaded view, unread badges
- `components/AdminSupportPanel.tsx` — admin dashboard
- `hooks/useSupportTickets.ts` — CRUD + realtime + unread + markTicketSeen + status-change email trigger
- `supabase/functions/support-notify/index.ts` — Resend handler for all 3 notification types
- `supabase/migrations/20260416_support_tickets.sql` — tables + RLS + storage bucket
- `supabase/migrations/20260416_fix_support_rls_use_jwt.sql` — JWT-claim admin policy fix
- `supabase/migrations/20260416_support_tickets_last_seen.sql` — unread watermark column

**Testing Flow:**
- User tests on Vercel preview (not locally) — workflow was commit → push → wait for preview → validate.
- Preview validated bubble position, title color, unread badge flow, and status-change email before merge.

**Pending (carried over):**
- Stripe webhook signature verification still disabled — must re-enable before real live-mode traffic
- No inbound-email → reply pipeline. Admin replies only work from the Admin Panel today; Gmail replies to notification emails won't thread back into the ticket system.

---

### Session: 2026-04-14 / 2026-04-15 — Commercial Load Calc UX + Export

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

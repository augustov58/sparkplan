# Implementation Plan — Permits (beta) Feature

**Status**: Ready for implementation
**Created**: 2026-05-09
**Owner**: Augusto (FL-licensed PE + platform owner)
**Predecessor**: PR #29 (`feat/sidebar-contractor-betas`) — adds the beta sidebar entry + `/permits` stub route + `feature_interest` table for demand discovery
**Tier gating**: Business + Enterprise (matches sibling PM features). Trial users have full access via `effectivePlan` when `status === 'trialing'`.

---

## 1. Why this feature

External market research (small electrical shops $1M–$10M annual revenue) ranked **permit + inspection lifecycle** as the #2 unmet pain point for SparkPlan's target persona, behind only Estimating. Specific findings from the research:

- Electricians pull more permits than almost any other trade. Every job that adds/modifies circuits, replaces a panel, or installs subpanels requires a permit + scheduled inspection.
- Permit delays of 3–10 business days are common. Contractors juggle 5–15 active permits across multiple AHJs at any time.
- No affordable software under $500/month handles electrical permit workflows. PermitFlow raised $91M but targets large GCs/developers (Amazon, IKEA, Lennar), not small electrical shops.

SparkPlan's existing assets (the AI Inspector, the Permit Packet generator, the AHJ database for FL pilot jurisdictions, the `IssuesLog`) sit at the *output* end of the lifecycle. This feature adds the **input + tracking** end so the contractor can manage a permit from "we're going to file this" through "AHJ closed it out" inside one tool.

---

## 2. Domain model — the workflow we're modeling

```
DRAFT  →  SUBMITTED  →  IN_REVIEW  →  RETURNED   →  RESUBMITTED  →  APPROVED  →  EXPIRED
                                ↘                              ↗                ↓
                                  (corrections requested)                       INSPECTIONS:
                                                                                rough_in scheduled
                                                                                rough_in passed/failed
                                                                                final scheduled
                                                                                final passed/failed
                                                                                ↓
                                                                                CLOSED (CO issued)
```

Critical observations from FL pilot AHJs:
- **One project can have multiple permits.** A multi-family build commonly has separate electrical, EVSE, and low-voltage permits. Service-upgrade-only jobs typically have one. **Plan for 1:N.**
- **Each permit has multiple inspections.** Rough-in, underground (if applicable), service inspection, final. **Plan for 1:N.**
- **A failed inspection produces corrections** that must be resolved before reinspection. The existing `issues` table already models corrections (`severity`, `status`, `article`, `description`, `notes`, `photo_url`). Reuse it. Add an FK to the failed inspection.
- **AHJ contact varies per permit.** Not just per AHJ — even within one AHJ, plan reviewers and inspectors are different people. Store contact info per permit, not per AHJ.
- **Permits expire.** FL standard is 180 days from issuance unless work commenced and a passed inspection is on file (FBC 105.4). Need expiration tracking + warnings.

---

## 3. Phase split (so this doesn't sprawl into a 3-month build)

| Phase | Scope | Effort | Ships when |
|---|---|---|---|
| **Phase 1 (MVP)** — this implementation plan | Permits page tabs (Overview / Permits / Inspections / Issues). Permit + inspection CRUD. Migrate existing `IssuesLog` UI as the Issues tab. Manual permit-status updates. Redirect old `/issues` route. | ~1 week | First | 
| **Phase 2** | AHJ contact integration (auto-populate from existing FL AHJ database for known jurisdictions). Inspection scheduling (calendar integration with existing `CalendarView`). Expiration warnings (banner when ≤30 days). Corrections-to-issue linkage. | ~1 week | After Phase 1 demand signal |
| **Phase 3** | AI assistance — chatbot tools `update_permit_status`, `schedule_inspection`, `summarize_corrections`. Auto-draft inspection narratives. Permit-packet integration (auto-link generated packet to the permit). | ~1 week | After Phase 2 |
| **Phase 4** (deferred) | AHJ portal scraping (per-AHJ — Orange County, Miami-Dade, Pompano have public permit-search portals). Automated status syncing. Email notifications for status changes. | ~3-4 weeks per AHJ | Post-validation |

**This document plans Phase 1 only.** Phases 2-4 are referenced for context but are out of scope.

---

## 4. Phase 1 — Detailed plan

### 4.1 Goal

Replace the current `/permits` stub (in `components/PermitsStub.tsx`) with a real permits page. The new page is a **tabbed interface** with four tabs:

1. **Overview** — at-a-glance card per permit, key dates, action items
2. **Permits** — full list, expandable rows, CRUD
3. **Inspections** — flat list across all permits, status, scheduled dates
4. **Issues** — exact existing `IssuesLog` UI relocated as a tab

Old `/issues` route redirects to `/permits?tab=issues`. The "until then, open Inspection & Issues directly →" forward-link in `PermitsStub` is removed.

### 4.2 Data model — new tables

#### `permits`

```sql
CREATE TABLE public.permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Permit identification
  permit_number TEXT,                          -- nullable until AHJ assigns one
  permit_type TEXT NOT NULL DEFAULT 'electrical', -- 'electrical' | 'evse' | 'low_voltage' | 'service_upgrade' | 'other'
  description TEXT,                            -- one-line scope summary

  -- AHJ
  ahj_jurisdiction TEXT NOT NULL,              -- e.g. 'Orange County, FL'
  ahj_contact_name TEXT,
  ahj_contact_email TEXT,
  ahj_contact_phone TEXT,

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'draft',
                                               -- 'draft' | 'submitted' | 'in_review' | 'returned'
                                               -- | 'approved' | 'expired' | 'closed' | 'cancelled'
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,                      -- typically approved_at + 180 days
  closed_at TIMESTAMPTZ,

  -- Fees
  fee_amount NUMERIC(10,2),
  fee_paid_at TIMESTAMPTZ,
  fee_receipt_url TEXT,                        -- supabase storage URL

  -- Plan review reference (AHJ-side ID)
  plan_review_id TEXT,

  -- Conditions / notes / packet linkage
  conditions JSONB DEFAULT '[]'::jsonb,        -- array of {text, source: 'ahj' | 'self', acknowledged: boolean}
  notes TEXT,
  packet_url TEXT,                             -- supabase storage URL of the generated permit-packet PDF
  packet_generated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT permits_status_known
    CHECK (status IN ('draft','submitted','in_review','returned','approved','expired','closed','cancelled')),
  CONSTRAINT permits_type_known
    CHECK (permit_type IN ('electrical','evse','low_voltage','service_upgrade','other')),
  CONSTRAINT permits_email_format
    CHECK (ahj_contact_email IS NULL OR ahj_contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_permits_project ON public.permits(project_id);
CREATE INDEX idx_permits_status ON public.permits(status, expires_at) WHERE status NOT IN ('closed', 'cancelled');
CREATE INDEX idx_permits_user ON public.permits(user_id);

ALTER TABLE public.permits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permits_select_own" ON public.permits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "permits_insert_own" ON public.permits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "permits_update_own" ON public.permits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "permits_delete_own" ON public.permits FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER permits_updated_at
  BEFORE UPDATE ON public.permits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

#### `permit_inspections`

```sql
CREATE TABLE public.permit_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id UUID NOT NULL REFERENCES public.permits(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Inspection identification
  inspection_type TEXT NOT NULL,
                                          -- 'rough_in' | 'underground' | 'service' | 'final' | 'temporary' | 'reinspection' | 'other'
  sequence INTEGER NOT NULL DEFAULT 1,    -- 1st, 2nd, 3rd attempt of this type for this permit
  description TEXT,                       -- free text, e.g. "Service inspection for 200A upgrade"

  -- Scheduling
  scheduled_date DATE,
  scheduled_window TEXT,                  -- e.g. 'AM' | 'PM' | '8-12' | 'all day'

  -- Inspector
  inspector_name TEXT,

  -- Result
  status TEXT NOT NULL DEFAULT 'scheduled',
                                          -- 'scheduled' | 'passed' | 'failed' | 'conditional_pass' | 'cancelled' | 'no_show'
  performed_at TIMESTAMPTZ,
  result_notes TEXT,                      -- inspector's notes / corrections list

  -- For reinspections: link to the original failed inspection
  parent_inspection_id UUID REFERENCES public.permit_inspections(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT permit_inspections_status_known
    CHECK (status IN ('scheduled','passed','failed','conditional_pass','cancelled','no_show')),
  CONSTRAINT permit_inspections_type_known
    CHECK (inspection_type IN ('rough_in','underground','service','final','temporary','reinspection','other'))
);

CREATE INDEX idx_permit_inspections_permit ON public.permit_inspections(permit_id);
CREATE INDEX idx_permit_inspections_scheduled ON public.permit_inspections(scheduled_date) WHERE status = 'scheduled';
CREATE INDEX idx_permit_inspections_project ON public.permit_inspections(project_id);

ALTER TABLE public.permit_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permit_inspections_select_own" ON public.permit_inspections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "permit_inspections_insert_own" ON public.permit_inspections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "permit_inspections_update_own" ON public.permit_inspections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "permit_inspections_delete_own" ON public.permit_inspections FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER permit_inspections_updated_at
  BEFORE UPDATE ON public.permit_inspections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

#### Modify existing `issues` table — add inspection FK

```sql
-- Phase 1.5 (do in same migration if scope allows; otherwise Phase 2):
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS permit_inspection_id UUID
    REFERENCES public.permit_inspections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_issues_inspection ON public.issues(permit_inspection_id)
  WHERE permit_inspection_id IS NOT NULL;
```

This lets a failed inspection's corrections be tracked as `issues` rows linked back to the inspection. Phase 1 leaves the link nullable so existing issues keep working unchanged.

#### Migration filename

`supabase/migrations/20260510_permits_and_inspections.sql`

> **Verification**: before running this migration, confirm that `public.set_updated_at()` exists in the schema. If it does not (search prior migrations for `CREATE FUNCTION set_updated_at`), the trigger creation lines above will fail. Either create the function in this migration or remove the trigger DDL and rely on the application layer to set `updated_at` on update. Cheap to check; one bad assumption away from a broken migration.

### 4.3 File tree — new + modified

#### New files

```
components/Permits/
  PermitsPage.tsx              -- Top-level page with tabs (Overview/Permits/Inspections/Issues)
  PermitsListTab.tsx           -- "Permits" tab — list + CRUD UI
  PermitDetailDrawer.tsx       -- Slide-out drawer for editing a single permit
  PermitStatusPill.tsx         -- Reusable status pill (color-coded by status)
  PermitsOverviewTab.tsx       -- "Overview" tab — summary cards
  InspectionsListTab.tsx       -- "Inspections" tab — flat list across all permits
  InspectionDetailDrawer.tsx   -- Slide-out drawer for editing a single inspection
  IssuesTab.tsx                -- Wrapper around existing IssuesLog component (or a thin re-export)

hooks/
  usePermits.ts                -- CRUD hook with optimistic update + realtime, copy from usePanels pattern exactly
  usePermitInspections.ts      -- Same pattern, scoped to permit_id

services/
  permits/
    permitStatusTransitions.ts -- Pure function: which next-statuses are valid given current status. Returns string[].
    permitExpirationWarning.ts -- Pure function: given expires_at, returns null | 'expiring_soon' | 'expired'. Threshold: 30 days = expiring_soon.

lib/
  validation-schemas.ts        -- Add permitSchema + permitInspectionSchema (Zod)

supabase/migrations/
  20260510_permits_and_inspections.sql
```

#### Modified files

| File | Change |
|---|---|
| `App.tsx` | Replace `<PermitsStub>` with `<PermitsPage>` for `/permits` route. Add redirect: `/issues` → `/permits?tab=issues` (use `<Navigate replace>` per react-router-dom v6 docs). |
| `components/PermitsStub.tsx` | Delete this file (functionality moved into `PermitsPage`). |
| `components/Layout.tsx` | No change — sidebar already links to `/permits` per PR #29. |
| `lib/database.types.ts` | Regenerate via `supabase gen types typescript` after migration applied (or manually edit to match — match prior migration style). |
| `lib/dataRefreshEvents.ts` | Add `permits` and `permit_inspections` event types. Pattern: existing `panels` / `circuits` entries. |
| `lib/toast.ts` | Add `toastMessages.permit` and `toastMessages.inspection` entries. |
| `services/ai/projectContextBuilder.ts` | Phase 1: surface permit count + open inspection count in the AI's project context summary. Phase 3 will add full per-permit detail. |
| `services/ai/chatTools.ts` | Phase 3 territory — DO NOT add chatbot tools in Phase 1. Note in the comment block. |
| `docs/database-architecture.md` | Add `permits` + `permit_inspections` table sections. Note the `issues.permit_inspection_id` addition. |
| `docs/CHANGELOG.md` | New entry. |
| `docs/SESSION_LOG.md` | New session entry; rotate older one out per "keep last 2." |
| `ROADMAP.md` | Add Phase 3.6 (Permits Beta v1) section. Mark Phase 3.5 complete. |

### 4.4 UI structure

#### Page layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ Permits  (beta)                                          [+ New permit]│
├────────────────────────────────────────────────────────────────────────┤
│ [Overview] [Permits] [Inspections] [Issues]    ← tab strip             │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ (tab content here)                                                     │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

- Tab persistence in URL: `?tab=overview|permits|inspections|issues`. Default `overview` if no param.
- Active tab persists across page reload.

#### Overview tab

```
┌──────────────────────────────────────────────────────────────────────┐
│ Active permits: 2                                                    │
│                                                                      │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ Electrical Permit  [APPROVED]                                  │   │
│ │ Orange County, FL · Permit #ELE-2026-04829                     │   │
│ │ Approved 2026-04-15 · Expires 2026-10-12 (156 days)            │   │
│ │ Next: Final inspection scheduled 2026-06-20                    │   │
│ └────────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ EVSE Permit  [SUBMITTED]                                       │   │
│ │ Orange County, FL · Permit # pending                           │   │
│ │ Submitted 2026-05-02 · Awaiting review                         │   │
│ └────────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ Recent activity                                                      │
│  · 2026-05-08  Rough-in inspection passed (Electrical Permit)        │
│  · 2026-05-02  EVSE Permit submitted                                 │
└──────────────────────────────────────────────────────────────────────┘
```

#### Permits tab

```
┌──────────────────────────────────────────────────────────────────────┐
│ All permits for this project                                         │
│                                                                      │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ Type        | Number      | AHJ        | Status   | Expires    │   │
│ │ Electrical  | ELE-...4829 | Orange Co. | APPROVED | 156 days   │   │
│ │ EVSE        | (pending)   | Orange Co. | SUBMITTED| —          │   │
│ │ Low-voltage | —           | Orange Co. | DRAFT    | —          │   │
│ └────────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ Click a row to open the detail drawer.                               │
└──────────────────────────────────────────────────────────────────────┘
```

#### Permit detail drawer

```
┌─────────────────────────────────────────┐
│ Electrical Permit                    [×]│
│ ────────────────────────────────────────│
│ Status: [APPROVED ▾]                    │
│   ↑ click to advance to next valid      │
│     state — guarded by                  │
│     permitStatusTransitions.ts          │
│                                         │
│ Permit number: [ELE-2026-04829      ]   │
│ Type:          [Electrical          ▾]  │
│ Description:   [200A service upgrade]   │
│                                         │
│ AHJ:           [Orange County, FL   ]   │
│ Plan reviewer: [Maria Sanchez       ]   │
│   email:       [maria.sanchez@ocfl…]    │
│   phone:       [407-555-0193        ]   │
│                                         │
│ Submitted:     [2026-04-08          ]   │
│ Approved:      [2026-04-15          ]   │
│ Expires:       [2026-10-12          ]   │
│ Fee paid:      [$185.00 on 2026-04-09]  │
│                                         │
│ Conditions (3):                         │
│   ✓ Provide NRTL listing for EVSE      │
│   ✓ AIC labels on all panels            │
│   ☐ Submit revised one-line for review  │
│                                         │
│ Linked permit packet:                   │
│   permit-packet-2026-04-08.pdf  [open]  │
│                                         │
│ Inspections (4):                        │
│   ✓ Rough-in       2026-05-08 PASSED    │
│   ✓ Service        2026-05-15 PASSED    │
│   ⏳ Final         2026-06-20 SCHEDULED │
│                                         │
│ [Save] [Delete] [Close]                 │
└─────────────────────────────────────────┘
```

#### Inspections tab

Flat table across all permits in the project:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Inspections (4)                                                      │
│                                                                      │
│ Type        | Permit       | Scheduled    | Inspector  | Status      │
│ ──────────────────────────────────────────────────────────────────── │
│ Rough-in    | Electrical   | 2026-05-08   | J. Smith   | ✓ PASSED   │
│ Service     | Electrical   | 2026-05-15   | J. Smith   | ✓ PASSED   │
│ Final       | Electrical   | 2026-06-20   | (pending)  | ⏳ SCHEDULED│
│ Rough-in    | EVSE         | (unscheduled)| —          | (unsched)  │
└──────────────────────────────────────────────────────────────────────┘
```

#### Issues tab

Render the existing `IssuesLog` component as-is, no behavioral changes. Phase 2 will add the inspection-FK linkage in the UI.

### 4.5 Status transitions

Implement in `services/permits/permitStatusTransitions.ts`:

```typescript
const TRANSITIONS: Record<PermitStatus, PermitStatus[]> = {
  draft:        ['submitted', 'cancelled'],
  submitted:    ['in_review', 'returned', 'approved', 'cancelled'],
  in_review:    ['approved', 'returned', 'cancelled'],
  returned:     ['submitted', 'cancelled'],     // resubmit after corrections
  approved:     ['expired', 'closed', 'cancelled'],
  expired:      ['closed'],                      // late closure if work was completed
  closed:       [],                              // terminal
  cancelled:    [],                              // terminal
};
```

The detail drawer's status dropdown shows only valid next states. Backwards transitions (e.g. approved → in_review) require the user to click "Reopen" which sets status to `in_review` — keeps the audit trail honest.

### 4.6 Expiration warnings

`services/permits/permitExpirationWarning.ts`:

```typescript
type ExpirationStatus = null | 'expiring_soon' | 'expired';

export function getExpirationStatus(expires_at: string | null): ExpirationStatus {
  if (!expires_at) return null;
  const days = daysBetween(new Date(), new Date(expires_at));
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring_soon';
  return null;
}
```

UI: Overview tab + Permits tab show an amber chip ("Expires in 18 days") when `expiring_soon`, red chip ("Expired 3 days ago") when `expired`. Per FBC 105.4 / NFPA 70 convention.

### 4.7 Routing changes

In `App.tsx`:

1. Replace the `/permits` route's element from `<PermitsStub>` to `<PermitsPage>` (still wrapped in `<FeatureGate feature="permits">` per PR #29).
2. Replace the existing `/issues` route element with a redirect:
   ```tsx
   <Route path="/issues" element={<Navigate to={`/project/${project.id}/permits?tab=issues`} replace />} />
   ```
   Keep the route declaration so direct-link bookmarks still resolve.
3. Delete `components/PermitsStub.tsx`.
4. Remove the lazy import `const PermitsStub = ...` from App.tsx.

### 4.8 Hooks pattern

`hooks/usePermits.ts` follows the **exact** pattern of `hooks/usePanels.ts`:
- Optimistic update on insert/update/delete
- Realtime Supabase subscription scoped to `project_id` filter
- Toast on each operation via `toastMessages.permit`
- Returns `{ permits, loading, addPermit, updatePermit, deletePermit }`
- Refresh event published via `notifyDataRefresh('permits')`

`hooks/usePermitInspections.ts` follows the same pattern, but additionally takes a `permitId` filter for the per-permit detail drawer view. The hook should return the **full** project-wide list when `permitId` is undefined (used by the Inspections tab) and the filtered list when `permitId` is set (used by the Permit drawer).

### 4.9 Validation (Zod schemas)

Add to `lib/validation-schemas.ts`:

```typescript
export const permitSchema = z.object({
  project_id: z.string().uuid(),
  permit_number: z.string().max(64).optional().nullable(),
  permit_type: z.enum(['electrical','evse','low_voltage','service_upgrade','other']),
  description: z.string().max(500).optional().nullable(),
  ahj_jurisdiction: z.string().min(1).max(200),
  ahj_contact_name: z.string().max(200).optional().nullable(),
  ahj_contact_email: z.string().email().optional().nullable().or(z.literal('')),
  ahj_contact_phone: z.string().max(40).optional().nullable(),
  status: z.enum(['draft','submitted','in_review','returned','approved','expired','closed','cancelled']),
  // ... dates as ISO strings, fees as numbers
});

export const permitInspectionSchema = z.object({
  permit_id: z.string().uuid(),
  inspection_type: z.enum(['rough_in','underground','service','final','temporary','reinspection','other']),
  sequence: z.number().int().min(1).default(1),
  description: z.string().max(500).optional().nullable(),
  scheduled_date: z.string().date().optional().nullable(),
  // ...
});
```

Per `feedback_validation_advisory` memory: validation is **soft warnings, not hard gates**. Save partial / draft permits — let the contractor stage the data without forcing every field at once.

### 4.10 Tests

Add to `tests/`:

| Test file | What it covers |
|---|---|
| `tests/permits/statusTransitions.test.ts` | Pure-function tests for every state in TRANSITIONS map. Verify terminal states have empty next-state arrays. Verify backwards transitions are rejected. |
| `tests/permits/expirationWarning.test.ts` | Pure-function tests for `getExpirationStatus`. Edge cases: null input, exactly 30 days, exactly 0 days, past date, far-future date. |
| `tests/permits/permitsCrud.test.ts` | Integration test: add permit, update status, delete. Mock supabase client. |

**Do not mock the database in CRUD tests.** Per `feedback_testing` memory equivalent — integration tests must hit a real database, not mocks. (Use the existing test setup that connects to the local Supabase instance — see `tests/calculations.test.ts` for the pattern.)

Acceptance: 208 + ~15 new = ~223 tests passing.

### 4.11 Documentation updates

Per CLAUDE.md "Linked Documents — Keep in Sync" rules, after merging:

| File | Update |
|---|---|
| `docs/CHANGELOG.md` | New "2026-05-XX: Permits beta v1 (PR #XX)" entry |
| `docs/SESSION_LOG.md` | New session entry; rotate older one |
| `docs/database-architecture.md` | New `permits` + `permit_inspections` table sections |
| `ROADMAP.md` | Add **Phase 3.6: Permits Beta v1** section. Mark Phase 3.5 (sidebar pivot) complete. |
| `business/STRATEGIC_ANALYSIS.md` | Update feature inventory: "Permit + inspection lifecycle tracking" added |

---

## 5. Decisions to confirm before starting

If any of these are wrong, the plan needs revision. **Confirm before writing code.**

1. **Permit number is nullable.** Contractors often track permits in SparkPlan *before* the AHJ assigns a number — for fee receipts and submission status. Confirmed: nullable.
2. **One permit per record (not multi-permit umbrella).** Each electrical / EVSE / low-voltage permit is its own row. Confirmed: 1:N relationship from project to permit.
3. **`issues.permit_inspection_id` is nullable and added in this PR.** Phase 1 ships the column but doesn't change `IssuesLog` UI to use it. Phase 2 wires the UI.
4. **Phase 1 has no chatbot tools.** AI integration is Phase 3. Don't prematurely add `update_permit_status` / `schedule_inspection` tools.
5. **Phase 1 has no AHJ-portal scraping.** Status is manually advanced by the contractor via the dropdown. Auto-sync is Phase 4.
6. **No email notifications in Phase 1.** Status changes trigger toasts only. SES/Resend integration is Phase 3 territory.
7. **AHJ contact stored per-permit, not per-AHJ.** Plan reviewers and inspectors at the same AHJ are different people. Don't normalize prematurely.
8. **Permit packet linkage is one-way (permit → packet URL).** A permit can reference a generated packet PDF; the packet generator doesn't yet know about permits. Phase 3 may two-way link.
9. **Status transitions are guarded but not immutable history.** Phase 1 just enforces valid next-states. Phase 2 may add a `permit_status_history` table for audit log if AHJs require it.

---

## 6. Out of scope for Phase 1 (deferred)

- AHJ portal scraping / API integration (Phase 4)
- Email notifications (Phase 3)
- Chatbot tools (Phase 3)
- Auto-link generated packet → permit on packet generation (Phase 3)
- AHJ contact deduplication / shared contact directory (deferred indefinitely)
- Multi-user assignment ("assigned to" beyond the existing `issues.assigned_to`)
- Photo upload for fee receipts (Phase 2 — same supabase storage pattern as `project_photos`)
- Print/export view (Phase 2)
- Status-change audit log (Phase 2 if AHJs require it; otherwise deferred)
- Permission tiers within a project (e.g. "estimator can view permits, only PM can update status") — not modeled today, defer

---

## 7. File-by-file implementation order

Suggested order to keep build green at every step:

1. **Migration** — write `supabase/migrations/20260510_permits_and_inspections.sql`. Apply to local Supabase. Run `npm run build` (will still pass — no code changes yet).
2. **Types** — regenerate `lib/database.types.ts` (or manually patch).
3. **Toasts + refresh events** — add `permits` + `permit_inspections` keys.
4. **Validation schemas** — add Zod schemas to `lib/validation-schemas.ts`.
5. **Pure services** — `permitStatusTransitions.ts` + `permitExpirationWarning.ts`. Add their unit tests. Run `npm test`.
6. **Hooks** — `usePermits.ts` + `usePermitInspections.ts`, copying `usePanels.ts` pattern.
7. **Status pill** — `PermitStatusPill.tsx` (smallest reusable piece).
8. **PermitsPage** — top-level tab orchestration. Routes wired up.
9. **PermitsListTab** + **PermitDetailDrawer** — main CRUD UX.
10. **InspectionsListTab** + **InspectionDetailDrawer**.
11. **PermitsOverviewTab** — summary cards + recent activity.
12. **IssuesTab** — wraps existing `IssuesLog`.
13. **Routing change** — in `App.tsx`, swap `<PermitsStub>` for `<PermitsPage>`, add `/issues` redirect, delete `PermitsStub.tsx`.
14. **Project context surfacing** — add permit count + open inspection count to `services/ai/projectContextBuilder.ts`.
15. **Tests** — integration test (`tests/permits/permitsCrud.test.ts`).
16. **Docs** — CHANGELOG, SESSION_LOG, database-architecture, ROADMAP.

After each step, run `npm run build` and `npm test`. Commit at logical boundaries (~3-4 commits across the build).

---

## 8. Quick context for fresh claude

If you're picking this up after a context clear, here's what you need to know:

- **You're working on PR after #29.** PR #29 (`feat/sidebar-contractor-betas`) added a stub for `/permits`; this PR replaces the stub with the real feature.
- **Augusto is the platform owner AND a Florida-licensed PE.** SparkPlan offers PE-as-service as a paid upsell; the contractor exemption (no PE seal needed for low-value work) is the default lane. See user-role memory.
- **Validation is advisory, not blocking.** Save partial drafts. Don't gate the contractor on missing fields. See feedback memory.
- **Don't mock the database in tests.** Integration tests hit a real Supabase. See feedback memory.
- **NEVER commit directly to main.** Branch off main as `feat/permits-beta-v1` (or similar). PR against main when ready.
- **Run `npm run build` and `npm test` after each significant change.** Per CLAUDE.md verification protocol — runtime bugs are cheaper to catch in the step that introduced them.
- **All hooks follow the optimistic + realtime pattern in `hooks/usePanels.ts`.** Don't reinvent.
- **All toast messages route through `lib/toast.ts`.** Don't call `toast.success(...)` directly.
- **PR #29's `feature_interest` migration may not be applied yet** — check first. If not, apply it before this work so the demand-discovery beta page still records signals from non-Permits-route betas.
- **Tier gating is done.** Per PR #29's last commit, `permits` is in `FEATURE_TIERS` as `['business', 'enterprise']`. Trial users have access automatically. No tier work needed in this implementation.
- **Sidebar entry exists.** `Permits (beta)` chip already renders. Don't touch `Layout.tsx`.

---

## 9. Estimated PR size

- Migration: ~150 LOC SQL
- Hooks: ~250 LOC TS (2 hooks × ~125 each)
- Pure services + tests: ~150 LOC TS
- React components: ~800 LOC TSX (8 components)
- Routing + cleanup: ~30 LOC
- Tests: ~250 LOC TS
- Docs: ~150 LOC markdown across 4 files

**Total: ~1,800 LOC** across one branch. 3-4 commits. Reviewable in a single PR.

Build target: 4-5 second clean build, 220+ tests passing.

---

## 10. Phase 1 Definition of Done

- [ ] Migration applied to Supabase
- [ ] `permits` + `permit_inspections` tables present, RLS enforced, indexes created
- [ ] `/permits` route renders the new `PermitsPage` (not the stub)
- [ ] All 4 tabs functional with tab-switching via URL `?tab=` param
- [ ] Permit CRUD: add, edit, status-advance, delete (with confirmation)
- [ ] Inspection CRUD: same
- [ ] Issues tab renders the existing `IssuesLog` component unchanged
- [ ] `/issues` route redirects to `/permits?tab=issues`
- [ ] Sidebar `Permits (beta)` chip still renders correctly (no regression)
- [ ] FeatureGate still in place (Business + Enterprise + trial users)
- [ ] Expiration warnings render in Overview + Permits tabs
- [ ] Status-pill colors match design (DRAFT gray, SUBMITTED amber, APPROVED green, EXPIRED red, etc.)
- [ ] `npm run build` clean
- [ ] `npm test` — 220+ tests passing
- [ ] Manual smoke: create a permit, advance status through the full lifecycle, schedule an inspection, mark it failed, see the corrections placeholder, mark reinspection
- [ ] Docs updated (CHANGELOG, SESSION_LOG, database-architecture, ROADMAP)
- [ ] PR opened against `main`, mergeable CLEAN

---

**End of plan.** Hand to fresh context with: *"Implement the Permits feature per `docs/plans/permits-implementation.md`. Phase 1 only. Branch off main."*

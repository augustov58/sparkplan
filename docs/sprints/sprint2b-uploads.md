# Sprint 2B — Uploads + Merge Engine + Title Sheet Pattern

**Status:** ✅ COMPLETE 2026-05-12 (3 PRs merged: PR #45 foundation + PR #47 upload UI + PR #49 merge engine). PR-4 manifest scaffold on deck.
**Last Updated:** 2026-05-12
**Hard prerequisites:** Sprint 2A schema additions (`service_modification_type` enum) — needed for the Orlando manifest fork
**Inherits from:** [`sprint2a-form-factor.md`](./sprint2a-form-factor.md) — sheet ID category bands (`packetSections.ts`), section toggle UI + `projects.settings` persistence, generator builder pattern
**Index:** [`docs/sprints/README.md`](./README.md)
**Parent doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](../AHJ_COMPLIANCE_AUDIT_2026-05-04.md)

**Estimated complexity:** 1–2 weeks. Architectural inflection.

---

## Why this sprint exists

Sprint 2A closed all the systemic-rejection vectors that come from generated content. What's left for an Orlando submittal to clear intake is **user-supplied artifacts**: site plans, equipment cut sheets, fire stopping schedules, NOC, HOA letters. SparkPlan can't generate these — contractors bring them as PDFs from Bluebeam, Adobe, AutoCAD LT, or hand-drawn-and-scanned. Sprint 2B builds the upload-and-merge pipeline that splices them into the packet with SparkPlan-themed title sheets, stamping continuous sheet IDs across the entire merged document. This is also the architectural foundation Sprint 3 needs: `pdf-lib` is the same library that does PAdES digital signing for PE seals.

---

## Open work

### Findings closed by this sprint

| ID | Finding | AHJ source | Closed by |
|---|---|---|---|
| **H5** | Notice of Commencement (NOC) placeholder for projects > $5,000 | Orlando | Upload slot enabled by PR #49 (`fce6275`, 2026-05-12); per-AHJ wiring → PR-4 |
| **H6** | HOA / condo approval letter placeholder | Pompano (multi-family) | Upload slot enabled by PR #49 (`fce6275`, 2026-05-12); per-AHJ wiring → PR-4 |
| **H7** | Site plan / survey | All 5 AHJs; Orlando #6 (existing-service) + #6/#7 (new-service) | Upload slot enabled by PR #49 (`fce6275`, 2026-05-12); per-AHJ wiring → PR-4 |
| **H8** | Equipment cut sheets / installation manuals | Pompano; Orlando #7 (both paths) for EVSE specs | Upload slot enabled by PR #49 (`fce6275`, 2026-05-12); per-AHJ wiring → PR-4 |
| **H16** | Fire stopping schedule for fire-rated penetrations | Orlando #8 (both paths) | Upload slot enabled by PR #49 (`fce6275`, 2026-05-12); per-AHJ wiring → PR-4 |
| **H19** | HVHZ wind-anchoring documentation for outdoor pedestal/bollard EVSE | Miami-Dade + Pompano (statewide for outdoor EVSE) | `artifact_type='hvhz_anchoring'` added by PR #49 (`fce6275`, 2026-05-12); per-AHJ wiring → Sprint 2C M1 |

---

## What landed (PR #49 — squash `fce6275`, merged 2026-05-12)

17 commits, 5,580 LOC, iterative v1 → v5 review cycle (user is FL-licensed PE + platform owner, drove feature scope). PR-3 of the Sprint 2B series — closes the merge engine half of the sprint. Pairs with PR #45 (foundation) + PR #47 (upload UI).

**Merge engine** (`services/pdfExport/`)
- `mergePacket.ts` — pure pdf-lib function. SparkPlan portion + (title sheet + upload) × N → merged `Uint8Array`. Never throws (per CLAUDE.md calc-service contract); returns `warnings[]` for corrupted/encrypted/zero-byte/zero-page uploads. Skipped attachments don't block the merge — output always includes everything that succeeded.
- `stampSheetIds.ts` — pure pdf-lib function. Stamps continuous IDs (e.g., `C-201`, `X-203`) in bottom-right of upload pages after merge.
- `compositeTitleBlock.ts` — pure pdf-lib function. Overlays SparkPlan title block onto upload's own page via `embedPdf` + `drawPage`. Transparent background verified via `/ca 0` ExtGState.
- `permitPacketGenerator.tsx` — orchestrator branches on `cover_mode` per attachment.

**Title sheets** (`services/pdfExport/`)
- `AttachmentTitleSheet.tsx` — size-aware react-pdf cover matching each upload's first-page dimensions (Letter portrait/landscape, Tabloid, ARCH C, ARCH D). Full architectural title-block layout: perimeter rule, right-margin vertical title-block strip with labeled cells (Project / Address / Prepared For / Permit-Job-No. / FL Reg/Seal / Seal Area / NOT FOR CONSTRUCTION / Revisions), centered drawing title, bottom-right Sheet block, bottom-left "Original sheet size" boilerplate. Sprint 2A `wrap={false}` pattern applied to central content card.
- `AttachmentTitleBlock.tsx` — title-block-only variant used by the overlay path.

**3-mode cover behavior**
- `cover_mode` enum: `'separate'` (own preceding page, default), `'overlay'` (composited onto upload's first page), `'none'` (upload as-is for HOK-style pre-bordered drawings). UI is a 3-segment radio on each `AttachmentUploadCard`.

**Per-upload overrides**
- `custom_sheet_id` (nullable) — inline pill `SheetIdEditor`, advisory format validation `^[A-Z][A-Za-z0-9]*-[A-Za-z0-9.-]+$`, cross-project duplicate detection. Doesn't burn the discipline counter.
- `discipline_override` (nullable) — A / C / E / M / P / S / X dropdown. Widens `SheetDiscipline` type; band counter still advances normally.
- `artifact_type='hvhz_anchoring'` — Sprint 2C H19 slot; 8th upload card in `PermitPacketGenerator`.

**Migrations applied to live Supabase (verified)**
- `20260513_attachment_hvhz_anchoring.sql` — extends `artifact_type` CHECK to 8 values.
- `20260514_attachment_include_sparkplan_cover.sql` — boolean column (later replaced).
- `20260514_attachment_cover_mode.sql` — adds `cover_mode` enum (3 values), backfills from boolean, drops boolean.
- `20260514_attachment_custom_sheet_id.sql` — nullable column.
- `20260514_attachment_discipline_override.sql` — nullable column.

**Tests** — 491 (post-PR-2) → 522 passing across 35 test files (+31 new tests). 4 new test files: `attachmentTitleSheet`, `attachmentTitleBlock`, `compositeTitleBlock`, `stampSheetIds`, `mergePacket`.

**Surfaced for follow-up**
- **F8** — Enable RLS on `public.jurisdictions` before Sprint 2C M1 populates it (currently 0 rows; Supabase advisor flagged 2026-05-12).

---

## Architecture

### `pdf-lib` dependency

- **What:** Pure-JS PDF read/merge/embed/sign library, ~190 KB, browser-safe, no native deps.
- **Why this library specifically:** Same library handles Sprint 3's PAdES digital signatures. One dependency for both sprints.
- **Why client-side, not server-side merge:** No roundtrip latency, no server-side compute cost. Server-side option remains available if bundle size becomes a problem.

### Supabase Storage bucket

- **Bucket:** `permit-attachments`
- **Path:** `{user_id}/{project_id}/{artifact_type}/{filename}`
- **RLS policy:** `user_id = auth.uid()` — same pattern as the rest of the project's RLS scoping (per CLAUDE.md frontend conventions).

### `project_attachments` DB table

```
id              uuid primary key
project_id      uuid references projects(id) on delete cascade
user_id         uuid references auth.users(id)
artifact_type   text  -- enum
filename        text
storage_path    text
page_count      integer
display_title   text
uploaded_at     timestamptz
```

`artifact_type` enum: `site_plan`, `cut_sheet`, `fire_stopping`, `noc`, `hoa_letter`, `survey`, `manufacturer_data`.

Migration goes in `/supabase/migrations/`. Run in Supabase SQL Editor. Update `lib/database.types.ts`.

### Title sheet generator

For every uploaded artifact, SparkPlan generates a `react-pdf` cover that precedes the user's PDF in the merged output. Carries:

- SparkPlan-themed title block
- Sheet ID assigned by manifest (uses Sprint 2A `nextSheetId` + appropriate category band — uploads do NOT get the `E-` discipline prefix; new prefixes for civil `C-`, manufacturer `X-` ranges)
- Drawing title
- Source attribution (*"Provided by [Contractor]"*)
- Date received
- Project metadata
- Contractor info
- Signature/seal area

### Merge pipeline

1. `react-pdf` produces SparkPlan portion as `Uint8Array`.
2. For each `source: 'uploaded'` manifest section: generate title sheet + load user PDF + `pdf-lib` appends.
3. Final pass stamps continuous sheet IDs in lower-right of every page (including user uploads).
4. Per-page contractor footer (Sprint 2A C8 `<ContractorBlock>`) applied to electrical sheets only — not to user uploads (they have their own attribution).

### AHJ manifest scaffold

- First file: `data/ahj/orlando.ts` — defines two scopes (`'existing-service'` and `'new-service'`), each as a `PacketSection[]` walking from cover → general notes → one-line → panel schedules → load calc → EVSE specs → site plan → cut sheets → fire stopping → conditional PE-required stub.
- `service_modification_type` from Sprint 2A picks which scope renders.
- This scaffold is what Sprint 2C extends to 4 more AHJs.

---

## Sprint 2B does NOT include

- **Per-AHJ checklist engine M1** — that's Sprint 2C, depends on the manifest scaffold landing here first.
- **PAdES PE seal signing** — that's Sprint 3. The `pdf-lib` integration here lays the groundwork.
- **Canvas surface for marked-up site plans** — explicitly NOT v1 per the Canvas vs Generator decision. See parent doc.

---

## NEC references touched in this sprint

None directly — this sprint is artifact merge, not calc. But the title sheet template will reference NEC articles per the manifest's `codeReferences` (populated in Sprint 2C from per-AHJ data).

---

## Cross-references

- **Sprint 2A** [`sprint2a-form-factor.md`](./sprint2a-form-factor.md) — `service_modification_type` schema (Orlando manifest fork driver), sheet ID system (extended with non-`E-` discipline prefixes), section toggle UI (reused for upload UI).
- **Sprint 2C** [`sprint2c-ahj-manifests.md`](./sprint2c-ahj-manifests.md) — extends Orlando manifest scaffold to 4 more AHJs; M1 engine consumes `project_attachments` table to check artifact presence.
- **Sprint 3** [`sprint3-pe-seal.md`](./sprint3-pe-seal.md) — `pdf-lib` is the PAdES signer. Merged packet sheet ranges (E-### → PE seal; C-### → contractor/architect; X-### → manufacturer) are the foundation for sheet-range signing scope.
- **Canvas decision** — parent doc has the architectural rationale for why NO canvas in v1 and the demand-pull trigger for Sprint 4+ revisit.

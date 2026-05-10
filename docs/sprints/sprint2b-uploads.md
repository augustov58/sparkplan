# Sprint 2B — Uploads + Merge Engine + Title Sheet Pattern

**Status:** ⚪ Not started
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

| ID | Finding | AHJ source |
|---|---|---|
| **H5** | Notice of Commencement (NOC) placeholder for projects > $5,000 | Orlando |
| **H6** | HOA / condo approval letter placeholder | Pompano (multi-family) |
| **H7** | Site plan / survey | All 5 AHJs; Orlando #6 (existing-service) + #6/#7 (new-service) |
| **H8** | Equipment cut sheets / installation manuals | Pompano; Orlando #7 (both paths) for EVSE specs |
| **H16** | Fire stopping schedule for fire-rated penetrations | Orlando #8 (both paths) |

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

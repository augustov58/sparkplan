# Sprint 2B — Uploads + Merge Engine + Title Sheet Pattern

**Status:** ✅ COMPLETE 2026-05-13 (4 PRs merged: PR #45 foundation + PR #47 upload UI + PR #49 merge engine + PR #51 Orlando manifest scaffold).
**Last Updated:** 2026-05-13
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
| **H5** | Notice of Commencement (NOC) placeholder for projects > $5,000 | Orlando | Upload slot enabled by PR #49 (`fce6275`, 2026-05-12); Orlando per-AHJ wiring (non-SFR predicate) closed by PR #51 (`18985e5`, 2026-05-13); Pompano/MD/Davie/Hillsborough wiring → Sprint 2C M1 |
| **H6** | HOA / condo approval letter placeholder | Pompano (multi-family) | Upload slot enabled by PR #49 (`fce6275`, 2026-05-12); Orlando manifest declares OFF by default per PR #51 (`18985e5`, 2026-05-13); Pompano per-AHJ wiring → Sprint 2C M1 |
| **H7** | Site plan / survey | All 5 AHJs; Orlando #6 (existing-service) + #6/#7 (new-service) | Upload slot enabled by PR #49 (`fce6275`, 2026-05-12); Orlando per-AHJ wiring closed by PR #51 (`18985e5`, 2026-05-13); other 4 AHJs → Sprint 2C M1 |
| **H8** | Equipment cut sheets / installation manuals | Pompano; Orlando #7 (both paths) for EVSE specs | Upload slot enabled by PR #49 (`fce6275`, 2026-05-12); Orlando per-AHJ wiring closed by PR #51 (`18985e5`, 2026-05-13); Pompano wiring → Sprint 2C M1 |
| **H16** | Fire stopping schedule for fire-rated penetrations | Orlando #8 (both paths) | Upload slot enabled by PR #49 (`fce6275`, 2026-05-12); Orlando per-AHJ wiring closed by PR #51 (`18985e5`, 2026-05-13) |
| **H19** | HVHZ wind-anchoring documentation for outdoor pedestal/bollard EVSE | Miami-Dade + Pompano (statewide for outdoor EVSE) | `artifact_type='hvhz_anchoring'` added by PR #49 (`fce6275`, 2026-05-12); Orlando manifest declares statewide ON per PR #51 (`18985e5`, 2026-05-13); Miami-Dade + Pompano enforcement wiring → Sprint 2C M1 |

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

## What landed (PR #51 — squash `18985e5`, merged 2026-05-13)

8 commits, ~2,066 LOC. PR-4 of the Sprint 2B series — closes the sprint by adding the first-ever AHJ manifest + the AHJ-aware visibility layer. Sprint 2C M1 extends this scaffold to 4 more AHJs (Pompano → Miami-Dade → Davie → Hillsborough) without touching the engine.

**AHJ manifest type system** (`data/ahj/types.ts`, 354 LOC)
- `AHJManifest` interface — captures everything that varies per-AHJ: code-basis references (`necEdition: Record<BuildingType, string>` for H34; `fbcEdition`), sheet-ID conventions (`sheetIdPrefix: 'E-' | 'EL-' | 'ES-'` for H20), narrative content (`generalNotes`, `codeReferences`), default section/artifact visibility (`relevantSections` + `relevantArtifactTypes`), conditional refinements (`sectionPredicates` + `artifactTypePredicates`), and Sprint 2C M1's `requirements: AHJRequirement[]` (declared empty on Orlando; populated by Sprint 2C M1).
- `AHJContext` — 4 axes baked in from day 1: `scope` (Sprint 2A PR-5), `lane` (Sprint 2A H17), `buildingType` (Sprint 2C research; SFR / multi_family / commercial), `subjurisdiction` (optional; Miami-Dade discriminator).
- `SectionPredicate` + `ArtifactTypePredicate` — pure `(ctx: AHJContext) => boolean`. Composable, mutation-free, no enum migration needed when new context axes land.
- `AHJRequirement` — schema declared NOW so Sprint 2C M1's engine consumes the same shape across all 5 AHJ manifests without retrofitting.

**Orlando manifest** (`data/ahj/orlando.ts`, 208 LOC)
- Captures the City of Orlando "EV Charging Station Permit Checklist" as pure data (sourced 2026-05-08; validated High confidence).
- `sectionPredicates`: `nec22087Narrative` ON existing-service only; `availableFaultCurrent` + `grounding` ON new-service only; `meterStack` + `multiFamilyEV` ON multi-family only.
- `artifactTypePredicates`: `noc` ON non-SFR (FL Statute 713 / jobs >$5k); `hvhz_anchoring` ON always (statewide outdoor EVSE per H19).
- `relevantArtifactTypes`: `site_plan`, `cut_sheet`, `fire_stopping`, `noc`, `manufacturer_data`, `hvhz_anchoring`. Sprint 2C-reserved types (`hoa_letter`, `survey`, plus the 6 new from this PR) default OFF; user can still toggle on.
- Uniformly cites NEC 2020 across SFR / multi_family / commercial (no MD-style H34 fork).
- `requirements: []` empty; Sprint 2C M1 populates line-by-line from the Orlando audit-doc matrix.

**Visibility math** (`data/ahj/visibility.ts`, 259 LOC) — two-layer model
- Layer 1 (manifest defaults): `computeDefaultVisibility(manifest, ctx)` walks `relevantSections` + `relevantArtifactTypes`, applies any matching predicate, returns the default ON/OFF map.
- Layer 2 (user overrides): `applySectionOverrides(defaults, overrides)` overlays the user's per-project toggles from `projects.settings.section_overrides`. Contractor can turn off any default-ON section/slot or turn on any default-OFF entry.
- Backward compat: when no manifest is registered for a project's jurisdiction, returns `null` — Sprint 2A's `resolveSections(sectionPrefs)` path runs unchanged.

**AHJ registry** (`data/ahj/registry.ts`, 97 LOC)
- `MANIFESTS: Record<string, AHJManifest>` keyed by lowercase manifest id (`'orlando'`).
- `getManifestById(id)` — case-insensitive lookup; null on unknown.
- `findManifestForJurisdiction(jurisdictionName, ahjName)` — case-insensitive substring match on both fields. Sprint 2C M1 will replace this with an explicit `jurisdictions.manifest_id` FK once the `jurisdictions` table is populated.

**Orchestrator integration** (`services/pdfExport/permitPacketGenerator.tsx`, +81 LOC; `components/PermitPacketGenerator.tsx`, +363 LOC)
- `PermitPacketData` additions: `manifest?: AHJManifest` + `buildingType?: BuildingType`.
- Resolution chain: `generalNotes / codeReferences / necEdition = data.X ?? manifest?.X ?? Sprint2A_baseline`.
- UI threads the active manifest + the resolved buildingType from `AHJContext` into `PermitPacketData` when a manifest is active. Without a manifest (project has no jurisdiction_id, or jurisdiction not in registry), every fallback chain ends at the pre-existing top-level fields.
- Sheet-ID prefix override deferred to Sprint 2C M1 (Miami-Dade H20 `EL-`). Orlando default `E-` matches today's behavior, so this is a no-op for PR-4.

**Migration applied to live Supabase**
- `20260514_attachment_types_pr4.sql` — extends `project_attachments.artifact_type` CHECK from 8 → 14 values. Adds 6 new types reserved for Sprint 2C AHJs: `zoning_application` (H21 Pompano), `fire_review_application` (H22 Pompano + Davie commercial), `notarized_addendum` (H25 Davie), `property_ownership_search` (H26 Davie BCPA.NET), `flood_elevation_certificate` (H30 Hillsborough flood zones), `private_provider_documentation` (H33 Hillsborough FS 553.791). Orlando manifest doesn't list any of them in `relevantArtifactTypes`; they're enum-valid + visibility-OFF.

**Tests** — 522 (post-PR-#49) → 572 passing across 37 test files (+50 new). 2 new test files: `tests/visibility.test.ts` (22 — two-layer visibility math, predicate fall-through, override application) + `tests/orlandoManifestE2E.test.ts` (28 — H5/H6/H7/H8/H16/H19 wiring + scope-fork assertions + registry lookup).

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

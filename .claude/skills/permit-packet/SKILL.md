---
name: permit-packet
description: Work on the permit packet PDF pipeline — page fragments, riser diagram, merge engine, sheet IDs, AHJ manifests, section visibility. Use when a packet page "looks wrong", when adding a new AHJ or artifact type, or when changing anything under services/pdfExport/ or data/ahj/.
---

# Permit Packet Pipeline

The packet is the product. It goes to AHJ plan reviewers under a PE's name. This skill maps the pipeline and the diagnostic shortcuts learned across Sprints 1–3.

## Pipeline map

```
permitPacketGenerator.tsx        ← orchestrator: assembles <Document>, resolves AHJ manifest,
  │                                 threads PermitPacketData, branches on cover_mode per attachment
  ├─ PermitPacketDocuments.tsx   ← page-level fragments (<>...</>), incl. RiserDiagram (~line 1150)
  ├─ *Documents.tsx / *PDF.tsx   ← per-section fragments (panel schedules, SC, VD, grounding, MF-EV…)
  ├─ packetSections.ts           ← section registry / ordering
  ├─ mergePacket.ts              ← pdf-lib: splice user-uploaded PDFs into generated packet
  ├─ stampSheetIds.ts            ← continuous sheet-ID stamping on upload pages (bottom-right)
  ├─ compositeTitleBlock.ts      ← overlay title block onto upload's first page (embedPdf + /ca 0)
  └─ AttachmentTitleSheet/Block  ← react-pdf cover components (size-aware, Letter → ARCH D)
```

The three merge services follow the calc-service contract: **pure, no DB, never throw, return `warnings[]`**.

## Diagnostic shortcut #1: TWO render paths for the one-line/riser

- In-app viewer + standalone PNG/SVG/PDF export → `components/OneLineDiagram.tsx`
- The riser page inside the packet PDF → `PermitPacketDocuments.tsx::RiserDiagram`

**If the in-app diagram is correct but the packet PDF is wrong, the bug is in `PermitPacketDocuments.tsx` — do not touch `OneLineDiagram.tsx`.** Visual features (e.g. AIC chips) usually need parity changes in BOTH files.

## Diagnostic shortcut #2: panel hierarchy

- MDP is found via `p.is_main`, never via `fed_from_type`. MDP is always the tree root.
- `fed_from_type` is the discriminator: `'service' | 'panel' | 'transformer' | 'meter_stack'`; `fed_from` (UUID) only when type='panel', `fed_from_transformer_id` only when type='transformer'.
- Meter stacks are visual-only in the diagram — not tree nodes. (ADR-005)

## AHJ manifests (`data/ahj/`) — pure data + pure predicates

- One literal `AHJManifest` per jurisdiction; `orlando.ts` is the reference shape.
- 4-axis `AHJContext`: `scope` / `lane` / `buildingType` / `subjurisdiction` — all baked in even when unused.
- `visibility.ts::computeDefaultVisibility(manifest, ctx)` = Layer 1 (manifest defaults + predicates) overlaid by Layer 2 (user overrides in `projects.settings.section_overrides`). Returns `null` when no manifest matches → legacy `resolveSections(sectionPrefs)` path runs unchanged. **Preserve this null-coalescing backward compat in any change.**
- **Adding an AHJ = data only.** Drop `data/ahj/<name>.ts` matching the manifest shape, register in `registry.ts`, add a `tests/<name>Manifest.test.ts` (copy an existing one). No engine changes.
- Adding an artifact type: extend the `artifact_type` CHECK in a migration + add the upload card in `PermitPacketGenerator.tsx`. The merge pipeline picks it up generically.

## Hard rules

- **No procurement data on the packet.** Cost/pricing/$ fields belong on the Bid PDF only. AHJs never see money. (PR #43)
- Sheet IDs use category bands with the `E-` prefix; Miami-Dade reserves `EL-` via `sheetIdPrefix`.
- Use `wrap={false}` on cards that must not split across pages.
- Method-aware narrative: calculated loads cite the NEC 220 Part the calculation actually ran — Part IV (Optional Method, 220.82 / 220.83 / 220.84) only when an Optional Method section is in the calculation's runtime references, otherwise Part III; measured cite NEC 220.87. Never mix the two vocabularies in one narrative. Citations come from the calculation's own `necReferences` (+ breakdown rows) via `summarizeCalculationRefs` — never from a fixed per-occupancy string. (PE ruling 2026-09-27)
- Occupancy-aware demand (Sprint 3): commercial packets cite 220.44/220.56; multifamily allocates demand per subset. Check `NarrativeOccupancy` fan-out before editing narrative copy.
- Validation is **advisory, not blocking**: contractors may print drafts with "TBD" values. Emit warnings; never gate generation.

## Verifying a packet change

Generate a real packet (see the `packet-verification` skill), compare against the latest fixture in `example_reports/` (naming: `Permit_Packet_<Scenario>_<Change>_<date>.pdf`), and save the new PDF there with the same convention. Riser/diagram changes need a visual check — tests alone don't catch layout regressions.

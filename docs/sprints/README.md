# AHJ Audit — Sprint Index

**Last Updated:** 2026-05-10 (Sprint 2A complete pending PR #40 + #41 merge)
**Parent doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](../AHJ_COMPLIANCE_AUDIT_2026-05-04.md)

This directory contains one design doc per sprint. Each file is self-contained with a "Cross-references" section at the bottom for when its scope touches another sprint's work.

---

## Status Board

| # | Sprint | Status | Open work | Hard prerequisites |
|---|---|---|---|---|
| 1 | [Sprint 1 — Engine fixes](./sprint1-engine-fixes.md) | ✅ COMPLETE 2026-05-07 | — | — |
| 2A | [Sprint 2A — Form-factor + content](./sprint2a-form-factor.md) | ✅ COMPLETE 2026-05-10 (19/19; PR #40 + #41 open) | — | Sprint 1 ✅ |
| 2B | [Sprint 2B — Uploads + merge engine](./sprint2b-uploads.md) | ⚪ Not started | H5, H6, H7, H8, H16 + architecture (`pdf-lib` + Storage + attachments + title-sheet) | Sprint 2A schema (`service_modification_type`) |
| 2C | [Sprint 2C — Per-AHJ manifests + M1](./sprint2c-ahj-manifests.md) | ⚪ Not started; research can start in parallel | M1 jurisdiction checklist engine + 4 AHJ checklists to source | Sprint 2A H17 lane logic + Sprint 2B manifest scaffold |
| 3 | [Sprint 3 — PE Seal Workflow](./sprint3-pe-seal.md) | ⚪ Architecture decided; not started | C5 + cert vendor + FBPE registration | Sprint 2B (`pdf-lib` PAdES); pricing decision; cert vendor selection; FBPE business-entity registration |
| 4 | [Sprint 4 — Polish backlog](./sprint4-polish.md) | 🔵 Deferred until Sprints 2 + 3 done | M2, M3 sub-feature, M5, M7, LOW polish + canvas revisit trigger | Sprints 2 + 3 |

---

## Dependency graph

```
Sprint 1 (engine correctness)
    │ patterns inherited by ALL downstream sprints:
    │ • Diagnostic shortcut: in-app correct vs PDF wrong → PDF call site
    │ • Live-derive on read, cache for snapshot
    │ • Helpers exported from calc layer
    │ • Basis-tracking via context interface
    │ • Synthesize virtual rows at PDF-gen time
    ↓
Sprint 2A (form-factor + content)
    ├──→ schema additions feed Sprint 2B Orlando manifest fork
    ├──→ general notes + section toggle UI feed Sprint 2C per-AHJ manifests
    ├──→ H17 lane logic feeds Sprint 2C M1 + Sprint 3 PE seal upsell gate
    └──→ C8 contractor block coexists with Sprint 3 PE seal on engineered packets
    ↓
Sprint 2B (uploads + merge engine)
    ├──→ pdf-lib PAdES integration is hard prereq for Sprint 3 PE seal signing
    ├──→ manifest scaffold extended by Sprint 2C
    └──→ project_attachments table consumed by Sprint 2C M1
    ↓
Sprint 2C (per-AHJ manifests + checklist engine)
    └──→ 277/480V PE-required gate triggers Sprint 3 workflow
    ↓
Sprint 3 (PE seal workflow)
    Reads Sprint 2A H17 lane to gate upsell offering

Sprint 4 (polish, deferred)
    Touches all earlier sprints' patterns
```

---

## Reading guidance

**"What's the overall status?"** → Read the parent [`AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](../AHJ_COMPLIANCE_AUDIT_2026-05-04.md) only (~6k tokens). Has the matrices, F-tier, decisions, NEC reminders.

**"I'm starting work on Sprint X."** → Read the parent doc + your sprint file only. Don't load other sprint files unless your sprint file's "Cross-references" section points you there.

**"I'm diagnosing a calc-engine-shaped bug."** → [`sprint1-engine-fixes.md`](./sprint1-engine-fixes.md) has the diagnostic shortcuts and patterns. Always-on across the project.

**"I'm extending architecture."** (Sprint 2B / 2C / 3) → Read the prior sprint's design first to inherit patterns. Each sprint file's "Inherits from" section names the dependency.

**"I'm reviewing a PR or auditing risk."** → Parent doc's AHJ Compliance Matrix tells you which AHJ rejects without each artifact.

---

## File naming convention

- `sprint{N}-{slug}.md` — one per sprint
- Slug describes what the sprint *does*, not its sequence position
- Filenames are stable; if a sprint's scope changes, edit the file but don't rename it

## When to create a new sprint file

When work decomposes into a new phase that:
1. Has its own dependency layer (waits on something specific to land first)
2. Has its own architecture (introduces a dependency or DB change)
3. Spans multiple PRs

If it's a single PR fitting an existing sprint, add it to that sprint's file instead. Don't fragment.

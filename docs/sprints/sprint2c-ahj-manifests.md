# Sprint 2C — Per-AHJ Manifests + Checklist Engine M1

**Status:** ⚪ Not started; **research can start in parallel with Sprint 2A** (non-coding work)
**Hard prerequisites:**
- Sprint 2A H17 lane logic ([`sprint2a-form-factor.md`](./sprint2a-form-factor.md)) — M1 engine reads `lane` to decide which requirements apply
- Sprint 2B manifest scaffold ([`sprint2b-uploads.md`](./sprint2b-uploads.md)) — Sprint 2C extends Orlando-only to all 5 FL AHJs
- 4-AHJ checklist sourcing (research, not code) — see "Parallel research task" below

**Inherits from:** Sprint 2A (general notes pattern, `<XxxPage>` builder pattern, schema), Sprint 2B (manifest data shape, `project_attachments` table)
**Index:** [`docs/sprints/README.md`](./README.md)
**Parent doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](../AHJ_COMPLIANCE_AUDIT_2026-05-04.md)

**Estimated complexity:** 1 week coding + 1–2 days research per AHJ. The engine itself is small; the manifest data is the bulk of the work.

---

## Why this sprint exists

The **decorative jurisdiction-checklist page on page 12** is currently `[ ]` empty boxes. Real value: an engine that walks the packet AST against an AHJ-specific manifest and renders `[X]` / `[ ]` / `❌ MISSING` per requirement. This is what makes "Florida Permit Mode" a checklist *engine* (the strategic differentiator) rather than a static page.

Sprint 2A validated Orlando line-by-line. Sprint 2C does the same for the four other FL pilot AHJs and operationalizes the result via M1.

---

## Open work

### Findings closed by this sprint

| ID | Finding | What it does |
|---|---|---|
| **M1** | Jurisdiction checklist is decorative — empty `[ ]` boxes (page 12) | New engine that walks packet AST against AHJ manifest, returns `{ requirements: [{ id, name, required, present, location, severity }], summary: { passing, failing, total } }`. Renders as page-12 jurisdiction checklist with `[X]` / `[ ]` / `❌ MISSING` per requirement. |

### Parallel research task (non-coding — do during Sprint 2A so 2C is unblocked)

Source the four other AHJ checklists. Stash in `docs/ahj-source-checklists/`. Each is the AHJ's official EV/electrical permit checklist PDF or equivalent published page text:

- **Miami-Dade** — most prescriptive market; expect H17+ findings related to plan-set conventions (sheet IDs, TOC, FBC references, fault current calc).
- **Pompano Beach (Broward)** — multi-family-specific; expect HOA letter requirements, site plan emphasis.
- **Davie (Broward)** — sister to Pompano; expect overlap, plus commercial-specific items (Knox-box, emergency shutoff).
- **Hillsborough / Tampa** — geographic outlier; less known to us; sourcing surfaces unknowns.

For each AHJ:
- Per-AHJ line-by-line cross-walk table appended to parent audit doc (mirroring the Orlando line-by-line matrix in the parent doc's "AHJ Compliance Matrix" section).
- Per-AHJ manifest data file in `data/ahj/` (TS or JSON).

---

## Architecture

### M1 engine shape

```typescript
// services/jurisdictionChecklist/checklistEngine.ts
function evaluatePacket(packet: PacketAST, manifest: AHJManifest): ChecklistResult {
  return {
    requirements: manifest.requirements.map(req => ({
      id: req.id,
      name: req.name,
      required: req.required(packet),  // some requirements are conditional on lane / scope flags
      present: req.detect(packet),
      location: req.locator?.(packet),  // sheet ID where this requirement is satisfied
      severity: req.required(packet) && !req.detect(packet) ? 'fail' : 'pass',
    })),
    summary: { passing, failing, total },
  };
}
```

### Pure function

Per CLAUDE.md "Calculation Service Rules" — no DB calls, no hooks, no side effects. Input → output. Renderer calls it.

### Conditional logic

- ≥277/480V (per Orlando manifest) → PE-required stub page renders as part of the manifest's `requirements`. This is the gate that **triggers Sprint 3 workflow** when a project crosses the threshold.
- Sprint 2A H17 lane logic threads in — `manifest.requirements` filter on `lane`.
- **`building_type ∈ { single_family_residential, multi_family, commercial }`** is a first-class top-level discriminator, **orthogonal to `lane`**. Surfaced by Sprint 2C parallel research (2026-05-12). Examples:
  - Pompano Fire Review Application excludes `single_family_residential` (H22).
  - Davie's Knox-box / bollard / multi-dispenser shunt block applies only when `building_type = 'commercial'` (H27–H29).
  - Hillsborough's "residential trade-permit only" lane bypasses plan review entirely when `building_type = 'single_family_residential'` (H31) — the packet is over-spec there.
  - The manifest schema must model `building_type` alongside `lane` and `service_modification_type` — not bury it in per-requirement predicates. Sprint 2B PR-4's Orlando scaffold should include this field even though Orlando's matrix doesn't yet vary on it.

### Renderer

Replaces the decorative jurisdiction-checklist page with the engine output. Each requirement row:
- `[X]` (passing — artifact present, sheet ID linked)
- `[ ]` (not yet present, but required — amber callout)
- `❌ MISSING` (required + not present + intake-blocker, red callout)

---

## NEC references touched in this sprint

None directly — this sprint is conformance verification, not calc.

---

## Cross-references

- **Sprint 2A** [`sprint2a-form-factor.md`](./sprint2a-form-factor.md) — H17 lane logic feeds M1's `required(packet)` filtering; `generalNotes[]` and `codeReferences[]` arrays populated per AHJ (Sprint 2A established the arrays as configurable; Sprint 2C populates them).
- **Sprint 2B** [`sprint2b-uploads.md`](./sprint2b-uploads.md) — Sprint 2B's `data/ahj/orlando.ts` scaffold extended to 4 more AHJs; `project_attachments` table consumed by M1's `req.detect(packet)` to verify uploaded artifacts are present.
- **Sprint 3** [`sprint3-pe-seal.md`](./sprint3-pe-seal.md) — 277/480V → PE-required gate in M1 triggers Sprint 3 workflow. Conversely, Sprint 3 reads M1's `lane` to decide whether to offer the PE seal upsell.
- **Parent doc AHJ Compliance Matrix** — current Orlando line-by-line is validated; Miami-Dade / Pompano / Davie / Hillsborough cells are best-guess until this sprint's research lands.

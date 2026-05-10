# Sprint 4 — Polish Backlog

**Status:** 🔵 Deferred until Sprints 2 + 3 are done
**Hard prerequisites:** Sprints 2 + 3 ship first — these are non-blocking polish items
**Inherits from:** All earlier sprints' patterns; this sprint primarily extends or polishes their work
**Index:** [`docs/sprints/README.md`](./README.md)
**Parent doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](../AHJ_COMPLIANCE_AUDIT_2026-05-04.md)

---

## Why this sprint exists

These are quality improvements — not rejection-on-intake risks, not architectural inflections, not moat builders. They're the polish that takes the packet from "passes intake" (post-Sprints 2 + 3) to "looks visibly more professional than ETAP/SKM output." Defer until pilot contractors validate the core flow.

---

## Open work

### M2 — NEC compliance summary expanded

- **Symptom:** NEC compliance summary on page 5 is too sparse — only 6 line items.
- **Missing:** 215, 220.18, 240.4(D), 625.42, 110.16.
- **Code:** `PermitPacketGenerator.tsx` compliance summary component.
- **Inherits:** Leverages Sprint 1's NEC reference patterns (each calculation result includes `necReferences: string[]` per CLAUDE.md "Calculation Service Rules").

### M3 sub-feature — Grounding checklist `[X]` vs `[ ]` distinction

- **Symptom:** Grounding checklist boxes empty (page 9). Should distinguish "designed/specified" `[X]` vs "field-verify" `[ ]`.
- **Code:** `PermitPacketGenerator.tsx` grounding page.
- **Inherits:** Builds on Sprint 2A PR 4's M3 main scope (project-specific grounding detail with GEC sized per NEC 250.66/250.122). PR 4 closes the *content* gap; this Sprint 4 polish closes the *checkbox-state* gap.

### M5 — Collapse byte-identical unit panel pages

- **Symptom:** Pages 16–27 are byte-identical 12 unit panel pages on the audit fixture.
- **Fix:** Replace with one "Typical Unit" page + a roster of all unit assignments.
- **Code:** `PermitPacketGenerator.tsx` — collapse identical panels.
- **Inherits:** Builds on Sprint 1 C6 phase-balance fix (panels now correctly show alternating Phase A / B per slot pair, so the "Typical Unit" page actually represents real per-leg loading not the broken Phase A = total / B = 0 pre-fix state).

### M7 — Equipment Specs page-break fix

- **Symptom:** Page 7 is orphaned blank — Equipment Specs callout bleeds onto a second page.
- **Code:** `PermitPacketGenerator.tsx` equipment-specs page-break logic.
- **Inherits:** Coexists with Sprint 2A's `wrap={false}` cohesive-card pattern — the page-break fix uses the same react-pdf control surface.

### LOW polish items

- Footer "Generated [date]" should include time + unique packet ID for revision tracking.
- Cover page should carry AHJ name + jurisdiction code prominently — currently buried on page 12.
- "Parking Garage / EV Charging Area" location string should tie to a site-plan callout when site plan is added (Sprint 2B H7).

---

## Canvas evaluation (demand-pulled trigger condition)

Per the **Canvas vs Generator decision** (settled 2026-05-08, full rationale in parent doc):

> **Trigger condition for revisiting:** if pilot contractors consistently report friction with "I want to add a callout to your auto-generated one-line and have to upload to Bluebeam first," **then** we add a canvas in Sprint 4+. Build only on demand-pull. The first 2–3 FL pilot contractors are the signal.

If triggered: scope a canvas surface (likely embed drawio with custom shape library mirroring our project schema). Otherwise: do not build.

---

## NEC references touched in this sprint

- **215** — Feeder NEC compliance line item (M2).
- **220.18** — Branch-circuit load (M2).
- **240.4(D)** — Small-conductor protection (M2).
- **625.42** — EVEMS feeder-level reduction (M2 + already covered in Sprint 1 C4 / Sprint 2A H10).
- **110.16** — Arc flash labeling note (M2).
- **250.66, 250.122** — Grounding electrode + EGC sizing (M3 sub-feature builds on Sprint 2A PR 4 M3 main scope).

---

## Cross-references

- **Sprint 1** [`sprint1-engine-fixes.md`](./sprint1-engine-fixes.md) — M5 builds on C6 phase-balance fix; M2 leverages this sprint's NEC reference pattern (each calc result includes `necReferences: string[]`).
- **Sprint 2A** [`sprint2a-form-factor.md`](./sprint2a-form-factor.md) — M3 sub-feature builds on PR 4 M3 main scope; M7 coexists with `wrap={false}` cohesive-card pattern.
- **Sprint 2B** [`sprint2b-uploads.md`](./sprint2b-uploads.md) — LOW polish "Parking Garage" location string ties to H7 site plan callout.
- **Parent doc Canvas vs Generator decision** — for the architectural rationale and the demand-pull trigger condition.

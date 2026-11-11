---
name: packet-verification
description: Visually verify SparkPlan changes end-to-end — drive the real app with Playwright, generate a permit packet PDF, and compare against fixtures. Use before merging any PR that touches PDF output, calculations that feed PDFs, or user-facing flows. Build + unit tests alone are NOT sufficient for render-layer changes.
---

# Packet Verification (Playwright + PDF)

Unit tests validate math; they do not catch layout regressions, wrong narrative copy, or broken render paths. Any PR touching `services/pdfExport/`, `components/OneLineDiagram.tsx`, or a calc that appears on a packet page gets this pass.

## Setup

1. `npm run dev` → app at `localhost:3000` (HashRouter — routes look like `/#/projects/...`).
2. Drive the app as the **QA account** (`playwright-qa` MCP server / `E2E_QA_EMAIL`), never the owner's: the local app writes to prod Supabase. Account rules, sign-in and the email check: `.claude/skills/issue-verification/`. **NEVER store the password to disk.**
3. Use the named QA projects in `tests/e2e/fixtures.md`. Don't create throwaway projects when a named one covers the scenario.

This pass is step 4 of the issue-verification loop when the change reaches a packet page.

## Verification loop

1. Navigate to the affected feature; exercise the changed flow in the real UI (not just the component in isolation).
2. Generate the permit packet; download the PDF.
3. Compare against the most recent fixture for that scenario in `example_reports/` — naming convention:
   `Permit_Packet_<Scenario>_<ChangeTag>_<YYYY-MM-DD>.pdf` (e.g. `Permit_Packet_New4Plex_Sprint2_CalcNarrative_2026-05-27.pdf`).
4. Check specifically:
   - The changed page renders correctly (open the PDF with the Read tool — it renders pages).
   - Numbers on the PDF match the in-app tri-column / calculator values.
   - NEC citations in the narrative match the calculation method actually used.
   - No procurement/$ data leaked onto packet pages.
   - Riser page vs in-app diagram parity (two render paths — see `permit-packet` skill).
5. Save the verified PDF into `example_reports/` with the convention above.
6. Mirror to Obsidian: copy to `/home/augusto/Obsidian Notes/Projects/Sparkplan Test Packets/`. The folder sometimes has the write bit stripped — `chmod u+w` first; `cp` may need sandbox disabled.

## Order of checks (cheapest first)

1. `npm run build` — exits 0
2. `npm test` — zero failures (fix the code, not the test)
3. `npx tsc --noEmit` — keep the baseline at 0 errors (Vite skips type validation; the count drifts without this)
4. This visual pass

## Scope rule during verification

If the visual pass surfaces a related bug in the same architectural area as the open PR, **fold the fix into the PR** rather than land-and-follow-up (validated preference, PR #94). Unrelated bugs get filed, not fixed.

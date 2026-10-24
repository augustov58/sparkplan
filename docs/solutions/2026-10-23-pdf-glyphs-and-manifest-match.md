# Packet printed "’ PANEL" / "d3%"; City of Miami got the County manifest

**Problem.** (1) Helvetica in react-pdf is a WinAnsi font: "→", "≤", "≥", "√", "Ω", "Φ", emoji print as wrong glyphs ("→ PANEL H1" → "’ PANEL H1" on every subpanel row of E-301; "≤3%" → "d3%"). (2) `findManifestForJurisdiction` substring-matched in registry order, so "Miami, Miami-Dade County, FL" (City of Miami) hit `miami-dade`, and "Tampa, Hillsborough County, FL" hit nothing (#135, #153).

## Approach
1. Glyphs. Issue #153 named four manifest strings. A sweep of `services/pdfExport/` found 11 more printed strings; a sweep of `services/calculations/` ~75 (⚠️/ℹ️/✓/≤/→/Ω in warnings, notes, breakdown labels); and the DB itself stores "→ PANEL x" circuit descriptions and "A → B" feeder names (`PanelSchedule.tsx`, `FeederManager.tsx`).
   - Tried: editing the strings, then `pdfSafe(data)` at the generator entry. Both failed the exhaustiveness check — calc strings computed *inside* the generator (e.g. `upstreamLoadAggregation` "ranges → kW") bypass an entry-point transform, and future strings would regress.
   - Kept: `services/pdfExport/PdfText.tsx` — a `Text` that runs string children (and `render()` output) through `toPdfText`. All 16 files that imported `Text` from `@react-pdf/renderer` import it from there. Source strings stay Unicode (the app UI renders them fine).
   - Proof: regenerated the St. Pete QA packet — 14 "’ PANEL" → 14 "-> PANEL" (pdftotext count), plus a visual read of E-301 and E-103.
2. Manifest match. Read the real `jurisdictions` rows (9, through the logged-in app — anon REST returns 0 under RLS). Rows always carry `city` and `state`, so match on those: `ahj_name` naming a county (and no city/town/village) → that county's manifest; else `coverage.cities` contains the city; else null. Each manifest declares `coverage`. Name-only input keeps a substring fallback, longest needle wins.

## Judgment calls
- No `jurisdictions.manifest_id` column (user chose code-side matching): no prod migration, no `database.types.ts` regen.
- An unmodeled city inside a modeled county (Miami Gardens, Winter Park) gets **no** manifest rather than the county's — it is a different AHJ.
- Did not register a font with ≤/→ glyphs: changes the look of every page and `Font.register` has corrupted the cache before (PanelScheduleDocuments.tsx note).

## Reusable rule
Text that reaches a react-pdf page goes through `services/pdfExport/PdfText.tsx::Text` — never import `Text` from `@react-pdf/renderer`. When a transform must cover "every X", put it at the one place every X passes through (the render primitive), not at an entry point some X bypasses.

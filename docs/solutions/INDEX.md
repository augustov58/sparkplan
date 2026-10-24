# Solutions Index

One note per hard problem, written by the model that solved it via the `extract-approach` skill (`.claude/skills/extract-approach/SKILL.md`, ACTIVE since 2026-07-09 — provenance in [RECORDER.md](./RECORDER.md)).
Each entry: `- [title](file.md) — reusable rule`.

<!-- Newest first -->
- [Jurisdiction checklist reported pages and content the packet didn't have](2026-10-24-checklist-reports-what-was-built.md) — detect the content a requirement names in the built packet, never a toggle or a page that could hold it; after gating `required`, a not-required item that still detects is a proxy check
- [Packet printed "’ PANEL" / "d3%"; City of Miami got the County manifest](2026-10-23-pdf-glyphs-and-manifest-match.md) — import `Text` from `services/pdfExport/PdfText`, never react-pdf; put an "every X" transform where every X passes (the render primitive), not at an entry point; match jurisdiction rows on city/state/ahj_name, never display-name substrings
- [NEC edition came from four sources that disagreed](2026-10-21-nec-edition-single-resolver.md) — compute a jurisdiction/date-dependent value from one resolver at read time; count and classify every reader; never store the resolved value
- [PE rulings: EVEMS setpoint ×1.25, 220.83(A)/(B), 220.84 heat at nameplate](2026-10-18-pe-rulings-hvac-evems.md) — find a factor in the cited section's text before applying it; when a ruling changes a quantity, grep every function and label for it, and decide a branch once when a calc runs twice (existing/total)
- [Single-family E-102 ignored the existing/new dwelling choice](2026-10-13-sf-e102-ignored-existing-dwelling.md) — two pages reporting the same quantity must call the same function behind the same gate helper; test every occupancy branch
- [NEC 220.57 cited on Florida (NEC 2020) EV packets](2026-09-27-evse-load-nec-edition.md) — confirm every cited section exists in the manifest's NEC edition; route edition-dependent rules through a `(value, edition)` helper
- [Calculated-method narrative cited a NEC method that never ran](2026-09-27-narrative-cites-method-that-ran.md) — trace the page's number to the function that computed it; cite that function's runtime `necReferences` + breakdown rows, never a fixed per-occupancy string
- [NEC 220.87 measured demand was exempted from the 125% factor](2026-07-09-nec22087-measured-demand-125pct.md) — measured max demand takes ×1.25 per 220.87(2); only `calculated` (Part III) skips it; fix all 3 sites together

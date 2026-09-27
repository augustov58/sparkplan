# Solutions Index

One note per hard problem, written by the model that solved it via the `extract-approach` skill (`.claude/skills/extract-approach/SKILL.md`, ACTIVE since 2026-07-09 — provenance in [RECORDER.md](./RECORDER.md)).
Each entry: `- [title](file.md) — reusable rule`.

<!-- Newest first -->
- [NEC 220.57 cited on Florida (NEC 2020) EV packets](2026-09-27-evse-load-nec-edition.md) — confirm every cited section exists in the manifest's NEC edition; route edition-dependent rules through a `(value, edition)` helper
- [NEC 220.87 measured demand was exempted from the 125% factor](2026-07-09-nec22087-measured-demand-125pct.md) — measured max demand takes ×1.25 per 220.87(2); only `calculated` (Part III) skips it; fix all 3 sites together

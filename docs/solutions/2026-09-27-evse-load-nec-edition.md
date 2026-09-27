# NEC 220.57 cited on Florida (NEC 2020) EV packets

**Problem:** Every Multi-Family EV packet printed "NEC 220.84 + 220.57 + 625.42" and applied the 7,200 VA per-EVSE floor, but §220.57 was added in NEC 2023 — Florida enforces NEC 2020 (FBC 8th Ed.), where Article 220 Part III ends at 220.56.

## Approach

1. **Found the finding, not the bug.** It was discovered 2026-08-25/29 in an Obsidian-vault session and recorded only in that project's memory (`reference_nec_edition_florida.md`) + claude-mem — not in sparkplan memory. `grep` of repo docs found nothing; `mem-search` "220.57 2020" found it.
2. **Swept all sites before editing:** `grep -rn "220\.57\|7200\|7_200"` over `services data components lib App.tsx` → 46 hits / 11 files. Only two are math (`multiFamilyEV.ts::calculatePerEVSELoad`, `ev-panel-templates.ts` circuitLoadVA); the rest are labels, comments, the Gemini prompts, and one test asserting the wrong citation.
3. **Asked the PE the interpretation question** (100% vs 125% of nameplate under 2020). Answer: 100% — 625.41 / 215.2(A)(1) put 125% on OCPD and conductors; Article 220 carries continuous loads at 100%; 125% in the load calc double-counts.
4. **One helper, one resolver:** `data/nec/evse-load.ts::getEvseLoadVA(nameplateVA, edition)` returns load + citation; `data/ahj/registry.ts::resolveNecEdition(manifest, buildingType, projectEdition)` (manifest → project → '2020') replaced the inline IIFE in `components/PermitPacketGenerator.tsx` and is reused by `MultiFamilyEVCalculator.tsx`, so math and citations resolve identically.
5. **Handled persisted results:** the packet renders `settings.residential.mfEvCalculation` — it does NOT recompute. Result now carries `evLoad.necEdition`; absent = legacy = '2023'. The PDF cites the result's own edition (true to its math) and shows an advisory recompute note when it differs from `packetNecEdition`.
6. **Visual pass via a scratch vitest** rendering `MultiFamilyEVPages` to `$CLAUDE_JOB_DIR/tmp` (no login needed), then `pdftotext` grep + `pdftoppm` → Read.

## Failed hypotheses / corrections

- **"2023 method over-sizes, so it fails safe"** — only true at 100%. Under the 125% reading, 2020 would be *larger* for every 32–48 A charger. Always tabulate both editions before claiming a direction.
- **"Only chargers under 30 A change"** — true at 240 V only. At 208 V 3φ the floor binds up to 34.6 A, so the common 32 A charger changes (7,200 → 6,656 VA). Caught by the existing test on a 208 V fixture.
- **Mismatch note on page E-402** spilled the phase-balance box to a 3rd page (E-402 is full; the packet declares `pageCount: 2`). Moved to E-403 under "NEC Compliance Summary". Check `pdfinfo | grep Pages` after adding any conditional block.

## Judgment calls

- **Did not thread edition into `generateCustomEVPanel`:** all presets (48 A, 80 A, DCFC) ≥ 11,520 VA, so the floor never binds. Guarded by a `satisfies Record<ChargerTypeOption, true>` test that fails if a sub-7,200 VA preset is added.
- **Did not recompute legacy results at packet time** — the packet has no calculator inputs; advisory note instead (warn, never block).
- **Did not change the chatbot's "2023 edition unless specified" default** (`geminiService.ts` RESPONSE GUIDELINES) — broader than EV; flagged for follow-up.
- **No DB migration:** the `projects` table has no `nec_edition` default in migrations; app-side defaults flipped to '2020'.

## Reusable rule

Before printing any NEC section on a packet, confirm it exists in the edition the AHJ manifest declares; route edition-dependent rules through a `(value, edition)` helper, never an inline constant.

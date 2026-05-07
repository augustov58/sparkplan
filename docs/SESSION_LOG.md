# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-06

---

### Session: 2026-05-06 — AHJ Compliance Audit C4 (per-EVSE branch math + EVEMS feeder reduction)

**Focus**: Fifth and final session in the AHJ compliance audit Sprint 1. C1, C2, C3, B-1, and C6 were already merged across PRs #15, #16, #17. This session shipped C4 — the per-EVSE branch circuit math + the NEC 625.42 EVEMS feeder/service reduction. With C4 done, every page of the audit-packet that does arithmetic now produces the right number; remaining audit work is presentation/policy (Sprint 2 H-tier and Sprint 3 PE seal).

**Status**: ✅ C4 shipped on branch `fix/c4-evems-branch-circuit-math` (PR #19). 173/173 tests pass (was 164 pre-C4, +9 new). `npm run build` exits 0 in 4.58s. Pending user visual verification on Vercel preview before merging.

**Mid-session refinement (2026-05-06 23:30 EDT)**: User reviewed in-app panel summaries on the audit project right after the first C4 commit shipped. Reported that MDP showed 1199 A on a 1000 A panel and EV Sub-Panel showed 585.5 A on a 400 A panel — both visibly wrong. Investigation: my initial `evemsSetpointVA` proxy used `panel.main_breaker_amps × voltage = 400 × 240 = 96 kVA`, but the autogen sizes panel breakers to `simultaneousChargers × breakerSize` rounded UP to a standard size (e.g. 360A → 400A panel) when the actual EVEMS setpoint per the calculator is much lower (~48 kVA in the audit fixture, limited by available service capacity). Proxy was over-generous by ~2x. **Refinement (commit on same branch before merge):** (a) autogen now emits an explicit "EVEMS Aggregate Setpoint (NEC 625.42)" metadata circuit carrying the calculator's exact setpoint (`scenario.powerPerCharger_kW × 1000 × numChargers`); (b) `evemsSetpointVA` reads from that marker first, falls back to the panel-breaker proxy for legacy projects; (c) `collectCircuitLoads` + `directConnected` reducer skip marker circuits so they don't double-count as real loads; (d) `components/PanelSchedule.tsx` panel summary tiles ("Direct Demand Load", "Demand Amps") prefer aggregated demand whenever the EVEMS clamp engaged (not just when the panel feeds downstream sub-panels) — fixes the EV Sub-Panel display. After the user regenerates the audit project, MDP should show ~999 A (within 1000A breaker) and the EV Sub-Panel should show ~200 A (well within 400A breaker).

**Verification-first paid off again**: Per the audit doc's "Diagnostic shortcut" — when in-app view is correct but the PDF disagrees, the bug is at autogeneration or the PDF call site, not the engine. Confirmed by reading `services/calculations/multiFamilyEV.ts:526-532` *before* opening any other file: `calculatePerEVSELoad(nameplateAmps, voltage)` correctly returns `max(7,200, V × I)` per NEC 220.57(A). The actual bug was at `data/ev-panel-templates.ts:531-535` where a `useEVEMS && evemsLoadVAPerCharger` ternary persisted the EVEMS-managed per-charger setpoint share into branch circuits, in violation of NEC 625.40 + 210.19 (branch conductors must handle full continuous nameplate regardless of EVEMS). Saved ~3 days of estimated rewrite work on the engine modules.

**New retrospective wrinkle (added to Insight section of audit doc)**: Removing a wrong-but-load-bearing line can regress a previous fix that depended on its accidental side-effect. The 3,996 VA branch override was wrong for what an AHJ reviewer sees on page 14, but it was *also* the channel through which EVEMS reduction reached the MDP NEC 220.84 service-sizing calc — `buildMultiFamilyContext.evLoadVA = sum of EV branch loads`. With branches inflated-down to ~48 kVA total, the MDP service sizing came out approximately right by canceling errors. Raising branches to nameplate (138 kVA total) would have over-recommended the service by ~15% if the C1 path stayed unchanged. So C4 needed a parallel new path: an explicit feeder/service-level NEC 625.42 clamp inside `calculateAggregatedLoad`, plus an `evDemandVA` field on `MultiFamilyContext` so the dwelling-base subtraction (raw connected) and the EV add-back (clamped) use consistent bases.

**Root cause (consumer-side wiring at autogen time, not engine bug — same pattern as C1, C2, C3, B-1, C6)**:

- **C4 — `data/ev-panel-templates.ts:531-535`**: `circuitLoadVA = (useEVEMS && evemsLoadVAPerCharger) ? evemsLoadVAPerCharger : (useEVEMS && simultaneousChargers) ? Math.round(loadVA × simultaneousChargers / numberOfChargers) : loadVA`. The `evemsLoadVAPerCharger` value flowed in from `services/autogeneration/multiFamilyProjectGenerator.ts:637-639` as `Math.round(scenario.powerPerCharger_kW × 1000)` — that's the diversified theoretical-share-of-available-capacity computed by the multi-family EV calculator's EVEMS scheduler. Persisting that into `circuits.load_watts` is wrong on two levels: (1) NEC 220.57(A) requires the branch-circuit load to be `max(7,200 VA, nameplate)`; (2) NEC 625.40 requires branch conductors to handle full continuous nameplate regardless of EVEMS. The page-14 PDF was correctly displaying what was already wrongly persisted.

**Work Done**:

*C4 — `data/ev-panel-templates.ts`*: `circuitLoadVA = Math.max(7_200, loadVA)` per NEC 220.57(A), unconditionally. The `evemsLoadVAPerCharger` config field is left in `CustomEVPanelConfig` for backward compatibility but explicitly documented as `@deprecated`/ignored. The unused destructure was removed. Comment updated to call out NEC 625.42 belongs at feeder/service, not branch.

*C4 — `services/autogeneration/multiFamilyProjectGenerator.ts`*: `generateEVPanel` no longer computes `evemsLoadVAPerCharger`. `scenario.powerPerCharger_kW` is no longer used to override branch loads. Comment block updated to point to the new clamp inside `calculateAggregatedLoad`.

*C4 — `services/calculations/upstreamLoadAggregation.ts`*: Two new file-private helpers:
- `isEVEMSManagedPanel(panelId, circuits)` — heuristic detection: returns `true` iff the panel has a circuit whose description contains "EVEMS Load Management System" (the controller-power circuit emitted by the autogen template at `data/ev-panel-templates.ts:575`).
- `evemsSetpointVA(panel)` — returns `panel.main_breaker_amps × voltage`, with √3 multiplier for 3Φ panels. Approximates the NEC 625.42 setpoint based on the autogen-set main breaker rating (which is computed from `simultaneousChargers × breakerSize` rounded to standard panel size).

`calculateAggregatedLoad` now applies the clamp in TWO places:
1. **Standard NEC 220 path** (Phase 2): after `applyDemandFactors` returns, if the panel is EVEMS-managed and `totalDemandVA > setpointVA`, clamp `totalDemandVA = setpointVA`, push a `NEC 625.42 (EVEMS — feeder demand clamped to setpoint)` row into the breakdown.
2. **NEC 220.84 multi-family path**: `MultiFamilyContext` gained an optional `evDemandVA?` field. The MDP-level demand math now subtracts raw connected EV (`evLoadVA`) from the dwelling base before applying the 220.84 demand factor, then adds back the post-clamp `evDemandVA` (or `evLoadVA` as fallback) at 100% per NEC 625.42. This keeps the basis consistent on both sides of the equation. The breakdown row label flips between "EV Charging (NEC 625.42 EVEMS-clamped)" and "EV Charging (EVEMS managed)" depending on whether the clamp engaged.

`buildMultiFamilyContext` now populates both `evLoadVA` (raw) and `evDemandVA` (post-clamp) by reading both `result.totalConnectedVA` and `result.totalDemandVA` from each downstream EV panel. `evDemandVA` is omitted (`undefined`) when it equals `evLoadVA` — preserves pre-C4 behavior for non-EVEMS panels.

*Tests — `tests/calculations-extended.test.ts`*: 8 new regression tests in a new `C4 — Per-EVSE branch row VA (NEC 220.57)` describe block:
- 4× branch row VA: 12-charger EVEMS case → expect 11,520 VA per row (was 3,996 — exactly the audit page-14 bug); non-EVEMS path → already 11,520 (pinned, no regression); NEC 220.57 7,200 VA floor proof (24A @ 240V = 5,760 nameplate gets bumped to 7,200); EVEMS controller "EVEMS Load Management System" row stays at 500 VA (it's the controller's auxiliary control-power, not an aggregate display).
- 3× feeder/service clamp: clamps `totalDemandVA` from 138,740 → 96,000 when EVEMS-managed + over setpoint; no clamp when no controller circuit; no clamp when already under setpoint.
- 1× MDP combined NEC 220.84 + 625.42: full audit fixture (12 dwelling units + house + EVEMS-managed EV @ 12 chargers); expects total demand 287–289 kVA (without the new clamp this would be ~330 kVA, ~15% high).

**Decisions made**:
- **Detect EVEMS via circuit description, not a panel column** — avoids a DB migration. The autogen template is the only producer of EV-bank panels with an EVEMS marker circuit, and the description string is stable. Future follow-up F4: add explicit `panel.is_evems_managed` boolean + `panel.evems_setpoint_va` integer when the schema is next touched.
- **Carry the EVEMS setpoint as a metadata-only circuit, not a panel.notes JSON blob or a new column** (refined after user review) — the cleanest no-migration path. Description "EVEMS Aggregate Setpoint (NEC 625.42)" is the marker; `loadVA` carries the value. The load aggregator excludes it from connected sums so it doesn't double-count. Side benefit: AHJ reviewers see the setpoint visibly listed on the panel schedule, addressing the audit's separate complaint that the prior 500 VA "EVEMS Load Management System" placeholder was misleadingly low.
- **Panel-breaker proxy as legacy fallback only** (originally the primary mechanism, demoted after user review) — the autogen rounds breaker size up to a standard panel size, which over-clamps by ~2x vs. the actual setpoint. Legacy projects with only the 500 VA placeholder still get clamped (better than no clamp), but new projects use the precise marker.
- **Apply the clamp inside `calculateAggregatedLoad`, not at each consumer** — single source of truth. Both `computeFeederLoadVA` (for the MDP→EV feeder voltage drop / sizing) and `buildMultiFamilyContext` (for the MDP service-level NEC 220.84 calc) flow through `calculateAggregatedLoad`, so applying the clamp once there gives both call paths the right answer.
- **`evDemandVA` undefined when it equals `evLoadVA`** — preserves the pre-C4 `MultiFamilyContext` shape for the (overwhelmingly common) non-EVEMS case. No regression risk on the existing C1 multi-family tests.
- **Panel-summary "Demand Amps" condition broadened to `aggregated < direct demand` instead of `downstreamPanelCount > 0`** (added during user review) — fixes display for EVEMS-managed leaf panels (EV Sub-Panel has no downstream panels but still benefits from the NEC 625.42 clamp). Non-EVEMS leaf panels are unaffected because aggregated equals direct.
- **Keep `evemsLoadVAPerCharger` field deprecated, not removed** — backward compatibility for any external caller of `generateCustomEVPanel`. The field is now ignored; documented in the type definition.

**Key Files Touched**:
- C4 calc: `data/ev-panel-templates.ts`, `services/autogeneration/multiFamilyProjectGenerator.ts`, `services/calculations/upstreamLoadAggregation.ts`
- Tests: `tests/calculations-extended.test.ts`
- Docs: `docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md` (C4 marked ✅ RESOLVED, Insight section updated with the new "load-bearing-wrong-line" wrinkle, Next Session Brief rewritten for C5 / Sprint 2), `docs/CHANGELOG.md` (new dated entry above the C3+B-1+C6 entry), `docs/SESSION_LOG.md` (this entry; rotated 2026-05-04/05 entry out per "keep last 2")

**Pending / Follow-ups**:
- **Visual verification on Vercel preview**: user should regenerate the example permit packet from the same 12-unit MF + EVEMS project. Page 14 should show: each EV charger branch row at **11,520 VA** (was 3,996), conductor 6 AWG / breaker 60A unchanged, "EVEMS Load Management System" row still at 500 VA. Page 4 MDP demand should still be ~240–290 kVA (combined 220.84 + 625.42 math). Page 8 MDP→EV Sub-Panel feeder voltage drop sized to ~96 kVA / ~400 A (was correct after C2; should remain correct after C4).
- Audit findings still open: C5 (PE seal workflow — separate sprint), all H-tier and M-tier findings (Sprint 2 = FL Permit Mode v1: TOC, sheet IDs, jurisdiction-checklist engine, FBC/NFPA-70 references, conditional NOC/HOA/site-plan pages, EVEMS narrative).
- **F4 follow-up**: replace the EVEMS-managed circuit-description heuristic with an explicit `panels.is_evems_managed` + `panels.evems_setpoint_va` columns when the schema is next touched (no DB migration needed for C4 itself).
- **Sprint 1 retrospective insight to bake into CLAUDE.md**: Six consecutive audit fixes turned out to be consumer-side wiring bugs, not engine bugs. The diagnostic-shortcut heuristic ("when the in-app view is correct but the PDF disagrees, look at the PDF call site or autogeneration") is now a strong pattern. Worth promoting to a top-level "Codebase Pitfalls" entry in CLAUDE.md so the heuristic is the first thing future sessions check.

**PRs**:
- `fix/c4-evems-branch-circuit-math` branch — pending push + PR open + Vercel preview verification.

---

### Session: 2026-05-05 / 2026-05-06 — AHJ Compliance Audit C3 + B-1 + Panel-Phase (bundled)

**Focus**: Fourth session in the AHJ compliance audit Sprint 1. C1 (220.84 multi-family DF) and C2 (live-derive feeder load) were merged earlier; this session shipped the bundled C3 (project-metadata validation) + B-1 (chatTools.ts AI staleness) + a third bug (panel-schedule PDF phase column / balancing) spotted on 2026-05-06 while the user was reviewing the same packet — all three are consumer-side wiring fixes that didn't touch any calculation engine.

**Status**: ✅ All three shipped on branch `fix/c3-b1-bundle`, PR #17 merged on 2026-05-07. 164/164 tests pass (was 138 pre-bundle, +26 new). `npm run build` exits 0 in 4.61s.

**Direction shift on 2026-05-06**: First C3 implementation hard-blocked PDF generation when fields were placeholder-shaped. User pushed back — contractors legitimately need draft packets with "TBD" for pre-application AHJ walk-ins. C3 was reworked into advisory-only (commit `b69a170`). Saved this preference to memory at `feedback_validation_advisory.md` so future sessions don't reintroduce hard-block validation. B-1 was unaffected.

**Panel-Phase bug spotted by user on 2026-05-06**: While reviewing the regenerated audit packet, user noticed every circuit on the Unit 108 Panel page (240V single-phase split-phase) showed "Phase A" and the load summary had Phase A = total / Phase B = 0 / Phase C = 0. Investigation showed the in-app `components/PanelSchedule.tsx` view was already correct (uses `getCircuitPhase` from `services/calculations/demandFactor.ts`, alternates A/B per row pair) but the PDF at `services/pdfExport/PanelScheduleDocuments.tsx` had reinvented its own broken inline phase logic at line 323/526 (always returned 'A' for single-phase) AND `calculatePhaseBalancing` for `panelPhase === 1` lumped all load to A. Same C1/C2 pattern: correct helper exists, PDF call site bypasses it. Fixed in commit `0c7ee2d`.

**Root causes (consumer-side wiring/validation, not engine bugs — same pattern as C1, C2)**:

- **C3**: `lib/validation-schemas.ts:projectSchema.address` only required `.min(1)`, so `"TBD"` (3 chars) passed. `components/PermitPacketGenerator.tsx:93` checked `contractorLicense.trim().length > 0` — accepting `"test"`. There was no schema for `permitNumber` at all. AHJ-rejection risk slipped past the existing form gates because they tested for emptiness, not validity.
- **B-1**: `services/ai/chatTools.ts:293` read `feeder.voltageDropPercent` (cached column on the `FeederSummary` exposed via `ProjectContext`). Same staleness pattern as the original C2 bug — the AI gave confident-but-wrong "Compliant. 0.00%" answers on EVSE feeders that were autopopulated before destination panel circuits existed. The `ProjectContext` summary is intentionally lossy (no `total_load_va`, `distance_ft`, etc.), so live-derive needed access to raw rows.

**Work Done**:

*C3 — `lib/validation-schemas.ts`*: Three new exported Zod schemas with a shared `PLACEHOLDER_VALUES` rejection list (`tbd`, `test`, `n/a`, `na`, `tba`, `todo`, `xxx`, `unknown`, case-insensitive):
- `projectAddressSchema` — `.min(8)`, must contain at least one digit (street # or ZIP), rejects placeholder strings
- `flContractorLicenseSchema` — `.regex(/^E[CR]\d{7}$/i)` (FL DBPR Certified or Registered), case-insensitive, rejects placeholders
- `permitNumberSchema` — optional + nullable; if present must be ≥ 4 chars and not a placeholder

The existing `projectSchema.address` left at its original permissive `.min(1).max(200)` — schemas are advisory-only.

*C3 — `components/PermitPacketGenerator.tsx`*: `safeParse` against all three schemas drives a blue informational alert ("Heads up — these may cause AHJ intake friction") that explicitly notes "Packet will still generate — these are informational only." Hard gating preserved only for cases that would break PDF gen (no panels, no contractor-license input at all, no scope of work). The Generate button stays enabled.

*B-1 — `services/ai/chatTools.ts`, `services/geminiService.ts`, `App.tsx`*: Plumbed raw DB rows alongside the lossy `ProjectContext` summary. `ToolContext` gained optional `rawPanels`, `rawCircuits`, `rawFeeders`, `rawTransformers`. `askNecAssistantWithTools` accepts an optional `AgenticRawData` arg. The `calculate_feeder_voltage_drop` tool now calls `computeFeederLoadVA` + `calculateFeederSizing` live and returns `{ voltageDropPercent, compliant, conductorSize, designCurrentAmps, liveLoadVA, calculationSource: 'live' | 'cached' }`. Falls back to cached when raw rows aren't wired.

*Panel-Phase — `services/pdfExport/PanelScheduleDocuments.tsx`*: Replaced inline `panel.phase === 1 ? 'A' : ['A','B','C'][(row-1) % 3]` at 2 render paths (full + lightweight) with `getCircuitPhase(leftNum, panel.phase === 3 ? 3 : 1)`. Rewrote `calculatePhaseBalancing(panelPhase=1)` to (a) place 1-pole loads on whichever leg `getCircuitPhase` says, and (b) split 2-pole 240V loads 50/50 across both legs (mirrors the existing 3-phase 2-pole logic and matches NEC physics).

**Key Files Touched**:
- C3: `lib/validation-schemas.ts`, `components/PermitPacketGenerator.tsx`
- B-1: `services/ai/chatTools.ts`, `services/geminiService.ts`, `App.tsx`
- Panel-Phase: `services/pdfExport/PanelScheduleDocuments.tsx`
- Tests: `tests/calculations-extended.test.ts` (26 new tests)
- Docs: `docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`, `docs/CHANGELOG.md`, `docs/SESSION_LOG.md`

**PRs**:
- #17 — C3 + B-1 + C6 (merged 2026-05-07).

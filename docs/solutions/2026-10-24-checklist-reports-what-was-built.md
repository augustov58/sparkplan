# The jurisdiction checklist reported pages and content the packet didn't have (#140, #147, #148)

**Problem.** E-502 marked requirements [X] for pages the packet never built (fault current, voltage drop, EVEMS, EVSE labeling) and for content only cited (a UL citation card counted as "cut sheets attached"). EV / transformer notes and requirements printed on jobs with neither, and Orlando's note 5 pointed at a fault-current page that existed only on new-service jobs.

## Approach

1. **Find what `detect()` reads.** `PacketAST.sectionKeys` was built from the section *toggles*. Builders skip a page when data is missing (voltage drop needs feeders, fault current needs SC calcs, EVEMS/labeling need matching panels). The fix: derive `sectionKeys` from the builders actually pushed (`PageKind` → `SectionKey`; `panelSchedule` → `panelSchedules`, cover excluded) in `permitPacketGenerator.tsx`.
2. **Give the context the facts the predicates need.** `AHJContext` had no equipment axis. Added `hasEV` / `hasEVEMS` / `hasTransformer` (undefined = unknown → item stays in), derived once by `data/ahj/checks.ts::ahjEquipmentFlags` and used by BOTH context builders (the UI's `components/PermitPacketGenerator.tsx` and the generator). Also aligned the generator's `scope` with the UI (`serviceScope(service_modification_type)`); it had been inferred from whether a 220.87 narrative was attached.
3. **Sweep every requirement and note, then classify.** Dumped all 177 requirements (id, name, `required`, `detect` source) and all 90 notes with a `tsx` script over `ALL_MANIFESTS`, then gated by subject: EV equipment (listings, anchoring, wet location, labeling, Knox/shunt) on `evInScope`, EVEMS narratives on `evemsInScope`, 450.3 on `transformerInScope`. Notes became `string | { text, when }` filtered in `manifestTextForEdition(manifest, edition, ctx)`.
4. **Three-state answers.** Added `AHJRequirement.partial` → severity `'partial'` (`[~] … — PARTIAL: <note>`): the specs sheet cites listings but no cut sheet is uploaded; the riser exists but panels lack AIC ratings (`PacketAST.riserAIC` / `riserConductors`).

**Failed / incomplete first passes.**
- After gating `required`, two Miami-Dade rows printed `[+]` on the café: their `detect` checked only that the equipment-schedule / general-notes *page* existed. Not-required + present = `[+]` ("optional item submitted"), which claimed transformer OCPD and wet-location content that wasn't there. Fix: detect the content (`transformerCount > 0`, the printed notes contain "wet location").
- A test regex `/\bEVSE?\b/` silently missed "EV panel": `?` binds to the last `E`, so it requires "EVS". Use `/\bEV(SE)?\b/`.
- Gating the EVSE labeling requirement on `hasEV` exposed that the labeling page was built only for panels *named* EV; a charger on "Main Panel" got no page. Detection now also takes any panel with an EVSE circuit.

## Judgment calls

- **Generic plan items keep their EV wording.** 16 required items still name EVSE (site plans, load calcs, Davie riser, Jacksonville equipment schedule); they're plan-set items every packet needs. `tests/ahjChecklistTruth.test.ts` pins that list so a new EV-only item can't slip in ungated.
- **Miami-Dade note 5 (fault current) stays unconditional**: its requirement is unconditional too. Orlando / City of Miami gate it on `scope === 'new-service'`, matching their requirements.
- **Upload slots** (`hvhz_anchoring`) also gate on `evInScope`; they are collapsed by default, so this only changes the default toggle.
- Undefined flags keep items in, so legacy callers and tests that build a context without them see the old behavior.

## Reusable rule

A checklist `detect()` checks the content it names, in the packet that was built — never a toggle, and never a page that only *could* hold it. When gating `required`, re-run with the item out of scope and look for `[+]`: a not-required item that still "detects" has a proxy check.

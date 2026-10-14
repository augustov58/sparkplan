# Single-family E-102 ignored the existing/new dwelling choice (#121)

**Problem**: on a single-family existing dwelling, E-101 used NEC 220.83 (137 A) and E-102 used the Part III cascade (203 A, "SERVICE UPGRADE REQUIRED"), on the same panel in the same packet.

## Approach

1. **Reproduce before asking the PE.** The issue was filed from code reading only. Running both functions on one fixture (`calculateDwellingPanelDemand` vs `calculateAggregatedLoad(..., 'dwelling')`) showed the gap was 66 A and flipped pass/fail. That changed the priority from citation polish to a wrong verdict.
2. **Print the packet.** A throwaway vitest harness called `generatePermitPacket()` (the Download button's entry point) with a single-family fixture, then `pdftoppm` to view E-101/E-102. The PE understood the problem from the rendered pages, not from the table of function names.
3. **Trace with `git log -S`, not memory.** E-101's single-family gate came in #65 (2026-05-16). E-102's demand source came in #109 (2026-05-27), which was built and verified on the 4-plex only. It called the multifamily/commercial engine and never checked dwelling type or existing/new. #109's comment "agree by construction" was true only for the occupancy it tested.
4. **Fix the source, not the page.** `aggregatedDemandSplit` in `components/PermitPacketGenerator.tsx` now calls `calculateDwellingDemandSplit` (`services/calculations/residentialLoad.ts`) whenever `buildSingleFamilyDwellingContext` (`lib/projectSettings.ts`) returns a context. That is the same gate E-101 uses, now a shared helper instead of an inline copy.

**Failed framing**: I first explained the gap as "the two NEC methods legitimately differ." The PE's reply was the real rule: existing dwelling → 220.83, period. The Part III page was never supposed to run for single-family. Ask "which method does the user's choice select?" before "which method is right?"

## Judgment calls

- **The 220.83 split**: existing = the method on `!is_proposed` circuits, proposed = total − existing. 220.83 has no native split, but this keeps E-102's layout and makes existing + proposed equal E-101's total by construction. The narrative copy flips to "Part IV (220.83)" with no copy change, because #122 already cites runtime references.
- **Not done**: the Part III defects found on the way (220.44 applied to dwellings; every `K` circuit priced as a range) no longer affect single-family packets. They still affect multifamily and commercial, so they get a separate issue. EV ×1.25 inside `calculateDwellingPanelDemand` is held for a PE ruling on whether 2023 §220.57's floor carries into Part IV.
- **Mirrored E-101's circuit set (MDP circuits only)**. Subpanel loads on a single-family job are outside both pages. That's a separate question, left out of this fix.

## Reusable rule

When two packet pages report the same quantity, they must call the same function behind the same gate helper. Grep for every caller of the page's data source and confirm each occupancy branch (SF new, SF existing, MF, commercial) routes identically. Never accept "agree by construction" without a per-occupancy test.

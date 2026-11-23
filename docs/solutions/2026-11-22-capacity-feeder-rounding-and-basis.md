# 3-phase capacity feeders read Outdated; live re-sizers ignored the basis (#299)

**Problem:** A regression from #283, found while building the #286 fixture. A 3-phase feeder sized on "Panel Max Capacity" was marked Outdated the moment it was sized: "Design current 400.0 A exceeds the 400 A feeder breaker". The design load is main × V × √3, stored as an integer VA. Divided back by √3 × V it gives 400.0002 A, and `feederBreakerReasons` compared that raw with `>`. The same rounding fired the older #144 advisory. #283's acceptance used a 240 V single-phase feeder (main × V is an integer), so it never hit √3.

The same fixture showed a second defect: the packet's voltage-drop page (and the Copilot's VD tool) re-size a feeder live from the circuit load and ignored `sizing_basis`. An empty 400 A panel printed 4/0 AWG at 0.0 A and 0.00 %, while Feeder Sizing and the riser said 2 × 250 kcmil at 0.47 %. The voltage-drop export gate also counted only circuit load, so its button stayed disabled.

## Approach

1. **Compare at the printed precision.** Round the design current to 0.1 A before comparing (the CLAUDE.md rounding rule for intermediate currents). 400.0002 → 400.0 passes; a real 400.06 → 400.1 still flags. The same change applies to the #144 advisory.
2. **One function for the capacity load.** `feederBreaker.ts::feederCapacityVA(panel, V, phase)` replaces three inline copies in Feeder Sizing. The re-sizers use it whenever `feederSizingBasis(feeder) === 'capacity'`: the packet's VD page, the Copilot, and the export gate's `resolveFeederLoadVA`. The basis has been stored since #283, so they can follow it now.
3. **Folded in (same feeder, same packet):** the equipment schedule prints the sets ("2× 250 kcmil"), as the riser already did.

## Reusable rules

- **Compare a derived quantity at the precision it prints.** A float round-trip through a stored integer can push it a hair over an exact limit.
- **Test the 3-phase case whenever √3 is in a formula.** Single-phase fixtures produce integers and hide rounding.
- **A stored mode must reach every reader that re-derives the value,** not only the page that stores it. Grep the readers when a mode is added.

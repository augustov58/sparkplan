# Two-unit dwelling service: a fourth method, three call sites (#127)

**Problem:** a two-unit building falls outside 220.84 (3+ units). The packet's MDP aggregate ran the commercial per-type cascade: 220.44 on small-appliance and laundry circuits, and every `K` circuit counted as a range. The Dwelling Load Calculator and the Multi-Family EV Calculator printed "220.84 @ 100%" with a warning.

## Approach

1. **Get the method ruled first.** PE ruling 2026-10-27: one building-wide Part III walk over both units, and NEC 220.85 (the lesser of that and 220.84 for three identical units) when the two units are identical.
2. **Reuse the #155 core.** `calculateDwellingStandardLoad` already applies the exact Part III rules. It needed only a laundry-circuit count, since a building has two. The appliance-toggle → items block in `calculateSingleFamilyLoad` became `dwellingItemsFromAppliances`, so templates feed the same items.
3. **One function, three callers.** `calculateTwoUnitDwellingLoad(units, identicalUnits)` combines the units into one walk, computes the 220.85 comparison, and returns the lesser.
   - `calculateMultiFamilyLoad` takes units from templates; they're identical when there's one template × 2.
   - `calculateAggregatedLoad` takes them from the circuits of the two unit panels; they're identical when the (load type, watts) multisets match.
   - `calculateMultiFamilyEV` path B takes them from its assumed units.
4. **Gate through the existing context.** `buildMultiFamilyContext` now returns a context for 2 units. `calculateAggregatedLoad` branches on `dwellingUnits === 2` before the cascade. EV and house panels add on as in the 220.84 branch. The existing/proposed split re-runs the walk on the existing circuits (#127 item 3 pattern).
5. **Prove agreement.** One fixture building gives the same totals through the circuit path and the calculator path: 47,310 VA Part III, 42,188 VA via 220.85. The QA duplex packet printed the same numbers.

## Failed hypotheses / traps

- **Category labels per unit broke the neutral.** Prefixing `category` with the unit name stopped `calculateNeutralLoad` from recognising 240 V-only rows ('Electric Range'). Unit labels go on `description`.
- **The context builder undid the new path.** `buildMultiFamilyContext` flags any panel with an EVSE circuit as the EV panel. A duplex unit with its own charger left the dwelling walk, and its whole panel was added at cascade demand: 72.6 kVA instead of 55.0 kVA. The test with a proposed charger caught it. For 2 units, panels that `isDwellingUnitPanel` recognises stay units. The same quirk on 3+ unit buildings changes the 220.84 base, so it was filed separately.
- **Breakdown rows must still sum (#160).** Part III counts the larger of heat/cool, and 220.52 allowances replace the circuits they cover. The aggregate adds a 0% "HVAC non-coincident" row, plus an allowance row when the circuits exceed the walk's connected load.

## Judgment calls

- 220.85 is skipped (with an INFO) when the units differ, or when they fail 220.84(A) (electric cooking, plus heat or A/C).
- When the service has other dwelling load beyond the two unit panels, or no unit panels, all circuits run as one group and 220.85 isn't taken.
- 220.84 connected for the comparison follows `calculateMultiFamilyLoad`'s convention: dryer at its 5 kVA minimum, EVSE at its edition load, larger of heat/cool.
- Neutral for a 220.85 result comes from the Part III rows, capped at the phase demand.
- The narrative prefers 220.85 over 220.84 when naming the Part IV method, because a 220.85 result cites both.

## Reusable rule

When a calculation gains a case, list every function that computes that quantity (packet aggregate, calculators, side calculators) and route them through one function. Then re-check the classifiers that run before it (which panel is EV, house, or a unit). A context builder's side decisions can silently remove loads from the new path.

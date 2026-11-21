# A feeder had no breaker of its own (#283)

**Problem:** Feeder Sizing sized the phase conductors to the design load but the EGC to the destination panel's main breaker (10 AWG + 8 AWG EGC on a 22 A feeder into a 100 A subpanel). Six readers each guessed the feeder's OCPD with their own fallback (`main_breaker_amps || feeder_breaker_amps || bus_rating` in one order or another), Recalculate always re-sized as load-based, and the stale check guessed "capacity-based" from a stored load within 5 % of the panel's rating.

## Approach

1. **Owner ruling first** (option b): a feeder has its own breaker in `panels.feeder_breaker_amps`, editable, defaulting by basis; conductors carry the load and are protected by it; EGC from it; a nullable `feeders.sizing_basis` replaces the guess; transformers keep their primary breaker. Migration applied to prod with the owner's approval; `lib/database.types.ts` edited to match (two test fixtures that build full rows needed the new field).
2. **One pure module, every reader.** `services/feeder/feederBreaker.ts`: `feederBreakerAmps` (stored → default by basis → panel main when no feeder is drawn), `feederEgcSize`, `feederBreakerReasons` (Outdated), `feederOcpdForSizing` (for live re-sizing). Readers: the panel schedule's feeder row, the packet / export feeder rows (`feederRows.ts` gained `feeders`), Feeder Sizing (card, form, Recalculate), Inspector Mode (EGC + a new 240.4 check), the stale check, the packet's voltage-drop page and the Copilot (both re-size live, so they must size against the same breaker).
3. **Protection inside the sizing, not after it.** `calculateFeederSizing` takes `ocpd_amps`; the conductor is sized for max(design current, `minimumProtectedAmpacity(breaker)`) — the smallest ampacity 240.4(B) lets the breaker protect — so the existing ampacity adjustment, termination column, voltage drop and conduit all see the final conductor.
4. **EGC straight from Table 250.122.** `sizeConductor`'s OCPD argument would apply its 250.122(B) proportional increase against a 75 °C "typical" conductor, wrongly upsizing a 60 °C feeder's EGC; so the EGC comes from the table by the breaker, as the old Feeder Manager table did.

## Caught in the UI pass

- `getEgcSize` returns bare sizes ("10", "250"); the first build printed "EGC: 10". Formatted through `parseConductor`.
- The stale banner and card printed "5,100 VA → 5,100 VA (0%)" for a breaker problem; they now print the breaker reason.

## Not done / side effects

- Feeders sized for "Panel Max Capacity" before the column existed read as load-based (no backfill — a backfill from the 5 % rule would be the same guess) and show Outdated until re-sized.
- The packet prints a feeder's breaker only on E-301 rows of breaker-fed subpanels; feeder EGC isn't printed on any packet page.

## Reusable rules

- **When several readers each pick "the" value with their own fallback chain, the fix is a stored value plus one function, not aligning the chains.**
- **Put a constraint into the sizing input (a minimum ampacity), not a check after it,** so every derived quantity uses the final size.
- **A new column on a full-row type breaks fixtures that spell out every field** — run `tsc` right after editing `database.types.ts`.

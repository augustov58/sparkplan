# A panel with only feeders showed their total as its "direct" load (#213)

**Problem:** `PanelSchedule.tsx`'s `demandResult` has a "minimal result" branch for a panel with no branch circuits. It set `totalConnectedLoad_kVA` and `totalDemandLoad_kVA` to the feeders' total, so on an MDP that feeds everything through sub-panels:
- the "Direct circuits load" and "Direct demand load" cards showed the feeders' total;
- "Feeder circuits" showed it a second time;
- the demand table printed a lone TOTALS row with the feeders' *demand* under "connected".

## Approach

1. **Zero is the right direct load.** A panel with no branch circuits has none. The feeders' load already has its own cards ("Feeder circuits", "Demand with feeders") and Demand Amps reads the aggregate, so only the two direct values changed.
2. **Replace an empty table with a sentence.** No rows, no TOTALS row: a note that the panel's load is the panels it feeds.
3. **Fix the flake the full folder exposed.** Each run of `tests/e2e/issues/` failed a different spec at `waitForLoadState('networkidle')` on the dashboard. Realtime subscriptions and 13 QA projects keep the network busy past 30 s. Every spec waits for the project card (or calls the app's client) next anyway, so the specs wait for `domcontentloaded`. The folder now passes in ~1 minute instead of ~2.

## Verification

- UI: "QA EVEMS downstream" MDP 0.0 / 0.0 / 44.1 / 44.1 kVA / 183.8 A; "QA Feeder sizing" 0.0 / 0.0 / 49.9 / 49.9 kVA / 207.8 A; the note in place of the table; feed-thru totals unchanged.
- `tests/e2e/issues/issue-213.spec.ts` (two projects; fails on `main` with "Direct Circuits Load 44.1 KVA"). Independent verifier.

## Reusable lessons

- **A "minimal" fallback object still feeds every card that reads it.** When filling one for an edge case, set each field to what it means (here zero), not to a nearby total.
- **`networkidle` is the wrong readiness signal on a realtime app.** Wait for the element the next step uses.

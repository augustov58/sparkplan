# Template circuits had conductors smaller than their own load (#294)

**Problem:** The #280 sweep checked every template conductor against its *breaker*. Four motor/transformer rows looked like an NEC question (240.4(G)/(F) can let a motor or transformer breaker exceed the conductor ampacity), so they were filed. Checking the same rows against their *stored load* settled it: the templates set each load near breaker × V × √3, so 8 of 51 circuits had a conductor smaller than the load itself (a 100 A chiller at 96.2 A on 3 AWG, rated 85 A at the 60 °C terminals; 3,000 W of lighting on a 120 V, 20 A circuit, which is 25 A, above its breaker). No article makes a conductor legal below its own load, and 240.4(F) covers only *secondary* conductors, so the transformer primary is under 240.4(B).

## Approach

1. **Owner ruling (b):** upsize to the #280 rule *and* give the rows realistic loads. Applied as posted for veto: load = what the breaker serves as a continuous load (breaker ÷ 1.25), the transformer at its 75 kVA rating; the #280 conductor only where the old one isn't code-legal (1 AWG on 100 A, 3 AWG on 80 A; 6 AWG on 60 A stays under 240.4(B)).
2. **A test over every template circuit,** `conductorCodeLegal({ conductor, breakerAmps, loadAmps })`, so a future template row can't regress. Load current: W ÷ (√3·V) for 3-pole, W ÷ 120 for a 1-pole circuit on a 208Y/120 panel.
3. **UI check:** the panel schedule shows per-phase kVA; conductors only appear in the Material Take-Off (`/materials`).

## Caught on the way

- **An e2e cleanup that "passed" but deleted nothing.** The dashboard removes a card optimistically, then sends the DELETE. The spec's next `page.goto` cancelled the request. Separately, it counted cards before the project list had loaded, so it skipped the delete. 7 template projects piled up in the QA account. Fix: wait for a known QA card before counting, and wait for the DELETE response. Confirm cleanup in the database, not on screen.
- **`cmd | tail; echo $?` reports `tail`'s exit code.** A tsc error printed while "tsc=0" was echoed. Run `npx tsc --noEmit; echo $?` without a pipe.

## Reusable rules

- **Check a conductor against its load and its breaker,** not just the breaker. A load above the conductor's ampacity is a defect under every article.
- **Before filing an NEC question, rule out the plain defect.** The article question here never arose.
- **Verify e2e cleanup in the database;** an optimistic UI can hide a cancelled write.

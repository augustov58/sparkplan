# The EVEMS tool took 4+ chargers at 75–95%, and the first issue run through the UI loop (#194)

**Problem:** `evemsLoadManagement.ts` had a private `calculateEVDemandFactor`:
- 95% for 4–10 chargers, 85% for 11–25, 75% above that;
- labelled "NEC 625.44", a section about equipment connection;
- `calculateMaxChargers` divided by 0.85.

The NEC has no EVSE demand factor. Since #192 the service check adds 25% of the EV load, so the tool was off by about 30% in the unsafe direction for large sites. #194 was also the pilot of the agent-run UI acceptance loop (`.claude/skills/issue-verification/`).

## Approach

1. **Write the expected values before reading the result code closely.** The Acceptance table has four steps:
   - 4 chargers (the old 95% bucket);
   - 12 chargers (85%);
   - EVEMS on;
   - a Level 1 charger under NEC 2023 (the 7,200 VA floor).

   Each value is worked out by hand from the rulings (100% load, +25% adder, setpoint = available × 0.90 ÷ 1.25), not from the app. Pin the QA project's edition to 2023 so the values don't change on Florida's 2026-12-31 cutover.
2. **Reproduce every step on `main` first.** Reproduction found a second visible bug that wasn't in the issue: "EVEMS can reduce required capacity by up to **−1.5 kVA**". The benefit was `total × 0.9 − demand`, which is negative whenever the factor is above 0.9. A fix built only from the issue text would have left it broken. Its new definition, the service-check load saved by a setpoint that fits, follows from the same rulings, so it went into the same PR.
3. **Make the edition a required input.** `necEdition: NecEdition` without a default means `tsc` lists every caller. A default would have compiled silently with the wrong edition; the Mistake Ledger row about optional edition arguments.
4. **Keep the Article 220 load and the service check as two printed numbers.** "EV Load" shows 100% (or the setpoint), "Continuous +25%" is its own line, and "Total" is the service check. The tool's ×1.25 "growth margin" on the recommended service size was left alone, the same as `recommendServiceSize` in #192.
5. **File what the reproduction surfaced instead of fixing it here:**
   - #198: the EV Charging calculator's copy of the factor. Fixing it needs a ruling on its user-entered "simultaneous use %".
   - #199: the EVEMS load schedule shows charging above the setpoint, built from made-up multipliers.

   Both need decisions the owner hasn't made.

## Verification

- `tests/evemsLoadManagement.test.ts` (6 tests): the hand-calculated values, NEC 2020 vs 2023 for a Level 1 charger, and that the setpoint never goes negative.
- UI acceptance on the QA account matched every step, and the guardrails held: capacity 48.00 / 24.00 kVA, and the EVEMS total stayed 45.6 kVA / 95.0%.
- An independent verifier subagent got only the Acceptance section.
- `tests/e2e/issues/issue-194.spec.ts` passes on the branch and fails on `main`.

## Reusable lessons

- **The pilot's harness traps:**
  - The welcome modal covers the dashboard in a fresh browser context while the project list is still loading. Specs set `welcomeModalDismissed` with `addInitScript`.
  - The MCP browser only writes files under the repo, so screenshots go to `.playwright-mcp/` (gitignored), not the scratchpad.
- **An invented factor rarely sits alone.** Grep the function name across the repo: here a second copy lived in another calculator with a different input.

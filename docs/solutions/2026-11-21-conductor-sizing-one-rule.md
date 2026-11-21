# Four tools sized branch conductors from their own lists (#280)

**Problem:** #271 put the two EV tools on one rule (Table 310.16 at `terminationTempC`: 60 °C up to 100 A, 75 °C above, 75 °C option noted). The Copilot (`add_circuit`, `check_conductor_sizing`, `run_quick_inspection`), Circuit Sharing and the multifamily generator still used private lists — 4 AWG for every breaker above 50 A, an 8 AWG fallback, 2 AWG on 100 A, checks against the load at 75 °C. Some answers were undersized in either column.

## Approach

1. **Sweep before fixing, and count.** Grep every assignment of a conductor size (29 files + 2 backend agents), then classify: 12 code paths pick or check a size; 5 already followed the rule (`sizeConductor` and its callers, the two EV tools); 6 broke it (this PR); 1 broke it but has no caller (`breakerSizing.ts`, filed #293). Static template data checked separately with a throwaway test: 4 of 51 circuits are motor/transformer rows where 240.4(G)/(F) may allow it (filed #294, NEC question).
2. **Two helpers next to #271's** in `data/nec/table-310-16.ts`: `conductorForBreaker` (pick) and `conductorCodeLegal` (check: 110.14(C)(1) column, 210.19(A)(1), 240.4 with (B) and (D)). Every path calls them.
3. **"Code-legal", not "ampacity ≥ breaker".** 240.4(B) needs three facts: the ampacity is not itself a standard rating, the breaker is the next one above it, ≤ 800 A, and the circuit isn't a multi-outlet receptacle circuit. A conductor legal only at 75 °C is reported as such (the tool can't see the terminations) — a warning, not a pass or a critical.
4. **The Copilot's LLM was down** (Gemini credits depleted), so the UI pass ran the tools' own `executeTool` inside the live app, plus unit tests.

## Hand calcs I got wrong (twice)

- "8 AWG on 50 A → critical": 50 A at 75 °C is legal with 75 °C-listed terminations → warning.
- "6 AWG on 70 A → 240.4(B) allows 60 only": at 75 °C it's 65 A, not a standard rating, so the next one up is 70 → legal with 75 °C terminations. The clean critical case is 8 AWG on 60 A (40 / 50 A, both standard ratings).
Both corrections are written in the issue with the reason.

## Reusable rules

- **For "next size up" (240.4(B)) check all three conditions in both termination columns** before writing an expected value; pick test cases where the ampacity is a standard rating when you want a hard failure.
- **A sweep's count is part of the answer.** List candidates, classify each, and state "N paths, M compliant" — then the PR can say what it didn't touch.
- **Chain commits behind the checks** (`tsc && test && git commit`), or a red tsc lands in a commit.

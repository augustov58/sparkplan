# The Copilot called 80 % of the bus an NEC limit (#349)

**Problem.** The Copilot's `check_panel_capacity` compared connected load with 80 % of bus × V × 1.732 ("80% rule for continuous loads") and the model presented it as "Continuous Load Capacity (80% limit per NEC 408.36 / 215.2)": a panel at 59.1 A of 200 A read 37 %. #193 and #225 had already ruled the bus check (design load vs the full bus, NEC 408.30), and the Copilot's context already carried each panel's `designAmps`; this tool never read it.

## Approach
1. **The ruling was mostly already made.** #225 (design load vs bus) and #190/#192 (continuous = the service check's list) answered everything except how a *proposed* load counts. Owner (2026-11-25, option a): like loads on the schedule, 100 % + 25 % when `isContinuousServiceLoad` (EVSE, sign, show window). One classifier, so the same load counts the same before and after it's added.
2. **Sweep by the formula, not the reader.** `grep '0\.8\|80%\|1\.732'` over `services/ai/` and `geminiService.ts`: 11 hits. Three were the same rule (this tool, `get_project_summary`'s unlabelled utilization, the quick inspection's no-design-amps fallback); the rest each have a reason to stay (#193's labelled no-project estimates, 210.20(A) branch warning, test-load filler).
3. **No design load → no verdict.** The tool says the design load isn't available rather than falling back to connected load.
4. **E2e without Gemini variance:** stub only Gemini's function call; the tool runs on the real QA project (design amps from `panelDesignAmps`), and the spec asserts the tool result sent back to the model.

## Judgment calls
- Kept balanced VA ÷ (V × √3) as every panel check in the app does; a single 1-phase load on a 3-phase panel adds its full current to two legs (owner can ask for per-leg).
- The tool's `basis` explains that the 125 % is already in the design load, without naming "80 %" (naming it invites the model to discuss it).
- The quick inspection's "> 80 % approaching limit" warning stays (it calls 100 % the limit); its wording follows #348.

## Reusable rule
When a rule is retired, sweep its formula's signature across the area (`* 0.8`, `1.732`, `80%`), count every hit, and fix or justify each one; a sweep by reader names misses the readers nobody listed.

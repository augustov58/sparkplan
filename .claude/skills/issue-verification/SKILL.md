---
name: issue-verification
description: The agent-run acceptance loop for every issue SparkPlan tackles — write expected values before the fix, reproduce in the UI, fix, drive the real app as the user would, get an independent verifier pass, leave a Playwright regression spec, and put the evidence in the PR. Use when filing an issue, before starting work on one, and before opening its PR. Replaces owner review of behavior; the owner still rules on NEC and approves push/merge.
---

# Issue Verification (agent-run UI acceptance)

Owner decision 2026-11-08: Augusto does not review fixes by hand. Every issue is verified by driving the real app the way he would, against numbers written down **before** the fix. This runs **in addition to** build / `npm test` / `tsc`. The PR hook (`.claude/hooks/require-ui-verification.py`) blocks `gh pr create` without the evidence.

What stays with the owner: NEC interpretations (Escalation Rule 1), Stable Module changes (Rule 2), and approval to push and merge.

## Environment

- **QA account only.** The local app (`npm run dev`, localhost:3000) talks to **prod** Supabase. Writes inside the QA account (`E2E_QA_EMAIL`) are pre-authorized for this loop: create, edit and delete QA projects, Save to Packet, calculator saves. Writes to any other account, and schema/SQL changes, still need a yes.
- **Interactive driving:** the `playwright-qa` MCP server (own browser profile, signed in as the QA account). Before the first write in a session, read the signed-in email (sidebar, or `localStorage` `sb-*-auth-token` → `user.email`). Not the QA email → stop and say so. Never sign the profile out.
- **Specs:** `npx playwright test` — `auth.setup.ts` reuses the saved QA session and fails on any other account. A dead session needs the owner's one-line sign-in (the error prints it); never ask for the password in chat or a `!` command.
- **QA projects:** named fixtures in the QA account, listed in `tests/e2e/fixtures.md`. Use one that covers the scenario; add a project (and a line in that file) when none does.

## The loop

1. **Acceptance criteria — when the issue is filed, before any code.** Add an `## Acceptance (UI)` section to the issue:
   - QA project, page, and the clicks/inputs, in order.
   - Every expected value with units (`E-102 total 30.08 kVA`, `wizard 125 A`), **computed by hand from the NEC math in the issue**, not read from the app or the code under change. Show the arithmetic in one line each.
   - What must NOT change (the guardrail numbers: E-101, panel totals, other methods).
   - For a ruling-dependent issue, the expected values wait for the ruling.
2. **Reproduce first.** Drive the steps on `main`; screenshot the wrong value (`before-*.png`). Not reproducible → stop, report what you saw, don't fix.
3. **Fix** with unit tests (existing protocol). The code gates run as usual.
4. **Acceptance pass.** Drive the same steps on the branch. Record `step | expected | observed | screenshot` for every value, plus the guardrails. Any mismatch → fix or stop; never edit the expected value to match the app without saying why in the PR (a wrong hand calc is a finding too).
   - Touches a packet page → also run `.claude/skills/packet-verification/` (generate, read the pages, save the fixture, mirror to Obsidian).
5. **Independent verifier.** Spawn a fresh subagent with ONLY: the issue's Acceptance section, the app URL, the QA-account rule, and this return format — no diff, no reasoning of yours:
   ```
   Report via the final message, literal values, nothing abbreviated:
   STEP_1=<observed value with units> ... STEP_N=...
   GUARDRAIL_<name>=<observed>
   VERDICT=PASS|FAIL
   NOTES=<anything that looked wrong, even outside the steps>
   ```
   Compare its values with yours line by line. A disagreement blocks the PR until explained.
6. **Regression spec.** Turn the steps into `tests/e2e/issues/issue-<N>.spec.ts`: QA project by name, assert the expected values from step 1 (as text in the UI), screenshot on failure. It must pass on the branch. Copy the shape of an existing spec in `tests/e2e/issues/`.
7. **Evidence in the PR.** The body gets:
   ```
   ## UI verification
   | Step | Expected (hand calc) | Observed | Verifier | Evidence |
   |---|---|---|---|---|
   Guardrails unchanged: ...
   Spec: tests/e2e/issues/issue-<N>.spec.ts (passed)
   ```
   Send the before/after screenshots to the owner (SendUserFile) and mirror them with the fixtures. No prod row IDs or settings values in the public PR.
   A PR with no UI-visible change keeps the heading with `N/A — no UI change: <reason>` (docs, CI, a refactor proven by unit tests).
8. **Owner:** says merge (or not). Nothing else is asked of him unless the loop hit an NEC question or a Stable Module.

## Traps

- **Circular checks.** "The UI says 125 A, so 125 A is right" proves nothing. The expected column is written before the fix.
- **Verifier told the answer.** Giving the verifier your numbers or the diff turns it into a confirmation. It gets the Acceptance section only.
- **Wrong account.** One write to the owner's account from a spec or the MCP browser is a prod incident. The email check is not optional.
- **Spec asserts the implementation.** Assert what the user sees (text on the page), not internal state or saved jsonb.

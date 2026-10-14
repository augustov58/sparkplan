# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-10-13

---

### Session: 2026-09-21 → 2026-10-13 — PE-review citation fixes + cron storage fix + housekeeping (PRs #119, #120, #122, #123 merged)

**Focus**: Four independent PRs landed after PR #118. Three are NEC-correctness fixes that came out of PE review, and one is a database-storage emergency. This entry is post-merge housekeeping: doc sync and local cleanup.

| PR | Commit on main | What |
|---|---|---|
| **#119** `fix/cron-maintenance` | `e8919bc` (merge) | The DB was at 376 MB of the Free plan's 500 MB read-only ceiling; 95% of it was output from the every-minute `support-inbound-poll` cron. The poll now runs `*/5`, `cron.job_run_details` keeps 7 days (`prune-cron-history`), and both bookkeeping tables get a weekly `VACUUM FULL`. A one-off repair (not in the migration) took the DB from 376 MB to 27 MB. Migration `20260921_cron_maintenance.sql`. |
| **#120** `fix/nec22087-help-text` | `76a5ebf` | Copy-only. The Existing-Load Method help text in the Permit Packet Generator stated the 220.87 multiplier rule backwards (a string left over from Sprint 2A that the PR #118 sweep missed), and the `calculated` option label cited 220.82/220.84 for every occupancy. |
| **#122** `fix/nec22087-dwelling-citation` | `94bf7a6` | E-102 now cites the NEC 220 Part the calculation actually ran, via `summarizeCalculationRefs()`. It shows Part IV (220.84) only when the Optional Method ran; otherwise Part III with the runtime section list. No numbers change. PE ruling 2026-09-27. |
| **#123** `fix/nec2020-evse-load` | `de2b151` | Florida enforces NEC 2020, which has no §220.57. Per-EVSE load now goes through `getEvseLoadVA(nameplate, edition)`: nameplate on 2020, max(7,200 VA, nameplate) on 2023, both at 100%. The edition resolves through `resolveNecEdition()`. New projects default to `nec_edition = '2020'`. Tests: 1,051 passing. |

**Process lessons**:
- **Cite from runtime, not from a lookup keyed on occupancy.** The narrative page cited sections that its own calculation never ran. Taking references from the result object makes the citation match the math by construction (Mistake Ledger row, `docs/solutions/2026-09-27-narrative-cites-method-that-ran.md`).
- **Check a section exists in the adopted edition before citing it.** 220.57 is 2023-only. A test asserted the wrong citation, so the suite was enforcing the bug (`docs/solutions/2026-09-27-evse-load-nec-edition.md`).
- **Background jobs cost storage, not just API quota.** The 2026-04-17 migration justified a one-minute poll by Gmail quota alone. pg_cron history and pg_net responses grew to 95% of the database without anyone noticing.
- **Squash merges hide shipped branches from `git log origin/main..HEAD`.** Check `gh pr list --head <branch> --state all` before treating a branch as unmerged.

**Housekeeping (2026-10-13)**: switched the main checkout to `main`; removed the stale locked worktree `.claude/worktrees/fix-nec2020-evse-load` (its lock-holder process was gone) and the two merged local branches. Committed the `.gitignore` entries for `.outreach/` and Apify credentials (keeps lead PII and scraper tokens out of git). Synced ROADMAP (Phase 3.14), CHANGELOG (#120 entry), and `database-architecture.md` (scheduled jobs).

**Next steps**:
1. Issue **#121**: single-family E-101 (220.82/220.83) and E-102 (Part III) compute existing load with different methods. Needs a PE presentation ruling.
2. Playwright packet-verification pass on `new 4-plex`, plus a single-family existing project. The test plans for #122 and #123 left this unchecked.
3. The chatbot system prompt still says "2023 edition unless specified" (`services/geminiService.ts`, 3 sites). This conflicts with the NEC 2020 default that #123 introduced.
4. FBC 9th Ed. takes effect 2026-12-31. Update the manifests' `necEdition` once its NEC edition is confirmed.

---

### Session: 2026-07-07 → 2026-07-09 — Fable intelligence extraction + NEC 220.87(2) measured-demand fix (PR #118 merged, squash `44ca8bc`)

**Focus**: Applied the "Do this on your last day with Fable" playbook (Machina, X 2026-07-06) in a worktree: rewrote CLAUDE.md as an explicit operating manual (Mistake Ledger, Escalation Rules, hardened Verification Protocol, skills index), wrote 3 subsystem skills (`nec-calc-service`, `permit-packet`, `packet-verification`), and scaffolded `docs/solutions/`. Mid-work, verified the source article against the live rendered X page — the saved Obsidian note contained four fabricated passages from a bogus "X API verbatim" recovery; corrected the note and reconciled the repo artifacts (added the missing Escalation Rules element; aligned the recorder draft to the article's `extract-approach` spec, transcribed from an image embed).

**The big one — NEC 220.87(2) fix (PE review finding)**: During PR review Augusto flagged that measured demand should take the 125% factor. Confirmed against code text: NEC 220.87(2) requires "the maximum demand at 125 percent plus the new load" ≤ service rating. All three implementation sites (`serviceUpgrade.ts` × 2 functions, `PermitPacketDocuments.tsx::NEC22087NarrativePage`, `multiFamilyEV.ts` PATH A) exempted `utility_bill`/`load_study` — understating existing load, the UNSAFE direction (the packet page even printed the correct condition-2 header above math that omitted the factor). Fixed all three + `ServiceUpgradeWizard` copy (which carried labels from two stale eras); the 2026-05-27 ruling stands (`calculated` → direct; `manual` → ×1.25 defensive). 4 tests rewritten to the corrected rule; 1035 passing; tsc clean. Visual proof: rendered the narrative page through the real @react-pdf pipeline — the money case (measured 120 + 48 new on 192 kVA capacity) now correctly FAILS at 103.1% where the old code approved it at "168 ≤ 192". PDFs at `example_reports/NEC22087_Narrative_*_PR118_2026-07-09.pdf`.

**Process lessons**:
- **The two 220.87 bugs were mirror images with different failure loudness.** Over-applying a factor fails loud (388% utilization gets questioned); under-applying fails silent (packet looks fine, margin isn't there). Direction-of-failure is now recorded in the Mistake Ledger and `docs/solutions/2026-07-09-nec22087-measured-demand-125pct.md`.
- **"Already solved" ≠ solved.** Sprint 2 settled only the *calculated* half of 220.87; the measured half survived two reviews because the pre-existing code already exempted it. When a value is exempted from a code-mandated factor because it's "already X", verify against the code section's literal text.
- **Test assertions that only check `blob.size > 0` prove nothing about correctness** — `nec22087NarrativePdf.test.ts` stayed green through the behavior change. Math assertions live in `calculations-extended.test.ts`; render checked visually.
- **Browser topology**: claude-in-chrome = Augusto's remote browser via Orca IDE (no localhost access to this host); Playwright MCP = local browser for dev servers; e2e auth via user-run `tests/e2e/auth.setup.ts` (env-var credentials, never handled by the agent). Saved to memory as `environment_browser_topology`.

**Post-merge housekeeping (this entry)**: worktree + branches removed; `extract-approach` skill ACTIVATED (`.claude/skills/extract-approach/SKILL.md` + Learning Law in CLAUDE.md); CHANGELOG + SESSION_LOG updated.

**Next steps**: (1) optional in-app e2e pass of the Service Upgrade Wizard once Augusto refreshes the Playwright auth state; (2) the article's remaining runtime workflows on request — consultant audit (repo + business → executable roadmap), second-brain research runs into Obsidian.

---

# NEC edition came from four sources that disagreed (#141 + edition picker)

**The problem:** the project's NEC edition was read from the manifest map, the `projects.nec_edition` column, the `jurisdictions.nec_edition` row, and hard-coded strings. The packet printed "NEC 2023 Adopted" on E-502 next to an NEC 2020 checklist, and nothing would switch to NEC 2023 when Florida adopts it on 2026-12-31.

## The approach

1. **Sweep before designing.** `grep -rnE "necEdition|nec_edition|NecEdition|NEC 20(14|17|20|23|26)|currentYear"` returned 59 files. Each was classified as: calc taking an `edition` parameter (fine); a reader that must switch; a creation-time default for the legacy column (leave); or a comment.
2. **Make the edition a function of (pick, jurisdiction, date), not stored data.** `data/ahj/codeCycle.ts::resolveNecEdition(override, jurisdiction, date)`. The pick is `settings.nec_edition_override`; no key = Automatic, so existing projects needed no migration. Once the manifest no longer decides the edition, the building type stops mattering, and every hard-coded `'single_family_residential'` argument went away with it.
3. **Rewrite cycle-specific text rather than duplicating it.** Manifest notes, code references and checklist names were written for "2020 NEC / FBC 8th edition (2023)". `applyCodeCycle(text, edition)` rewrites them for 2023. Only Miami-Dade, whose split cite (SF NEC 2014 / commercial NEC 2020, "per PRG") a rewrite would misattribute, gets explicit `generalNotesByEdition` / `codeReferencesByEdition`. A test asserts that no manifest string still cites NEC 2020/2014 or FBC 8th under 2023.
4. **Visual pass with the picker set both ways** on a QA project (Automatic → 2020 text; 2023 pick → cover, codes, notes, checklist and E-502 all 2023), then restore Automatic and confirm it after a full reload.

**Failed / rejected hypotheses:**
- "Automatic = Florida table for every project." Wrong: the jurisdictions seed has 6 Texas rows. Automatic uses the row's own edition when `state` ≠ FL and ignores the Florida rows' column (it said 2023).
- "Store the resolved edition in the column on save." Rejected: Automatic changes with the date, so a stored value goes stale on 2026-12-31 with no save to trigger an update.

## The judgment calls

- **Stable module untouched.** `OneLineDiagram.tsx` would have needed the edition threaded through it for its export footer ("NEC ${currentYear} Edition" = a nonexistent NEC 2026). Dropped the edition from the footer instead.
- **Contractor overrides are not rewritten.** Their typed notes print verbatim; only manifest/default text follows the cycle.
- **FFPC / NFPA-70E strings left alone.** Their next-cycle editions weren't verified.
- **Python backend mirrors the resolver** (`backend/tools/database.py::resolve_nec_edition`) instead of trusting the column; the duplicate is commented "keep in sync".
- **Out of scope, still open:** the 220.84 building total, aggregation and 220.87 new load don't take the edition (needs a PE ruling on 220.57 there); stored results carry no edition stamp (#158); prod jurisdiction rows' notes text.

## The reusable rule

When a value varies by jurisdiction and date, compute it from one resolver at read time and grep every reader (count the hits, then classify them) — never store the resolved value or read a convenience column that can't know the date.

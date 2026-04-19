# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-04-19

---

### Session: 2026-04-19 — `/circuits` Bug Sweep: Number Inputs + Panel CRUD Cross-Component Refresh + Cascade-Delete

**Focus**: Three user-reported bugs all surfacing on `/circuits`:
1. Every controlled `<input type="number">` retained a leading "0" after clear-and-retype (typed `3` → `03`, typed `36` → `036`).
2. A newly created panel did not appear in FeederManager's Destination Panel dropdown until page refresh, even though it was visible elsewhere on the page.
3. Deleting a panel that was referenced by any feeder returned a 400 and a misleading "Failed to update panel" toast.
**Status**: ✅ All three fixed, verified live by user. PR #8 and PR #9 merged to main.

**Work Done:**

*Bug 1 — Leading-zero echo on numeric inputs (PR #8, commit `e8f8029`):*
- Root cause: controlled pattern `value={n} onChange={e => setN(Number(e.target.value))}` re-renders as `value="0"` while the user is typing, because `Number("") === 0`. The browser echoes the `0` back into the input.
- Fix: replaced 39 controlled sites with the existing `NumberInput` component (`components/common/NumberInput.tsx`), which keeps a local string buffer and only commits to the numeric state on valid parse / blur. Touched `DwellingLoadCalculator.tsx` (16 sites) and `Calculators.tsx` (23 sites). Skipped 5 nullable sites that already used the `value={x || ''}` + `... ? Number(...) : null` pattern (they dodge the bug).
- Did NOT touch `LoadCalculator.tsx` — its two number inputs use react-hook-form's `{...register(...valueAsNumber: true)}`, which is uncontrolled and has no echo-back.

*Bug 2 — Panel CRUD not refreshing peer `usePanels` instances (PR #9, commit `0d395f5`):*
- Root cause: `/circuits` mounts TWO `usePanels(projectId)` instances — one inside `OneLineDiagram`, one inside `FeederManager`. Both open a Supabase realtime channel named `panels_${projectId}`; the second subscriber on a shared channel can miss `postgres_changes` events during reconnects. The hook already subscribed to `dataRefreshEvents.subscribe('panels', ...)` as a belt-and-suspenders fallback, but none of `createPanel`/`updatePanel`/`deletePanel` ever emitted — the bus was half-wired.
- Fix: `createPanel` / `updatePanel` / `deletePanel` emit `'panels'` on success. Symmetry gap noted for `useCircuits.ts` / `useMeters.ts` / `useMeterStacks.ts` (subscribe-only, no emit) but deferred since no repro reported.

*Bug 3 — Panel delete rejected by feeder CHECK constraint (PR #9, commit `545ef2e`):*
- Root cause discovered via live Supabase logs. API log: `DELETE | 400 | /rest/v1/panels?id=eq.607442d3-...`. Postgres log at same timestamp: `ERROR: new row for relation "feeders" violates check constraint "feeders_source_and_destination_check"`. The feeders table has ON DELETE SET NULL on `source_panel_id` / `destination_panel_id`, but `feeders_source_and_destination_check` requires exactly one of `{panel_id, transformer_id}` per side. For a panel→panel feeder, the cascade leaves both sides null → constraint fires → delete rolls back with a 400.
- Secondary UX bug: `toastMessages.panel.error` was hard-coded to "Failed to update panel" regardless of verb, so a delete failure looked like an update failure.
- Fix (app-level cascade, not DB schema change):
  - `deletePanel` now deletes dependent feeders via `.or('source_panel_id.eq.${id},destination_panel_id.eq.${id}')` before deleting the panel, then dispatches the `feeder-data-updated` window event so `useFeeders` instances refetch.
  - `OneLineDiagram.removePanel` counts affected feeders from already-loaded state and adds "This will also delete N feeders connected to this panel." to the confirm dialog.
  - Added `toastMessages.panel.deleteError` for verb-specific error wording.
- Considered and rejected: changing FK to `ON DELETE CASCADE` (silently loses user data on misclick); loosening the CHECK (permits orphaned feeders at rest).

**Key Files Touched:**
- `components/DwellingLoadCalculator.tsx`, `components/Calculators.tsx` — NumberInput migration (PR #8)
- `hooks/usePanels.ts` — emits `'panels'` on CRUD; cascade-deletes feeders in `deletePanel` (PR #9)
- `components/OneLineDiagram.tsx` — `removePanel` now warns about feeder cascade count (PR #9)
- `lib/toast.ts` — added `panel.deleteError` (PR #9)

**Commits:**
- `e8f8029` — fix(calculators): replace plain numeric inputs with NumberInput [PR #8, merged `2c32adf`]
- `0d395f5` — fix(panels): emit dataRefreshEvents on CRUD so peer hooks refresh [PR #9]
- `545ef2e` — fix(panels): cascade-delete dependent feeders to avoid CHECK conflict [PR #9, merged `2ec1079`]

**PRs**: #8 (merged), #9 (merged)

**Pending / Follow-ups:**
- Same subscribe/emit asymmetry exists in `useCircuits.ts` / `useMeters.ts` / `useMeterStacks.ts` — candidate for the same one-line fix per CRUD function if a repro surfaces.
- Transient "Add Panel button does nothing" report during Bug 2 diagnosis was self-resolved by user: Zod panelSchema rejects `bus_rating < 100`, and `showValidationErrors` uses `alert()` which browsers suppress after repeated dismissals. User confirmed 100A works and said no code change needed.

---

### Session: 2026-04-18 (PM) — Stripe Webhook Signature Alignment + Dual-Endpoint Cleanup

**Focus**: Close the long-standing "Stripe webhook secret hardcoded in deployed function" carry-over. Root-cause why the env-var approach had failed and re-align deployed source with git so future redeploys don't silently re-break signature verification.
**Status**: ✅ Resolved. `stripe-webhook` v38 is live, env-var based, `verify_jwt: false`. Positive + negative HMAC probes both confirmed. PR #6 open.

**Work Done:**

*Root cause of the drift:*
- Deployed function was at v35 with signing secret hardcoded as `whsec_P0LA...`. Git source was already env-var based (`Deno.env.get('STRIPE_WEBHOOK_SECRET')`) — the hardcode was a workaround never committed back.
- Checked stored `STRIPE_WEBHOOK_SECRET` Supabase secret digest: `ab59c2b1...`. Computed `sha256sum` of the known-working hardcoded value: `1f72f3f6...`. Digests didn't match — so the stored env var was simply wrong, not some Supabase bug as the old memory claimed. That's why the original "env var failed, hardcode works" theory looked real.

*Fix procedure:*
1. Saved the deployed v35 as `.rollback/stripe-webhook-v35.ts` (gitignored — contains live signing secret).
2. Overwrote the Supabase env var: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_P0LA... --project-ref ioarszhzltpisxsxrsgl`. New digest `1f72f3f6...` matched. Proved Supabase uses plain SHA-256 (not salted) for digest display.
3. Redeployed git source: `supabase functions deploy stripe-webhook --no-verify-jwt --project-ref ioarszhzltpisxsxrsgl`. First attempt produced v37 with `verify_jwt: true` (CLI defaults to JWT-on) — would have 401'd every Stripe event at the gateway. Re-ran with the flag → v38, `verify_jwt: false`.

*Verification via direct HMAC probes (no Stripe dashboard needed):*
- Valid signed POST (HMAC-SHA256 of `{timestamp}.{body}` with signing secret) → `200 {"received":true}` ✓
- Forged signature → `400 "No signatures found matching the expected signature..."` ✓ (Stripe library's canonical error, proves verification is executing, not bypassed)
- Gateway accepted both (no `401 UNAUTHORIZED_NO_AUTH_HEADER`), confirming `verify_jwt: false`

*Duplicate webhook endpoint discovered + neutralized:*
- Stripe account had TWO live endpoints pointed at the same URL: `we_1TL9gpBBy9cD3s46mfHz0owG` (the intended one, 6 events) and `we_1TKnPTBBy9cD3s46is2owYNA` ("adventurous-splendor", 7 events, 35/35 failure rate this week).
- Endpoint B's signing secret was never in our env var — hence its 100% failure. Only unique event: `customer.subscription.paused`, which is already caught transitively by `customer.subscription.updated`, so disabling is zero-coverage-loss.
- User **disabled** (not deleted) endpoint B — safe rollback path preserved.

**Key Files Touched:**
- `.gitignore` — added `.rollback/` to prevent committing the v35 snapshot
- `.rollback/stripe-webhook-v35.ts` — v35 snapshot (gitignored, contains live signing secret)
- `docs/SESSION_LOG.md`, `docs/CHANGELOG.md` — updated
- `memory/stripe_webhook_signature.md` — rewritten: resolved, rotation playbook, duplicate-endpoint gotcha

**Commits (branch `fix/stripe-webhook-env-secret`):**
- `e15c297` — fix(stripe-webhook): verify deployed function matches git (env-var-based sig verification)

**PR**: #6 — https://github.com/augustov58/sparkplan/pull/6 (open, awaiting merge)

**Pending:**
- Merge PR #6
- First real Stripe event in live traffic is the final belt-and-suspenders confirmation (watch for 200 in edge-function logs next subscription/invoice event)
- **Recommended hygiene**: rotate signing secret via Stripe dashboard "Roll signing secret" — invalidates the value that's been shared through conversation history and the `.rollback/` snapshot. Follow steps 3-5 in `memory/stripe_webhook_signature.md`.
- Consider deleting endpoint B (`adventurous-splendor`) once a real event has passed through endpoint A cleanly

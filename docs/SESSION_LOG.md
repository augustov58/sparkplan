# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-04-20

---

### Session: 2026-04-20 — Spark Copilot Chatbot Refresh (Rebrand + Harvey-Theme Re-skin + UX Pass)

**Focus**: The floating chatbot in the bottom-right corner still wore the old "NEC Pro" / electric-yellow skin — dark-gray gradient header, yellow bubbles, "NEC Copilot" title, sans-serif, `rounded-lg` — while the rest of the app had already moved to the Harvey-inspired theme (forest green `#2d3b2d` primary, gold accent, cream paper, serif headings, `rounded-xl`). User asked to adapt it to current design and bundle any technical improvements I'd recommend.
**Status**: ✅ Shipped on branch `fix/chatbot-design-refresh`. `npm run build` clean in 4.4s, `npm test` 124/124 pass. Browser verification deferred to user (see "Not Verified").

**Work Done (all in `App.tsx` `NecAssistant`, plus a small rename sweep):**

*Rebrand — "NEC Copilot" → "Spark Copilot":*
- `App.tsx` chatbot title + FAB aria/title; `components/Layout.tsx` x2 comments; `docs/AI_CHATBOT_TOOLS.md` heading+body; `PROJECT_SPEC.md` L129.
- Stale "check the AI Copilot sidebar" strings (the sidebar was removed last sprint but these pointers were never updated) rewritten to "Open Spark Copilot (bottom-right)": `components/Calculators.tsx` (2 sites), `components/SiteVisitManager.tsx`, `components/RFIManager.tsx`, `components/TestAgentButton.tsx`, `components/InspectorMode.tsx`.

*Design re-skin (tokens from `index.css:7-81`, not hardcoded hex):*
- Header: `bg-gradient-to-r from-gray-900 to-gray-800` → solid `bg-[var(--color-primary)]`, serif title, gold `Sparkles` icon (`--color-accent-300`).
- Project context badge: yellow-on-black pill → `bg-[var(--color-accent-100)] text-[var(--color-accent-700)]`, uppercase + tighter tracking to match the Harvey `.badge` style.
- User message bubbles: electric-yellow gradient → `bg-[var(--color-primary)] text-white`.
- AI avatar: yellow `Bot` → neutral white-ringed `Sparkles` in primary green.
- Send button: `bg-gray-900` → `bg-[var(--color-primary)]` / `--color-primary-hover`.
- Input focus: electric-500 ring → primary ring @ 15% alpha, matching the global `input:focus` style in `index.css:241-245`.
- Corners: `rounded-lg` → `rounded-xl` everywhere (panel, bubbles, errors) to match `.card`.
- Messages bg: `bg-gray-50` → `bg-[var(--color-paper)]` (#faf9f7).
- Borders: `border-gray-200` → `border-[var(--color-border)]`.
- FAB: dark-gray → `bg-[var(--color-primary)]` with gold `Sparkles`. Unread-count badge now uses `--color-accent-500` on white instead of yellow-on-black.
- `Bot` icon import removed entirely (replaced with `Sparkles` for a consistent brand mark).

*Technical improvements (bundled per user's ask):*
- **Persist conversation to `localStorage`** keyed by `projectId` (or `'global'` when outside a project). Hydrates on mount, rewrites on every history change, clears the key when history is emptied. Re-hydrates when `projectId` changes (navigating between projects swaps conversations).
- **Clear button** (`Trash2` in header, disabled when empty) with a `window.confirm` gate.
- **Stop/abort via generation-id pattern.** Each `handleAsk` assigns a `nanoid` to `generationIdRef`. Clicking Stop nulls the ref; when the Gemini reply returns, the handler checks whether the ref still matches and discards the response otherwise. `askNecAssistantWithTools` doesn't accept an `AbortSignal` today — threading one through would require changes to `services/geminiService.ts` `callGeminiProxyWithTools` + `callGeminiProxyWithToolResult` and the Supabase edge function. Left as a follow-up; this pattern gives the perceived-stop UX without that plumbing.
- **Error as state, not message.** Previously an "I encountered an error" bubble was pushed into the history; now errors live in a separate `errorMessage` state and render a distinct red-bordered card with a **Retry** button that removes the orphaned last user message from history and re-sends it. Keeps conversation history clean across failures.
- **Accessibility:** `role="dialog"`, `aria-label="Spark Copilot"`, `aria-live="polite"` + `aria-busy={loading}` on the messages region, **Esc to close** via window keydown, auto-focus on textarea ~120ms after open (animation delay).
- **`Cmd/Ctrl+K` global toggle.** Listener attached to `window.keydown`; shown as a kbd hint below the input so discoverability doesn't rely on memory.
- **Textarea instead of input.** Auto-grows up to 120px (~5 lines), `Enter` sends, `Shift+Enter` newline. Placeholder updated to document the shortcut.
- **Upsell FAB** for users without `ai-copilot` feature. Previous behavior was `return null` (silent). Now a locked FAB with `Lock` badge navigates to `/pricing` on click. Hover tooltip explains the gate.
- **Dedupe copy button.** The AI bubble had two copy buttons (absolute-positioned in the bubble + inline below the timestamp). Kept the absolute one; deleted the inline duplicate.
- **Wired `processNecReferences`.** This function was dead code in the original — declared but never invoked, and contained an unused `articleNum` var. Renamed to `linkNecReferences`, removed the unused var, and applied it to `msg.text` before passing to ReactMarkdown. AI responses mentioning "NEC 220.42" or "Article 250" now render as clickable links. Kept (not deleted) per user's request.
- **Tool-use disclosure.** The purple pill showing `toolUsed.name` is now a button; clicking expands a `<pre>` with `JSON.stringify(result, null, 2).slice(0, 2000)` beneath the message. Helps users trust/debug what the agent actually did.
- **Timestamp auto-refresh.** Previously `"2m ago"` was computed once and never re-rendered. Added a `setInterval(60_000)` that bumps a throwaway state while the panel is open and non-empty.

*Not modified:*
- `components/AICopilotSidebar.tsx` — still in the tree but no longer rendered (removed from `Layout.tsx` in a previous sprint). Decided against deletion in this PR to keep scope tight; separate cleanup task.
- `services/geminiService.ts` — streaming + real `AbortSignal` plumbing is a bigger change that deserves its own PR.
- `components/Auth/Signup.tsx` + `components/LandingPage.tsx` — still say "AI Copilot" in marketing feature-list copy. Those refer to a feature category, not the chatbot's branded name, so left as-is. Easy to change later if desired.

**Not Verified (flagged for user):**
- Did **not** run the chatbot in a live browser — the CLI harness has no browser driver hooked up for this session. Build + typecheck + unit tests are all green, but the CLAUDE.md "UI protocol" rule about dev-server + golden-path clicks was not satisfied. Please eyeball:
  - Open/close FAB animation and color
  - Header look + all four header icons (clear / maximize / close / + clear gated to disabled when empty)
  - User-message (green) vs AI-message (white) contrast
  - `Cmd+K` toggle from anywhere in the app
  - Error path: disconnect network, ask a question, click Retry
  - Persistence: refresh page mid-conversation, history should survive

**Key Files Touched:**
- `App.tsx` — `NecAssistant` component rewritten (L283-688 → ~L283-?); `Bot` import removed, `Trash2 Square RotateCw Lock ChevronDown ChevronRight useRef` added.
- `components/Layout.tsx` — comment rename
- `components/Calculators.tsx`, `components/SiteVisitManager.tsx`, `components/RFIManager.tsx`, `components/TestAgentButton.tsx`, `components/InspectorMode.tsx` — stale "AI Copilot sidebar" strings redirected to Spark Copilot
- `docs/AI_CHATBOT_TOOLS.md`, `PROJECT_SPEC.md` — title rename
- `docs/SESSION_LOG.md`, `docs/CHANGELOG.md` — this entry

**Commits (branch `fix/chatbot-design-refresh`):** TBD — commit pending user review of the diff.

**Pending:**
- Open PR.
- Follow-up PR for streaming responses + real AbortSignal through `services/geminiService.ts`.
- Optional: delete `components/AICopilotSidebar.tsx` (now unreferenced) in a cleanup PR.

---

### Session: 2026-04-19 — `/circuits` Bug Sweep: Number Inputs + Panel CRUD Cross-Component Refresh + Cascade-Delete + Hierarchy-Delete Safety

**Focus**: Four user-reported bugs all surfacing on `/circuits`:
1. Every controlled `<input type="number">` retained a leading "0" after clear-and-retype (typed `3` → `03`, typed `36` → `036`).
2. A newly created panel did not appear in FeederManager's Destination Panel dropdown until page refresh, even though it was visible elsewhere on the page.
3. Deleting a panel that was referenced by any feeder returned a 400 and a misleading "Failed to update panel" toast.
4. Deleting a mid-tree panel (e.g. L1) silently orphaned its downstream panels: they stayed in the DB with `fed_from=null` (passes `panels_fed_from_check`) but dropped off the tree-layout SVG. Same latent 400 existed for transformer deletes (feeder CHECK conflict).
**Status**: ✅ All four fixed, verified live by user. PRs #8, #9, #10 merged to main.

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

*Bug 4 — Mid-tree delete orphaning + latent transformer-delete 400 (PR #10, commits `45b253b`, `f58c054`):*
- Surfaced while testing PR #9: deleting L1 correctly cascaded the feeders, but LP (fed from L1) survived in the DB with `fed_from` nulled out. The `panels_fed_from_check` is loose — it only requires `fed_from IS NOT NULL OR is_main=true` — so LP passed. The tree-layout SVG only renders panels reachable from the MDP via `fed_from`, so LP disappeared from the diagram but remained in the Panel Schedule list. Confusing state; user could never re-parent from the UI.
- Examined the full FK cascade map (`panels → {panels, transformers, circuits, meters, short_circuit_calculations, feeders}` plus transformer/meter-stack parents). Direct children under `panels.fed_from` and `transformers.fed_from_panel_id` are the orphan sources.
- Discovered transformer delete had the **exact same** 400 bug as pre-PR-9 panel delete: `feeders.source_transformer_id` / `destination_transformer_id` are ON DELETE SET NULL, same CHECK violation — no one had reported it because transformer-as-feeder-endpoint is less common in the current sample data.
- Fix (app-level guard + symmetric cascade):
  - New `services/equipmentDependencies.ts` pure helper: `getPanelDownstream(id, {panels, transformers})`, `getTransformerDownstream(id, {panels})`, `getMeterStackDownstream(id, {panels})`, `formatDependencyMessage(name, deps)`. No Supabase imports — can be unit-tested and reused by chatbot-tool guards or permit-packet validation later.
  - `OneLineDiagram.removePanel` (line ~983): added pre-delete `getPanelDownstream` check; aborts with formatted alert if any child panels or child transformers exist.
  - `OneLineDiagram.removeTransformer` (line ~1655): replaced ad-hoc inline check with the shared helper; also added a feeder-count warning to the confirm dialog (mirrors `removePanel` UX, which was missing previously).
  - `useTransformers.deleteTransformer`: pre-cascade feeders on `source_transformer_id` / `destination_transformer_id` before deleting the transformer, then dispatch `feeder-data-updated`. Added `toast.transformer.deleteError`.
- Considered and rejected: tightening `panels_fed_from_check` to forbid `fed_from=null` when `is_main=false` (would require a DB migration + manual data cleanup for any existing orphans); DB-level ON DELETE RESTRICT (would give the user a Postgres error instead of a friendly list). The app-level guard gives the clearest UX and requires no schema change.
- `useMeterStacks.deleteMeterStack` was examined — it exists in the hook but has **no UI caller** (nothing invokes it from OneLineDiagram or MeterStackManager). Left alone; if a caller is added later, the `getMeterStackDownstream` helper is already wired in `equipmentDependencies.ts`.

**Key Files Touched:**
- `components/DwellingLoadCalculator.tsx`, `components/Calculators.tsx` — NumberInput migration (PR #8)
- `hooks/usePanels.ts` — emits `'panels'` on CRUD; cascade-deletes feeders in `deletePanel` (PR #9)
- `hooks/useTransformers.ts` — cascade-deletes feeders in `deleteTransformer`; dispatches `feeder-data-updated` (PR #10)
- `components/OneLineDiagram.tsx` — `removePanel` warns about feeder cascade count (PR #9); `removePanel` + `removeTransformer` now block mid-tree deletes via shared helper (PR #10)
- `services/equipmentDependencies.ts` — new pure helper for downstream-dependency lookup (PR #10)
- `lib/toast.ts` — added `panel.deleteError` (PR #9) and `transformer.deleteError` (PR #10)

**Commits:**
- `e8f8029` — fix(calculators): replace plain numeric inputs with NumberInput [PR #8, merged `2c32adf`]
- `0d395f5` — fix(panels): emit dataRefreshEvents on CRUD so peer hooks refresh [PR #9]
- `545ef2e` — fix(panels): cascade-delete dependent feeders to avoid CHECK conflict [PR #9, merged `2ec1079`]
- `45b253b` — feat(diagram): block mid-tree panel/transformer deletes with downstream alert [PR #10]
- `f58c054` — fix(transformers): cascade-delete dependent feeders to avoid CHECK conflict [PR #10, merged `0e55790`]

**PRs**: #8 (merged), #9 (merged), #10 (merged)

**Pending / Follow-ups:**
- Same subscribe/emit asymmetry exists in `useCircuits.ts` / `useMeters.ts` / `useMeterStacks.ts` — candidate for the same one-line fix per CRUD function if a repro surfaces.
- `useMeterStacks.deleteMeterStack` exists but has no UI caller. If one is added (e.g., from MeterStackManager), apply the same `getMeterStackDownstream` guard that `removePanel` / `removeTransformer` now use.
- Transient "Add Panel button does nothing" report during Bug 2 diagnosis was self-resolved by user: Zod panelSchema rejects `bus_rating < 100`, and `showValidationErrors` uses `alert()` which browsers suppress after repeated dismissals. User confirmed 100A works and said no code change needed.

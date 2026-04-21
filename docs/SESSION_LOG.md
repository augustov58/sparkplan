# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-04-21

---

### Session: 2026-04-21 — Panel Photo Upload: OCR Refresh + `num_spaces` Overflow Fixes

**Focus**: Three sequential user bug reports, all converging on the panel photo upload surface:
1. Upload itself was failing with an opaque "Edge Function returned a non-2xx status code" error.
2. After fixing the upload, circuits extracted beyond the panel's slot count were silently orphaned in the database (42-circuit photo into a 30-space MDP wrote 12 invisible rows).
3. After exposing `num_spaces` in the UI, the user correctly asked whether the same overflow class of bug existed in the manual Add Circuit and AI chat `add_circuit` paths — it did.

**Status**: ✅ All three shipped in PR #12 (`ccbb55b`), merged to main. `npm run build` clean, 124/124 tests pass across three intermediate commits.

**Root causes:**
1. **OCR failure**: Google sunset `gemini-2.0-flash-exp` (the model the edge function was hardcoded to). Client-side `FunctionsHttpError` swallowed the real response body, masking the `{ error: "model not found" }` payload behind a generic wrapper.
2. **Silent orphans**: `is_main ? 30 : 42` slot-count inference was baked into 6 call sites in 4 files, and the `handlePhotoImport` handler wrote every extracted row to the DB with no bounds check. `maxCircuits={42}` was also hardcoded on the `<PanelPhotoImporter>` prop regardless of panel.
3. **Manual + AI overflow**: `isCircuitSlotAvailable` only checked occupancy, not bounds — a 2-pole at slot 41 on a 42-space panel reported "available" because slot 43 wasn't in the occupied set (it didn't exist). `chatTools.add_circuit` used a naive `maxCircuitNum + 1` with no occupancy scan and no num_spaces awareness.

**Work Done:**

*Commit 1 — `1081f02` fix(panel-ocr):*
- `supabase/functions/gemini-proxy/index.ts` v34: accepts optional `imageMimeType` on request body, falls back to `image/jpeg`. Model: `gemini-2.0-flash-exp` → `gemini-2.5-flash`. Deployed via MCP.
- `services/panelOcrService.ts`: passes `file.type || 'image/jpeg'` through to the edge function; reads `FunctionsHttpError.context.json()` to surface the real error body.
- `components/PanelPhotoImporter.tsx`: passes the File's MIME type as the 4th arg to `extractCircuitsFromPhoto`.

*Commit 2 — `70563d5` fix(panels) num_spaces refactor:*
- Migration `supabase/migrations/20260421_panels_num_spaces.sql`: `ADD COLUMN num_spaces integer` → backfill `is_main ? 30 : 42` → `NOT NULL DEFAULT 42` → `CHECK (num_spaces > 0 AND num_spaces <= 84)`. Applied to prod via MCP (`success: true`).
- `lib/database.types.ts`: added `num_spaces: number` to Row (required) + `num_spaces?: number` to Insert/Update.
- `components/OneLineDiagram.tsx`: new `<select>` dropdowns (12/20/24/30/42/54/66/84) in both the create form (~L2665) and the edit form (~L3220). `isMain` toggle auto-defaults to 30/42 but user can override. Wired through `editingPanel`/`newPanel` state, initial reset state, create payload, update payload, and `startEditPanel`. Replaced the legacy inference at line 1295 (available-slots computation).
- `components/PanelSchedule.tsx`: `totalSlots` derives from `num_spaces`. `maxCircuits={42}` on `<PanelPhotoImporter>` → `maxCircuits={totalSlots}`. `handlePhotoImport` rejects extracted rows whose footprint (`circuit_number + (pole-1)*2`) exceeds `totalSlots`, alerts user with count + skipped numbers.
- `services/pdfExport/PanelScheduleDocuments.tsx`: both `maxSlots` sites (L311, L515) now read `num_spaces` with fallback.
- `services/ai/projectContextBuilder.ts`: `PanelSummary` interface gains `numSpaces`; populated from `panel.num_spaces ?? (panel.is_main ? 30 : 42)`.
- `services/ai/chatTools.ts`: both inference sites (L1257, L1782) replaced via `replace_all`.

*Commit 3 — `67cd0c1` fix(panels): overflow guards:*
- `components/PanelSchedule.tsx`:
  - `isCircuitSlotAvailable`: rejects `slotNumber > totalSlots` (and `circuitNumber < 1`), not just occupancy.
  - `getNextAvailableCircuitNumber`: caps search at `totalSlots`, returns `null` instead of sentinel 101/102.
  - `startAddCircuit`: alerts and aborts if null.
  - `handlePoleChange`: clears `circuitNumber` if the new pole count doesn't fit on the current side.
  - `handleAddCircuit`: alerts and aborts if no slot fits.
- `services/ai/chatTools.ts` `add_circuit`: replaced naive `maxCircuitNum + 1` with the `canFitCircuit`/bounded-scan pattern from `fill_panel_with_test_loads`. Builds occupancy set with multi-pole expansion, scans 1..totalSlots, returns actionable error when full.

**Key Files Touched:**
- `supabase/functions/gemini-proxy/index.ts`, `supabase/migrations/20260421_panels_num_spaces.sql`
- `services/panelOcrService.ts`, `services/ai/chatTools.ts`, `services/ai/projectContextBuilder.ts`, `services/pdfExport/PanelScheduleDocuments.tsx`
- `components/OneLineDiagram.tsx`, `components/PanelSchedule.tsx`, `components/PanelPhotoImporter.tsx`
- `lib/database.types.ts`
- `docs/CHANGELOG.md`, `docs/database-architecture.md`, `docs/SESSION_LOG.md` (this entry)

**Commits (squashed into `ccbb55b` via PR #12):**
- `1081f02` — fix(panel-ocr): replace sunset gemini-2.0-flash-exp + surface real errors
- `70563d5` — fix(panels): add num_spaces column + eliminate 30/42 inference
- `67cd0c1` — fix(panels): bound-check manual + AI add-circuit against num_spaces

**PR:** #12 (merged, branch deleted).

**Pending / Follow-ups:**
- None known for this feature. The `num_spaces` field is now the single source of truth across the UI, DB, PDF export, AI tools, and photo importer.

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


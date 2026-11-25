# The Copilot's Gemini proxy would break on Gemini 3 (#343, #345)

**Problem.** Google reroutes `gemini-2.5-flash` to `gemini-3.5-flash-lite` on 2026-12-01. The Copilot's Edge Function (`supabase/functions/gemini-proxy`) sent tool results as role `'function'` after a bare function call with no thought signature, so every Copilot answer that used a tool would 400 on Gemini 3; the panel photo import's `thinkingBudget: 0` was a 400 on 3.5-flash-lite; RFI PDF extraction asked for `gemini-2.0-flash-exp` (shut down: 400 "not found" today). The change-impact tool declared its loads as bare objects, so Gemini named the fields (`load_type`) and the backend answered 422 (#345).

## Approach
1. **Ask the deployed path, not the docs.** Google's Gemini 3 pages describe the Interactions API; the generateContent details (signature field, response `id`, role, `thinkingLevel` casing) were missing or ambiguous. The deployed proxy still honored a caller's `model`, so the app's own payloads (plain, tools, tool result, `thinkingBudget: 0`, the RFI model) went to `gemini-2.5-flash`, `gemini-3.5-flash-lite` and `gemini-3.8-flash` from the QA browser: a status table in 3 minutes, which found the real breakage (the tool-result role), not the one the issue suspected (sampling parameters: still 200 on both Gemini 3 models).
2. **Make the request shape testable.** The payload building moved to `gemini-proxy/payload.ts` (pure, no Deno), which `tests/geminiProxyPayload343.test.ts` imports; `tsconfig` already type-checks `supabase/functions`.
3. **Replay what the model sent.** The proxy returns the model's function-call part (`modelPart`: `functionCall` with its `id`, plus `thoughtSignature`); the client sends it back unchanged with the tool result; the response goes as role `user` with the call's `id`. A client from before the change gets the documented stand-in signature, so stale tabs keep working.
4. **Test the new function before merge without touching users:** deploy it as a separate function (`gemini-proxy-343`), route the QA browser's `**/functions/v1/gemini-proxy` to it (`context.route` + `route.continue({ url })`), run every acceptance step and the verifier there.
5. **Read the answers, not only the statuses.** The first 200s on Gemini 3 printed raw LaTeX (`$\sqrt{3}$`): the chat renders Markdown only. A rule in every chat instruction (`PLAIN_MATH_RULE`, naming the forbidden syntax) fixed it; a vague "no LaTeX" left one `$$…$$` block.

## Judgment calls
- One model, set in the proxy: callers no longer name one. This also closed a cost hole (any signed-in user could pick any Gemini model on the owner's key); the proxy still has no rate limit (noted, not fixed).
- No math rendering (`remark-math` + KaTeX): new dependencies for a prompt-solvable problem.
- `agent_actions.model_version` still defaults to `'gemini-2.0-flash-exp'` (nothing reads it; changing the default is a prod migration). Left, noted in the issue.
- The Copilot's `check_panel_capacity` tool presents "80 % of the bus" as an NEC continuous limit on connected load: pre-existing, contradicts #193/#225, filed separately.

## Reusable rule
Before switching an LLM model, send the app's real payloads (plain, tools, tool result, every generation option) through the deployed path to the new model and tabulate the statuses, then read a few answers for formatting the UI can't render. A tool parameter that holds objects declares their properties, and `execute` maps what arrives to the backend's shape.

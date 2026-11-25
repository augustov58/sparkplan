# The AI backend crashed on every deploy for 4½ months (#334)

**Problem.** The Python backend on Railway (`VITE_PYTHON_API_URL`) answered every request with HTTP 502 "Application failed to respond". The four AI features (change impact, AI-drafted RFIs, photo analysis, and the Copilot tools that call them) failed with the raw platform response and a "Make sure the Python backend is running at http://localhost:8000" hint. The website was unaffected, so nobody noticed.

## Diagnosis
1. **The deploy record.** Railway posts GitHub deployment statuses (`gh api repos/<repo>/deployments`, then each one's `/statuses`). Every deploy since 2026-07-09 went `in_progress → success → failure` 12–24 s apart. "Success then failure" that fast is a process that starts and dies, not a health-check timeout.
2. **No code change started it.** `backend/` had no commit between 2026-04-24 and 2026-10-22; the first failing deploy (2026-07-09) came 16 days after pydantic-ai-slim 2.0.0 (2026-06-23). `requirements.txt` pinned nothing (`pydantic-ai-slim[google]>=0.0.13`), so every build installed the newest release.
3. **Reproduce the build, not the code.** A clean venv from the file crashed at import: pydantic-ai 2.x rejects `Agent('gemini-2.0-flash-exp')` ("Unknown model"). The versions the code was written against (a venv deleted in `7b92b02`, 2025-12-26) started and `/health` answered 200.
4. **The second fault behind the first.** The agents' model, `gemini-2.0-flash-exp`, was shut down 2025-12-09 (Gemini API changelog). Pinning alone would bring `/health` back with every AI call failing.

## Approach
- Pin every top-level dependency exactly. Stay on pydantic-ai's maintained 1.x line (1.107.10, 2026-11-04) rather than the Dec 2025 1.37.0: a current Gemini model needs Gemini 3 function-calling support. `google-genai` is pinned to the version pydantic-ai's own `uv.lock` uses at that tag (1.70.0), not guessed.
- Model: read Google's deprecations table before choosing. The model first proposed, `gemini-2.5-flash`, turned out to be deprecated (rerouted to `gemini-3.5-flash-lite` on 2026-12-01); the owner chose `gemini-3.8-flash` (no shutdown date). pydantic-ai 1.107 deprecates the `google-gla:` prefix: `google:gemini-3.8-flash` (with `GOOGLE_API_KEY`, it targets generativelanguage.googleapis.com, not Vertex).
- Prove it without a key: a clean install on Python 3.12 and 3.13, `pip check`, `GET /health` → 200 with placeholder settings, and each agent run once with a stand-in Supabase client and a placeholder key. Google answering `400 API key not valid` proves the system prompt, tools and output schema serialize for that model.
- The issue's step 5: `services/api/pythonBackend.ts::backendFetch` turns a network failure, or an error without the backend's own `detail` (a platform page), into "The AI service is unavailable right now…"; the backend's own messages pass through.

## Judgment calls
- The real AI calls are checked on Railway after merge: no Gemini key on the dev machine, and the backend was down anyway, so a failed call isn't a regression.
- Railway's **Healthcheck Path = `/health`** is a dashboard setting (no `railway.json` in the repo): with it, a deploy that crashes at startup never replaces the running one.
- The Copilot's own Gemini path (Edge Function, `gemini-2.5-flash` with `temperature`/`topK`/`topP`) faces the Dec 1 reroute: filed as #343, not folded in (different system).

## Reusable rule
A dependency file that a platform installs on every deploy pins exact versions, and a version bump is tested with a clean install that must start. When a deploy "succeeds" and then fails seconds later, reproduce the build from the dependency file before reading the code. Before choosing an AI model, read the provider's deprecation table; a model that works today may be rerouted next week.

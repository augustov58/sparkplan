# The AI agents took every service as 240 V single-phase (#346)

**Problem.** The backend's inspection prediction described "QA Commercial calc" (stored 208 V, 3-phase) as "120/240V 1-phase". Its service-capacity math (change impact, inspection prediction) used 240 V 1-phase for every project: a 400 A 208 V 3Φ service counted as 96.0 kVA instead of 144.1 kVA (−33 %), a 480 V one −71 %, so commercial projects could be told they need a service upgrade they don't.

## Cause
`backend/tools/database.py::get_service_utilization` read `project.get('voltage') or 240` and `project.get('phases') or 1`; the columns are `service_voltage` and `service_phase`. A missing key returns `None`, `or` supplies the default, nothing fails. Found by the #334 verifier comparing the prediction's wording with the Copilot's.

## Approach
- **Sweep the class, not the instance.** Every `<row>.get('key')` in `backend/` (132 reads, 83 on row variables) checked against the Row columns in `lib/database.types.ts`: 18 keys flagged; 6 were a computed dict (`get_panel_utilization`'s output), 3 `load_va` reads fall back to `load_watts`. The rest were real: projects `voltage`/`phases`/`service_size`/`project_phase`, panels `phases`/`main_breaker_rating`/`panel_type`/`spaces`, feeders `conductor_size`/`length_feet`/`ampacity`, and the predictive agent's `load_va` with no fallback (every panel's load summed to 0).
- Fix the reads: `service_*`, `phase`, `main_breaker_amps`, `num_spaces`, `phase_conductor_size`, `distance_ft`, `is_main` for the panel type; drop `ampacity` (no column). Prompts state the service as stored (`describe_service`, "?" when empty) instead of an invented "200A, 240V, 1-Phase".
- Service rating as the app defines it (#301, `projectServiceRatingAmps`): `service_amps`, else the MDP's main breaker (`service_rating_amps`). The backend's `or 200` ignored the MDP, and every QA project has `service_amps` empty. 200 A now only when neither is set, flagged `service_size_assumed` and said so in the prediction prompt.
- Amps on a 3Φ service: VA ÷ (V × √3) (`_line_amps`), exact √3 as the TypeScript side. Single-phase results unchanged.
- Tests: `backend/tests/test_service_capacity_346.py` (the issue's three services, the EV example and the MDP fallback; 7 fail on main, the 2 single-phase guardrails pass) and `tests/backendColumns346.test.ts`, which CI runs: every `project|panel|feeder|circuit.get('key')` in the backend must be a column.

## Judgment calls
- Folded the other wrong column reads into #346 (same files, same cause): a fix of only the two in the report would have left the prompts and the feeder/panel tools wrong.
- The connected-load sum stays a labelled estimate (#193); a proposed load's amps stay single-phase at the service voltage (the request carries no voltage per load), now stated in a comment.
- No e2e spec: the behavior is backend-only and each check calls Gemini (60–90 s). Verified live in the QA account after deploy instead.

## Reusable rule
`row.get('key') or default` turns a wrong column name into a silent default. When one wrong key turns up, sweep every key read against the schema (and leave a CI test that does it); name a DB row variable after its table so the check can see it.

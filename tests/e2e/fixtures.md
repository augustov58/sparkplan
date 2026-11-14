# QA projects (QA account only)

Named projects in the QA account (`E2E_QA_EMAIL`) that issue acceptance steps and
`tests/e2e/issues/*.spec.ts` refer to by name. The loop may create, edit and
delete these freely; never point a spec at the owner's account.

Add a row when a scenario needs a project none of these covers. No row IDs or
stored settings values here (public repo).

Last updated: 2026-11-13

| Project name | Scenario | Key setup |
|---|---|---|
| QA EVEMS tool (NEC 2023) | EVEMS Load Management tool (#194); EV Charging calculator (#198); EVEMS load schedule (#199) | Blank residential project, NEC Edition = 2023 Edition; the tool keeps its own defaults (200 A / 240 V / 24 kVA demand) |

# Sprint 2C M2 — AHJ Coverage Expansion + Manifest Reuse Flexibility

**Status:** ⏳ IN-FLIGHT 2026-05-16 — 6 PRs open against main (#70–#75); no merges yet
**Hard prerequisites (all met):**
- Sprint 2C M1 engine ✅ (PR #54)
- Sprint 2C M1 4-AHJ manifests ✅ (PR #56)
- Sprint 2B manifest scaffold ✅ (PR #51)

**Inherits from:** Sprint 2C M1 (manifest shape + engine), Sprint 2B (two-layer visibility model)
**Index:** [`docs/sprints/README.md`](./README.md)
**Parent doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](../AHJ_COMPLIANCE_AUDIT_2026-05-04.md)

---

## Why this sprint exists

Sprint 2C M1 shipped the engine + 5 FL pilot AHJs (Orlando, Pompano, Miami-Dade unincorporated, Davie, Hillsborough/Tampa). Two gaps surfaced once that landed:

1. **Coverage gap** — Orlando-metro has 30+ AHJs; we covered 1 (City of Orlando). Same shape at Miami metro (Miami-Dade unincorporated only, missing City of Miami / Beach / Coral Gables / Hialeah) and Tampa Bay (Hillsborough only, missing St. Petersburg / Clearwater). Jacksonville/Duval, the largest single FL market, was entirely untouched. **First commit pass: ~30% of FL metro population served.**
2. **Flexibility gap** — a contractor in an unmodeled city (Winter Park, Sanford, Cape Coral, Lake Mary) could already toggle off the all-on fallback, but they couldn't reuse an existing manifest's defaults without misrepresenting their AHJ on the cover sheet. The two-layer visibility model supported this in code; just no UI.

M2 closes both: **4 new AHJ manifests + 3 UX flexibility gaps**. After M2, every unmodeled FL city is one dropdown click away from a workable packet.

---

## Open work — closed in 6 in-flight PRs

| ID | PR | Branch | What it does |
|---|---|---|---|
| **M2-Orlando-pop** | #70 | `feat/orlando-manifest-requirements` | Populates `data/ahj/orlando.ts::requirements[]` with 17 entries — closes the M1 oversight where Orlando shipped empty while the other 4 AHJs got populated (PR #56 missed Orlando). 28 new tests in `tests/orlandoManifest.test.ts`. |
| **M2-Miami** | #72 | `feat/ahj-city-of-miami` | City of Miami manifest (independent AHJ in MD County, ~440k pop). HVHZ ON. 17 requirements / 44 tests. Includes regression-guard that "Miami-Dade County" jurisdiction strings do NOT route to `city-of-miami`. |
| **M2-OC** | #73 | `feat/ahj-orange-county` | Orange County (unincorporated) manifest. **NOC threshold = $2,500** (LOWER than statewide $5,000). NOT in HVHZ. 15 requirements / 33 tests. |
| **M2-StPete** | #74 | `feat/ahj-st-petersburg` | City of St. Petersburg (Pinellas County). NOT in HVHZ but IS in Wind-Borne Debris Region at 140 mph. 24 requirements / 51 tests. |
| **M2-Jax** | #75 | `feat/ahj-jacksonville-duval` | Consolidated City of Jacksonville / Duval County. NOT in HVHZ. Beaches munis (Jax Beach / Atlantic Beach / Neptune Beach / Baldwin) flagged as separate manifests for follow-up. 25 requirements / 44 tests. |
| **M2-Gaps** | #71 | `feat/manifest-flexibility-gaps` | Closes 3 UX gaps: (1) `manifest_template_id` separation from `jurisdiction_id`; (2) artifact-slot toggle UI; (3) per-project string overrides for `general_notes` / `code_references` / `sheet_id_prefix`. 19 new tests. Backward compat preserved. |

**Coverage after merge**: 9 AHJs registered (up from 5). FL metro population served: ~3.5M (up from ~2.3M). Plus every unmodeled FL city via the manifest-template dropdown.

---

## Architecture

### Manifest-template reuse (Gap 1)

Resolution order in `PermitPacketGenerator.tsx`:

1. `getManifestById(project.settings.manifest_template_id)` — explicit user-picked template (new path)
2. `findManifestForJurisdiction(jurisdictionForManifest)` — derived from jurisdiction (existing path)
3. `null` → fall through to Sprint 2A all-on defaults (existing path)

The UI dropdown sources from `ALL_MANIFESTS` (already exported from `data/ahj/registry.ts`). When set, the AHJ name on the cover sheet still comes from the actual jurisdiction field — the template only affects which sections/slots default ON.

### Artifact-slot toggle UI (Gap 2)

Mirrors the existing section-toggle grid in `PermitPacketGenerator.tsx:927–967`. Writes flow through to `project.settings.section_overrides.artifactTypes.{key}: boolean`. `data/ahj/visibility.ts::applyUserOverrides` already consumed this map — Gap 2 just adds the UI.

### Per-project string overrides (Gap 3)

Three new `projects.settings` keys (jsonb extension, no migration):
- `general_notes_override?: string[]`
- `code_references_override?: string[]`
- `sheet_id_prefix_override?: 'E-' | 'EL-' | 'ES-'`

Resolution chain in both `services/pdfExport/permitPacketGenerator.tsx` full + lightweight paths: `data.X ?? data.XOverride ?? data.manifest?.X`. Mirrors the existing `necEdition` fallback pattern.

### New AHJs — divergences worth noting

- **Orange County's $2,500 NOC threshold** — lower than FL Statute 713.13's $5,000 default. Manifest's NOC predicate defaults ON for ALL building types (not just non-SFR like Orlando/Miami-Dade).
- **City of Miami substring collision risk** — `findManifestForJurisdiction` uses case-insensitive substring matching. "Miami-Dade County" haystacks would collide on "miami" if registered names overlapped. Mitigated by registry ordering + a regression-guard test in `tests/cityOfMiamiManifest.test.ts`.
- **Jacksonville/Duval consolidated structure** — modeled as `jurisdictionType: 'city'` (city absorbed county functions in 1968). Beaches munis remain independent AHJs and are out-of-scope for this manifest.
- **Wind-Borne Debris Region vs HVHZ distinction** — HVHZ is statutorily Miami-Dade + Broward + Monroe only. Wind-Borne Debris Region is broader (140 mph for Pinellas, etc.). St. Pete manifest keeps `hvhz_anchoring` ON for non-SFR via the statewide H19 Sprint 2C convention; Jax explicitly does NOT include `hvhz_anchoring` in `relevantArtifactTypes` (cleaner than gating with always-false predicate).

---

## Open follow-ups (non-blocking)

- **Beaches munis (Jax)** — 4 standalone manifests OR address-based jurisdiction routing.
- **Pinellas surrounding munis (Clearwater, Largo, Dunedin, St. Pete Beach)** — each independent AHJ.
- **Tier 2 AHJs from coverage audit** — Fort Lauderdale, Miami Beach, Coral Gables, Hialeah, Sanford/Seminole County, Naples/Cape Coral.
- **Research-gap closure phone calls** — 5–10 min each, documented in per-AHJ `docs/ahj-source-checklists/<id>.md` files.
- **Pre-commit hook for conflict markers** — this sprint's merge sequence left an orphan `<<<<<<< HEAD` in `registry.ts` that only surfaced at build time. A `grep -E '^(<<<<<<<|=======|>>>>>>>)' --include='*.{ts,tsx}'` pre-commit check would have caught it.

---

## Cross-references

- **Sprint 2C M1** [`sprint2c-ahj-manifests.md`](./sprint2c-ahj-manifests.md) — engine + 4 AHJ manifests; this sprint extends manifest count + adds the manifest-template-reuse UX layer.
- **Sprint 2B** [`sprint2b-uploads.md`](./sprint2b-uploads.md) — two-layer visibility model + `applyUserOverrides`; Gap 2 leverages the artifact-types branch the model already supported.
- **Sprint 3** [`sprint3-pe-seal.md`](./sprint3-pe-seal.md) — manifest-template reuse does NOT change PE seal gating; each manifest still emits PE-required requirements based on the project's `lane === 'pe_required'` predicate.

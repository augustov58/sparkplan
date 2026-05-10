# Sprint 3 — PE Seal Workflow (PE-as-a-Service Upsell)

**Status:** ⚪ Architecture decided 2026-05-08; not started
**Hard prerequisites:**
- Sprint 2B (`pdf-lib` is also the PAdES signer — same library)
- **Pricing decision settled** (cross-report reconciliation — see "Open pricing question" below)
- **Cert vendor selection** (IdenTrust, GlobalSign, or another FBPE-accepted CA)
- **FBPE business-entity registration** (FS 471.023 — verify whether SparkPlan needs to register before launch)
- **Secret-management ADR** (Supabase Vault vs AWS KMS vs HashiCorp Vault)

**Inherits from:** Sprint 2A H17 lane logic ([`sprint2a-form-factor.md`](./sprint2a-form-factor.md)) — gates whether PE seal upsell is offered; Sprint 2B `pdf-lib` integration ([`sprint2b-uploads.md`](./sprint2b-uploads.md)) — PAdES signing
**Index:** [`docs/sprints/README.md`](./README.md)
**Parent doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](../AHJ_COMPLIANCE_AUDIT_2026-05-04.md)

**Estimated complexity:** Multi-session sprint, 2–4 weeks. Highest unknowns are the prerequisites above, not the code.

---

## Why this sprint exists — and why NOT yet

PE seal is the **moat and the upsell**, not the core product.

**Strategic positioning** (validated 2026-05-08 against Obsidian `SparkPlan Analysis/FL_PILOT_REVISED_REPORT.md` §3.2 + Reconciliation Notes): per `FL_PILOT_REVISED_REPORT.md` §2.2 + §3.1, the dual-path workflow runs on FS 471.003(2)(h):

- **Most EV-installer work falls in the contractor-exemption lane** (residential ≤ 600A @ 240V, commercial ≤ 800A @ 240V, project value ≤ $125,000) — no PE involvement; contractor designs and signs under their own license. This is the high-volume, low-friction path the product must serve well by default.
- **PE seal activates as an upsell** when (a) the AHJ explicitly requires sealed plans (Orlando: *"engineered plans required if 277/480V"*; some Pompano scopes; multi-tenant complexity), (b) project crosses FS 471.003(2)(h) thresholds, or (c) contractor wants the "PE-reviewed" credential as a competitive differentiator on a bid. **Sprint 2A's H17 logic determines which lane fires for each project.**
- **Augusto Valbuena (platform owner, FL-licensed PE) is the PE.** Not a "bring your own PE cert" infrastructure. There is one centralized PE, capacity-bounded by Augusto's review throughput, and the cert lives on the SparkPlan side under strict access controls. This vertical-integration is what `Reconciliation Notes.md` #3 calls *"the strongest moat — can't be easily replicated by national competitors."*

**Why not now:** sealing wrong calculations would compound the problem. C5 is sequenced after the calc engine is correct (Sprint 1 ✅) AND after the upload pipeline exists (Sprint 2B), AND after pricing math is settled. Augusto's license is on the hook for whatever volume the tier promises — don't ship the seal infrastructure until the bundle math is settled.

---

## Open work

### Findings closed by this sprint

| ID | Finding | What it does |
|---|---|---|
| **C5** | No PE seal workflow output anywhere in the packet | Privileged "PE Reviewer" UI for Augusto, server-side PAdES signing on E-### sheet range only, `pe_seals` audit-trail table, capacity-bounded queue with SLA, immutable-revision tamper-evidence |

---

## The 5-step workflow

1. **Contractor configures project + uploads artifacts** → submits for PE review (Business tier feature).
2. **Project enters a `pe_review_queue`** with state `pending_review`. Contractor can no longer mutate the project; further edits create a revision (immutability requirement for tamper-evident sealing).
3. **Augusto sees the queue in a privileged "PE Reviewer" UI** (gated by a `pe_reviewer` role on the user record). For each project he can:
   - **Inspect** all calc outputs, panel schedules, one-line, voltage drop, AIC, EVSE specs, EVEMS narrative, uploaded site plan + cut sheets + fire stopping schedule
   - **Leave review comments** (sticky-note style, attached to specific sheets, separate from the PDF — they don't modify the document and aren't part of the sealed output)
   - **Approve & Seal** — triggers server-side seal application
   - **Request Revision** — returns project to contractor with comments, revision cycle begins, project goes back to `draft` state (new revision ID minted)
4. **Approve & Seal triggers a server-side process** (Supabase Edge Function or Python backend endpoint — never client-side because the cert can't be exposed to the browser):
   - Loads the assembled merged PDF (from Sprint 2B's pipeline)
   - Decrypts Augusto's FBPE-recognized cert from secure key storage (Supabase Vault, AWS KMS, or HashiCorp Vault — TBD which; secret-management ADR required before this sprint)
   - Applies PAdES digital signature to the electrical-engineering sheet range (sheets `E-###` only — see "Why the PE seals only the electrical-engineering sheets" below)
   - Computes hash, embeds signature, locks the PDF tamper-evident
   - Writes audit trail to `pe_seals` table.
5. **Sealed packet archived** to Supabase Storage with the audit trail. Contractor downloads from a `Sealed Documents` tab. Submits to AHJ.

---

## Why the PE seals only the electrical-engineering sheets, not the whole packet

This is a **critical professional-responsibility constraint**. FBPE rules require Augusto to be in **responsible charge** of what he seals — meaning he reviewed and certifies the engineering. Augusto's responsible-charge scope:

- ✅ **Within scope (sealed by Augusto):** load calculations, panel schedules, one-line diagram, voltage drop calculations, AIC / available fault current calculations, equipment specifications (electrical), grounding system, EVSE branch + feeder + service sizing, EVEMS operational narrative, NEC compliance summary, general notes, the PE-required pages.
- ❌ **NOT within scope (not sealed by Augusto):** site plan (architect / civil engineer responsibility, OR contractor signature for residential / multi-family scope), manufacturer cut sheets (manufacturer-stamped), fire stopping schedule (UL-listed-system attestation by manufacturer or contractor), HOA letter (legal), NOC (legal). These ride along in the packet with their own signatures / attestations from the appropriate party — Augusto is not asserting engineering judgment about them.

The merged packet (built in Sprint 2B) has clearly delineated sheet ranges:
- Sheets `E-001` to `E-XXX` → Augusto's PE seal
- Sheets `C-001+` (civil/architectural site plan) → contractor signature OR civil/architect seal (separate professional)
- Sheets `X-001+` (manufacturer-supplied cut sheets, fire stopping) → manufacturer attestation
- All electrical sheets also carry contractor signature (per Sprint 2A C8) — distinct from PE seal, both visible

---

## Implementation requirements

### Cert management (security-critical)

- Augusto holds a recognized digital cert (e.g., from IdenTrust, GlobalSign, or another FBPE-accepted CA).
- Cert + private key stored in encrypted secret vault on the SparkPlan side, **never copied to client**.
- Access is role-based + audit-logged: only the seal-application server process can decrypt, and every decryption event is logged.
- Augusto's "Approve & Seal" UI action is the only trigger; the action requires re-authentication (password OR hardware key OR TOTP) to confirm intent.
- Per-project responsible-charge attestation captured at seal time: Augusto affirms, in a checkbox + free-text field, that he reviewed this specific project + version + scope. Stored verbatim in `pe_seals.attestation_text` for audit trail.

### `pe_seals` table schema

```
id                      uuid primary key
project_id              uuid references projects(id)
project_revision_id     uuid  -- ties seal to a specific immutable revision
pe_user_id              uuid references auth.users(id)  -- which PE applied this seal
signed_at               timestamptz
cert_fingerprint        text
doc_hash                text  -- SHA-256 of the sealed PDF
sealed_pdf_storage_path text
attestation_text        text  -- verbatim Augusto-supplied attestation
```

### Capacity model (business-model — sized against `FL_PILOT_REVISED_REPORT.md` §5)

- **Augusto's realistic review throughput:** ~20–40 projects/week (TBD calibration during pilot — depends on project complexity, residential vs commercial vs multi-family, EVEMS narrative depth, iteration cycles). **Solo-PE bottleneck is the hard ceiling on Sprint 3 monetization.**
- **Business tier inclusion (small allotment, not unlimited):** ~1–2 sealed packets/month included at $149/mo. Inclusion is the marketing hook ("PE seal included"); the per-seal upcharge is the throughput protection.
- **Per-seal upcharge:** ~$99–299 per packet beyond the included allotment. Anchored to alternative cost (contractor hiring outside FL PE: typically $300–500+ per simple EV-retrofit seal).
- **SLA target:** 48–72h turnaround on standard projects; 5–7 days on complex (multi-family + EVEMS + service upgrade combinations). Tightens as Augusto develops repeatable patterns + boilerplate review templates.
- **Queue surface:** contractors see estimated time-to-seal based on current queue depth + Augusto's recent rolling throughput — sets expectations and prevents ticket-system frustration.

### Open pricing question (HARD PREREQUISITE — settle before this sprint starts)

Per cross-report reconciliation, pricing strategy is unsettled:
- Feb `FL_PILOT_REVISED` proposed **$249–599/mo** (premium PE-led)
- April competitive landscape proposed **$29 / $49 / $149** (PLG / undercut Kopperfield's $99.99/mo Commercial Pro)

The audit doc currently aligns with the April $149 Business tier reference. Decision affects PE seal allotment math materially:
- At **April pricing** ($149/mo with 1–2 seals included): Augusto's capacity supports ~50–80 paying Business-tier customers before saturation.
- At **Feb pricing** ($499/mo with 4–6 seals included): Augusto's capacity supports ~20–30 paying customers but with much higher ARPA.

**Decision needed before Sprint 3 launch.** Don't ship the seal infrastructure until the bundle math is settled.

### Liability / legal scaffolding

- **PE service agreement** (separate from contractor terms) covers: scope of Augusto's responsible charge, what is and isn't sealed, contractor's obligations to provide accurate inputs, indemnification structure.
- **Errors-and-omissions insurance** for Augusto's PE practice — separate from SparkPlan corporate liability.
- **FBPE registration:** SparkPlan as a "business entity" offering engineering services may need to register with FBPE (FS 471.023) — verify before launch.
- **FL-only initially;** out-of-state projects require Augusto to be licensed in those states OR additional PEs onboarded later.

### Multi-PE forward path

The architecture is single-PE-by-default but should allow adding additional PEs later (each with their own scope: electrical, civil, structural, or geographic licensure). `pe_users` table with cert references; `pe_seals.pe_user_id` ties seal to the PE who applied it.

---

## NEC references touched in this sprint

None directly — this sprint is the seal workflow, not calc. But the seal *attests* that the calcs (Sprint 1 ✅) and the engineering content (Sprint 2A) comply with the cited NEC articles.

FBPE rules cited:
- **FS 471.003(2)(h)** — contractor exemption thresholds (residential ≤ 600A, commercial ≤ 800A, project value ≤ $125,000).
- **FS 471.023** — business-entity registration requirement for engineering services.

---

## Cross-references

- **Sprint 2A** [`sprint2a-form-factor.md`](./sprint2a-form-factor.md) — H17 lane logic gates whether the PE seal upsell is offered (`lane === 'pe-required'`); C8 contractor block coexists with PE seal on engineered packets (both visible).
- **Sprint 2B** [`sprint2b-uploads.md`](./sprint2b-uploads.md) — `pdf-lib` is the PAdES signer; the merged-packet sheet ranges (`E-###` / `C-###` / `X-###`) are what makes sheet-range scoped sealing possible.
- **Sprint 2C** [`sprint2c-ahj-manifests.md`](./sprint2c-ahj-manifests.md) — 277/480V manifest gate triggers this sprint's workflow.
- **Parent doc references** — Obsidian `SparkPlan Analysis/FL_PILOT_REVISED_REPORT.md` §3.2 (PE seal workflow constraints — FBPE), `SparkPlan Analysis/Reconciliation Notes.md` (cross-validated strategy), `business/STRATEGIC_ANALYSIS.md` (Business tier $149/mo reference, may shift if pricing reconciliation lands at Feb numbers).
- **Memory:** [user-role-pe](../../.claude/projects/-home-augusto-projects-sparkplan/memory/user_role_pe.md) — Augusto IS the PE; SparkPlan offers PE-as-a-service (not BYO-cert); contractor exemption is the default lane, PE seal is the paid upsell.

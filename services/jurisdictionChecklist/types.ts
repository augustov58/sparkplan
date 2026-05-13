/**
 * Sprint 2C M1 — Jurisdiction-checklist engine result types.
 *
 * The engine in `./checklistEngine.ts` consumes a per-AHJ manifest
 * (`AHJManifest.requirements[]`), a packet AST, and the project's
 * attachments; it emits a per-requirement evaluated row plus a summary +
 * audit-trail (warnings + necReferences) wrapper.
 *
 * Pure data shapes — no React, no DB.
 *
 * @module services/jurisdictionChecklist/types
 */

import type { AHJRequirement } from '../../data/ahj/types';

/**
 * Per-requirement severity, derived from the (required, present) pair.
 *
 *   required && present   → 'pass'   (the AHJ wants it, the packet has it)
 *   required && !present  → 'fail'   (blocks AHJ acceptance — must fix)
 *   !required && present  → 'warn'   (optional artifact submitted; fine)
 *   !required && !present → 'na'     (not applicable, render dimmed/N/A)
 *
 * The renderer maps these to the visual symbols ([X] / [ ] / MISSING / N/A).
 */
export type ChecklistSeverity = 'pass' | 'warn' | 'fail' | 'na';

/**
 * One evaluated requirement. Mirrors `AHJRequirement.id / name / category`
 * after evaluation against `(packet, attachments, ctx)`.
 */
export interface ChecklistResultItem {
  /** Stable ID from the source `AHJRequirement.id`. */
  id: string;
  /** Display name for the rendered checklist. */
  name: string;
  /** Coarse grouping for the rendered checklist sections. */
  category: AHJRequirement['category'];
  /** Did `requirement.required(ctx)` say this applies to THIS project? */
  required: boolean;
  /** Did `requirement.detect(packet, attachments)` find the artifact? */
  present: boolean;
  /** Where it's satisfied (sheet ID). `null` when locator absent or NA. */
  location: string | null;
  /** Derived from (required, present) — see {@link ChecklistSeverity}. */
  severity: ChecklistSeverity;
}

/**
 * Headline counters for the engine output. The renderer uses these to
 * stamp a "X / Y required satisfied" banner at the top of the page.
 */
export interface ChecklistSummary {
  /** items.length */
  total: number;
  /** items.filter(i => i.required).length */
  totalRequired: number;
  /** items.filter(i => i.severity === 'pass').length */
  passing: number;
  /** items.filter(i => i.severity === 'fail').length */
  failing: number;
}

/**
 * Final engine output. Follows the calc-service result contract:
 *   - `warnings[]`: informational; never thrown
 *   - `necReferences[]`: audit-trail copy of `manifest.codeReferences`
 *     so the rendered checklist page carries the same code-basis
 *     metadata as the rest of the packet
 *
 * Pure data — safe to JSON-serialize, snapshot-test, or persist.
 */
export interface ChecklistResult {
  /** Per-requirement evaluated rows, in the manifest's declared order. */
  items: ChecklistResultItem[];
  /** Headline counters for the top-of-page banner. */
  summary: ChecklistSummary;
  /**
   * Informational warnings — predicate throws, missing-locator errors,
   * etc. Never blocking. Follows the calc-service contract: the renderer
   * decides how to surface these (typically a small footnote block).
   */
  warnings: string[];
  /**
   * Audit-trail copy of the source manifest's code references. The
   * checklist page can stamp these alongside the per-AHJ checklist so
   * the reviewer sees what code basis the engine evaluated against.
   */
  necReferences: string[];
}

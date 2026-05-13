/**
 * Sprint 2C M1 — Jurisdiction-checklist engine.
 *
 * Pure function that walks an AHJ manifest's `requirements[]`, evaluates
 * each requirement's `required(ctx)` + `detect(packet, attachments)` +
 * optional `locator(packet)` predicates, and emits an audited
 * {@link ChecklistResult} the renderer consumes verbatim.
 *
 * Contract (per CLAUDE.md "Calculation Service Rules"):
 *   - Pure: no DB / no React / no I/O / no side effects.
 *   - Never throws: predicate throws are caught and rolled into
 *     `warnings[]`, item is downgraded to severity:'na' rather than
 *     crashing the packet render.
 *   - Result shape includes `warnings[]` + `necReferences[]` (audit trail).
 *   - Empty `manifest.requirements` is a valid input — engine returns an
 *     empty `items: []` + zeroed summary with no warnings (Orlando's
 *     state on PR #51).
 *
 * @module services/jurisdictionChecklist/checklistEngine
 */

import type {
  AHJContext,
  AHJManifest,
  AHJRequirement,
  AttachmentSummary,
  PacketAST,
} from '../../data/ahj/types';
import type {
  ChecklistResult,
  ChecklistResultItem,
  ChecklistSeverity,
  ChecklistSummary,
} from './types';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Derive the (required, present) → severity mapping. Centralized so the
 * renderer + tests agree on a single source of truth.
 */
function deriveSeverity(required: boolean, present: boolean): ChecklistSeverity {
  if (required && present) return 'pass';
  if (required && !present) return 'fail';
  if (!required && present) return 'warn';
  return 'na';
}

/**
 * Safely invoke a manifest-supplied predicate. Predicates are user-supplied
 * data so a malformed manifest must not take down packet generation; any
 * throw is converted into a `warnings[]` entry and a conservative fallback
 * value (defaultOnThrow) is returned. The caller decides what the
 * "conservative" answer is for each predicate.
 */
function safeInvoke<T>(
  fn: () => T,
  defaultOnThrow: T,
  warnings: string[],
  context: string,
): T {
  try {
    return fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`${context}: predicate threw (${msg}) — treating as N/A`);
    return defaultOnThrow;
  }
}

/**
 * Evaluate a single requirement against the (packet, attachments, ctx)
 * triple. Always returns a result row — predicate throws are caught and
 * rolled into the shared `warnings[]`.
 */
function evaluateRequirement(
  req: AHJRequirement,
  packet: PacketAST,
  attachments: AttachmentSummary[],
  ctx: AHJContext,
  warnings: string[],
): ChecklistResultItem {
  // `required(ctx)` is the first gate. On predicate throw, conservatively
  // treat as NOT required so the item degrades to 'na' rather than 'fail'
  // (failing on a malformed manifest would block legitimate packets).
  const required = safeInvoke(
    () => req.required(ctx) === true,
    false,
    warnings,
    `requirement '${req.id}'.required`,
  );

  // `detect(packet, attachments)` is the second gate. On throw, treat as
  // NOT present — combined with required-false-on-throw above, the item
  // lands in severity:'na' which the renderer hides or dims.
  const present = safeInvoke(
    () => req.detect(packet, attachments) === true,
    false,
    warnings,
    `requirement '${req.id}'.detect`,
  );

  // `locator(packet)` is optional. On throw OR when not supplied, the
  // location is `null` — the renderer simply omits the "see X-NNN" link.
  let location: string | null = null;
  if (typeof req.locator === 'function') {
    location = safeInvoke(
      () => {
        const raw = req.locator!(packet);
        return typeof raw === 'string' && raw.trim().length > 0 ? raw : null;
      },
      null,
      warnings,
      `requirement '${req.id}'.locator`,
    );
  }

  return {
    id: req.id,
    name: req.name,
    category: req.category,
    required,
    present,
    location,
    severity: deriveSeverity(required, present),
  };
}

/**
 * Tally headline counters over the evaluated items.
 */
function buildSummary(items: ChecklistResultItem[]): ChecklistSummary {
  let totalRequired = 0;
  let passing = 0;
  let failing = 0;
  for (const item of items) {
    if (item.required) totalRequired += 1;
    if (item.severity === 'pass') passing += 1;
    if (item.severity === 'fail') failing += 1;
  }
  return {
    total: items.length,
    totalRequired,
    passing,
    failing,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Evaluate a packet against an AHJ manifest's requirements list.
 *
 * Pure function. Never throws — bad inputs surface as `warnings[]`, the
 * item degrades to severity:'na', and rendering proceeds.
 *
 * @param packet      Read-only packet AST (sheet IDs + section keys).
 * @param attachments Project's uploaded artifacts (artifactType + sheetId).
 * @param manifest    The active AHJ manifest. `manifest.requirements` may
 *                    be empty (e.g., Orlando on PR #51) — returns
 *                    `items: []`, zeroed summary, no warnings.
 * @param ctx         Per-project AHJContext (scope / lane / buildingType
 *                    / subjurisdiction). Threaded to `requirement.required`.
 * @returns           Audited {@link ChecklistResult} the renderer consumes.
 */
export function evaluatePacket(
  packet: PacketAST,
  attachments: AttachmentSummary[],
  manifest: AHJManifest,
  ctx: AHJContext,
): ChecklistResult {
  const warnings: string[] = [];

  // Defensive: the engine is part of the calc-service contract, so we
  // can't trust callers to honor TS-only invariants. A `null`/`undefined`
  // manifest.requirements is treated as empty so the rest of the packet
  // still renders. We do NOT push a warning here — it's a valid empty
  // state (e.g., PR #51 Orlando).
  const requirements = Array.isArray(manifest?.requirements)
    ? manifest.requirements
    : [];

  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  const safePacket: PacketAST = packet ?? {};

  const items: ChecklistResultItem[] = requirements.map((req) =>
    evaluateRequirement(req, safePacket, safeAttachments, ctx, warnings),
  );

  // Audit-trail copy. The renderer can stamp these alongside the
  // per-AHJ checklist so reviewers see the code basis the engine
  // evaluated against. Defensive: tolerate a manifest with no
  // codeReferences[] (TS shape guarantees it, but the engine is the
  // boundary, not a user-trusted source).
  const necReferences = Array.isArray(manifest?.codeReferences)
    ? [...manifest.codeReferences]
    : [];

  return {
    items,
    summary: buildSummary(items),
    warnings,
    necReferences,
  };
}

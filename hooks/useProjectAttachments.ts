/**
 * Project Attachments Data Management Hook (Sprint 2B PR-2)
 *
 * Provides CRUD operations for user-supplied PDF artifacts that the permit-
 * packet generator splices into the composed packet (site plans, cut sheets,
 * fire stopping schedules, NOC, HOA letters, surveys, manufacturer data).
 *
 * @module hooks/useProjectAttachments
 *
 * ## Architecture Pattern
 *
 * Same Optimistic-UI + Real-Time Sync pattern as `usePanels`, `useCircuits`,
 * etc. (see CLAUDE.md "Hooks Pattern"):
 * 1. Optimistic update: local state mutated immediately
 * 2. Async Supabase op (Storage upload + DB row insert)
 * 3. Realtime subscription overwrites optimistic state with server truth
 *
 * ## Storage layout
 *
 * Bucket: `permit-attachments` (private)
 * Path:   `{user_id}/{project_id}/{artifact_type}/{timestamp}_{filename}.pdf`
 *
 * RLS on `storage.objects` enforces `auth.uid()::text = foldername[1]` — i.e.
 * users can only see / write objects under their own UID prefix. The DB
 * `project_attachments` table mirrors this with `auth.uid() = user_id` RLS.
 *
 * Because RLS is global, we **never** pass user_id manually from callers —
 * the hook fetches it once from `supabase.auth.getUser()` for the storage
 * path; the DB insert relies on `auth.uid()` via RLS.
 *
 * ## Page counting
 *
 * The hook uses `pdf-lib` to count pages on the file BEFORE uploading. This
 * is cached on `project_attachments.page_count` so PR-3's merge engine can
 * pre-allocate sheet IDs without re-parsing every PDF on every packet build.
 */

import { useState, useEffect, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { showToast, toastMessages } from '@/lib/toast';
import { dataRefreshEvents } from '@/lib/dataRefreshEvents';

type ProjectAttachment = Database['public']['Tables']['project_attachments']['Row'];

/**
 * Allowed artifact_type values. Mirrors the CHECK constraint in
 * `20260512_project_attachments.sql` + `20260513_attachment_hvhz_anchoring.sql`
 * + `20260514_attachment_types_pr4.sql`.
 *
 * Sprint 2B PR-3 added `hvhz_anchoring` (Sprint 2C H19) — FL Product Approval
 * / MD-NOA tie-down / signed-sealed structural for outdoor pedestal/bollard
 * EVSE statewide.
 *
 * Sprint 2B PR-4 added 6 more (H21/H22/H25/H26/H30/H33) for Sprint 2C
 * per-AHJ manifests (Pompano / Davie / Hillsborough). The Orlando manifest
 * does NOT list these in its relevantArtifactTypes — they exist at the
 * DB+UI layer so Sprint 2C M1 can route them via per-AHJ visibility
 * predicates without another schema migration.
 */
export type ArtifactType =
  // PR-1 originals
  | 'site_plan'
  | 'cut_sheet'
  | 'fire_stopping'
  | 'noc'
  | 'hoa_letter'
  | 'survey'
  | 'manufacturer_data'
  // PR-3 (H19 statewide HVHZ)
  | 'hvhz_anchoring'
  // PR-4 (Sprint 2C AHJ manifests — Pompano / Davie / Hillsborough)
  | 'zoning_application'
  | 'fire_review_application'
  | 'notarized_addendum'
  | 'property_ownership_search'
  | 'flood_elevation_certificate'
  | 'private_provider_documentation';

/**
 * 3-mode cover behavior (v4 commit 12). Replaces the boolean
 * include_sparkplan_cover column from PR-3 commit 7.
 *
 * - 'separate' (default): SparkPlan title sheet as its own page
 *    preceding the upload. AHJ-canonical layout for legal docs,
 *    cut sheets, NOC, HOA.
 * - 'overlay': SparkPlan title block composited onto the upload
 *    page itself. One sheet, not two — designed for bare drawings
 *    (Bluebeam markups, Google Earth printouts) that have no
 *    existing title block.
 * - 'none': upload appended as-is, no SparkPlan ceremony, no
 *    stamping. For uploads that already carry a complete architect
 *    title block (e.g., HOK A100).
 */
export type CoverMode = 'separate' | 'overlay' | 'none';

export const COVER_MODES: readonly CoverMode[] = [
  'separate',
  'overlay',
  'none',
] as const;

export const ARTIFACT_TYPES: readonly ArtifactType[] = [
  'site_plan',
  'cut_sheet',
  'fire_stopping',
  'noc',
  'hoa_letter',
  'survey',
  'manufacturer_data',
  'hvhz_anchoring',
  'zoning_application',
  'fire_review_application',
  'notarized_addendum',
  'property_ownership_search',
  'flood_elevation_certificate',
  'private_provider_documentation',
] as const;

const STORAGE_BUCKET = 'permit-attachments';

/**
 * Parameters for {@link UseProjectAttachmentsReturn.upload}.
 */
export interface UploadAttachmentInput {
  file: File;
  artifactType: ArtifactType;
  displayTitle: string;
}

export interface UseProjectAttachmentsReturn {
  /** All attachments for the current project, newest first. */
  attachments: ProjectAttachment[];

  /** True during initial fetch, false once data loaded. */
  loading: boolean;

  /** Most recent error message from any operation, null otherwise. */
  error: string | null;

  /**
   * Uploads a file to Supabase Storage and inserts a matching DB row.
   *
   * - Reads the PDF page count via pdf-lib BEFORE upload.
   * - Storage path: `{user_id}/{project_id}/{artifact_type}/{timestamp}_{filename}`.
   * - On Storage failure: nothing is inserted in the DB; error surfaces.
   * - On DB insert failure (e.g., RLS): the Storage object is deleted to
   *   prevent orphans.
   */
  upload: (input: UploadAttachmentInput) => Promise<ProjectAttachment | null>;

  /**
   * Deletes an attachment (storage object + DB row).
   *
   * - Storage delete first; if it fails, the DB row is preserved.
   * - If Storage succeeds but DB delete fails, a warning toast surfaces — the
   *   DB row will be cleaned up by the next subscription refetch (no orphan
   *   on the storage side; the DB row points to a now-missing object until
   *   the user retries delete).
   */
  remove: (attachmentId: string) => Promise<void>;

  /**
   * Update the `cover_mode` enum on an attachment (Sprint 2B PR-3 v4).
   *
   * - `separate` (default): SparkPlan title sheet as its OWN page
   *   preceding the upload. Current cover-ON behavior.
   * - `overlay`: SparkPlan title block composited ONTO the upload
   *   page itself. One sheet, not two — for bare drawings (Bluebeam
   *   markups, Google Earth printouts) without their own title block.
   * - `none`: upload appended as-is, no SparkPlan ceremony, no
   *   stamping. For pre-bordered drawings with their own architect
   *   title block.
   *
   * Optimistic update + realtime broadcast — same pattern as `upload` /
   * `remove`. Surfaces a toast on failure; never throws.
   */
  updateCoverMode: (
    attachmentId: string,
    mode: CoverMode,
  ) => Promise<void>;

  /**
   * Update the `custom_sheet_id` override on an attachment (v4 commit 9).
   *
   * - `value` is the contractor-supplied sheet ID (e.g., "A-100", "SP-1").
   * - Pass `null` (or empty string) to clear the override — the merge
   *   orchestrator will resume auto-allocating from the band+discipline
   *   counter.
   *
   * Format validation is **advisory** (per the
   * `feedback_validation_advisory` MEMORY entry): if the value doesn't
   * match the recommended `^[A-Z][A-Za-z0-9]*-[A-Za-z0-9-]+$` pattern,
   * the hook still saves but surfaces a toast asking the user to confirm.
   *
   * Optimistic update + rollback on Supabase failure.
   */
  updateCustomSheetId: (
    attachmentId: string,
    value: string | null,
  ) => Promise<void>;

  /**
   * Update the `discipline_override` letter on an attachment (v5 commit 16).
   *
   * - `value` is a single uppercase letter A-Z (e.g., 'A', 'C', 'E', 'S', 'X',
   *   'M', 'P'). Pass `null` to clear the override — the merge orchestrator
   *   resumes auto-determining the discipline from `artifact_type`
   *   (site_plan/survey/hvhz_anchoring → C; everything else → X).
   *
   * Discipline overrides do NOT change the band counter; only the letter
   * prefix on this upload's sheet ID flips. Subsequent uploads continue
   * auto-allocating from the same band counter so the packet stays
   * continuous.
   *
   * Format validation is **advisory** (per the
   * `feedback_validation_advisory` MEMORY entry): the hook accepts any
   * value, normalizes to uppercase, and surfaces a toast if it doesn't
   * match the recommended `^[A-Z]$` shape — but still saves it.
   *
   * Optimistic update + rollback on Supabase failure.
   */
  updateDisciplineOverride: (
    attachmentId: string,
    value: string | null,
  ) => Promise<void>;
}

/**
 * Recommended sheet ID format. Advisory only — saved values that don't
 * match still go through. Pattern accepts architect/plan-set conventions
 * like "A-100", "C-201", "SP-1", "E-001a", "M-1.1".
 */
export const SHEET_ID_PATTERN = /^[A-Z][A-Za-z0-9]*-[A-Za-z0-9.-]+$/;
export function isLikelyValidSheetId(value: string): boolean {
  return SHEET_ID_PATTERN.test(value.trim());
}

/**
 * Recommended discipline letter format (v5). A single uppercase letter A-Z.
 * Advisory only — saved values that don't match still go through, but a
 * toast surfaces to flag the format. The merge orchestrator uses the
 * letter verbatim as the sheet-ID prefix regardless.
 */
export const DISCIPLINE_OVERRIDE_PATTERN = /^[A-Z]$/;
export function isLikelyValidDisciplineLetter(value: string): boolean {
  return DISCIPLINE_OVERRIDE_PATTERN.test(value.trim());
}

/**
 * Internal: count PDF pages using pdf-lib. Returns null if the file is not
 * a parseable PDF (caller decides whether to proceed with null page_count).
 */
async function countPdfPages(file: File): Promise<number | null> {
  try {
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes, {
      // The user's PDF may have been generated by anything — be lenient.
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    });
    return pdf.getPageCount();
  } catch (err) {
    console.warn('[useProjectAttachments] countPdfPages failed', err);
    return null;
  }
}

/**
 * Internal: build a unique storage path for a new upload. Prepends a
 * timestamp to avoid same-filename collisions.
 */
function buildStoragePath(
  userId: string,
  projectId: string,
  artifactType: ArtifactType,
  filename: string,
): string {
  const ts = Date.now();
  // Strip directory separators that some browsers leak through .name.
  const safeName = filename.replace(/[\\/]/g, '_');
  return `${userId}/${projectId}/${artifactType}/${ts}_${safeName}`;
}

/**
 * Custom hook for managing project PDF attachments with real-time sync.
 *
 * @param projectId - UUID of project to fetch attachments for. Undefined skips the fetch.
 */
export function useProjectAttachments(
  projectId: string | undefined,
): UseProjectAttachmentsReturn {
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAttachments = useCallback(async () => {
    if (!projectId) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('project_attachments')
        .select('*')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAttachments(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch attachments');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setAttachments([]);
      setLoading(false);
      return;
    }

    fetchAttachments();

    const subscription = supabase
      .channel(`project_attachments_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_attachments',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchAttachments();
        },
      )
      .subscribe();

    const unsubscribeRefresh = dataRefreshEvents.subscribe(
      'project_attachments',
      () => {
        fetchAttachments();
      },
    );

    return () => {
      subscription.unsubscribe();
      unsubscribeRefresh();
    };
  }, [projectId, fetchAttachments]);

  const upload = async (
    input: UploadAttachmentInput,
  ): Promise<ProjectAttachment | null> => {
    if (!projectId) {
      setError('No project selected');
      return null;
    }

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const user = userData.user;
      if (!user) throw new Error('Not authenticated');

      const pageCount = await countPdfPages(input.file);
      const storagePath = buildStoragePath(
        user.id,
        projectId,
        input.artifactType,
        input.file.name,
      );

      // Step 1 — Storage upload. If this fails, nothing else happens.
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, input.file, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'application/pdf',
        });
      if (uploadError) throw uploadError;

      // Step 2 — DB row insert. user_id supplied explicitly; RLS will reject
      // anything not matching auth.uid() so this is just for the FK / CHECK.
      const { data: row, error: insertError } = await supabase
        .from('project_attachments')
        .insert({
          project_id: projectId,
          user_id: user.id,
          artifact_type: input.artifactType,
          filename: input.file.name,
          storage_path: storagePath,
          page_count: pageCount,
          display_title: input.displayTitle.trim() || input.file.name,
        })
        .select()
        .single();

      if (insertError) {
        // Don't leave orphans in Storage — best-effort cleanup.
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]).catch(() => {
          /* swallow — surfaced via the original insertError below */
        });
        throw insertError;
      }

      // Optimistic local update; subscription will reconcile.
      if (row) {
        setAttachments((prev) => [row, ...prev]);
      }

      showToast.success(toastMessages.attachment.uploaded);
      dataRefreshEvents.emit('project_attachments');
      return row;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload attachment';
      setError(message);
      showToast.error(toastMessages.attachment.uploadFailed);
      console.error('[useProjectAttachments] upload failed', err);
      return null;
    }
  };

  const remove = async (attachmentId: string): Promise<void> => {
    const target = attachments.find((a) => a.id === attachmentId);
    if (!target) return;

    try {
      // Step 1 — Storage delete. If this fails, the DB row stays put so the
      // user can retry; otherwise we'd have a row pointing at a still-live
      // file the user thinks is gone.
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([target.storage_path]);
      if (storageError) throw storageError;

      // Step 2 — DB row delete. If this fails after Storage succeeded, log
      // it loudly — the row now points at a missing object. The next
      // subscription refetch will reconcile after a manual retry.
      const { error: dbError } = await supabase
        .from('project_attachments')
        .delete()
        .eq('id', attachmentId);

      if (dbError) {
        console.error(
          '[useProjectAttachments] DB delete failed AFTER Storage delete succeeded',
          dbError,
        );
        showToast.error(toastMessages.attachment.deleteFailed);
        setError(dbError.message);
        return;
      }

      // Optimistic local update.
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      showToast.success(toastMessages.attachment.deleted);
      dataRefreshEvents.emit('project_attachments');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete attachment';
      setError(message);
      showToast.error(toastMessages.attachment.deleteFailed);
      console.error('[useProjectAttachments] remove failed', err);
    }
  };

  const updateCoverMode = async (
    attachmentId: string,
    mode: CoverMode,
  ): Promise<void> => {
    const target = attachments.find((a) => a.id === attachmentId);
    if (!target) return;

    // Optimistic update — swap locally so the radio/select reflects
    // the choice immediately. Realtime subscription reconciles on the
    // next tick.
    const previous = target.cover_mode;
    setAttachments((prev) =>
      prev.map((a) =>
        a.id === attachmentId ? { ...a, cover_mode: mode } : a,
      ),
    );

    try {
      const { error: updateError } = await supabase
        .from('project_attachments')
        .update({ cover_mode: mode })
        .eq('id', attachmentId);

      if (updateError) {
        // Rollback.
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachmentId ? { ...a, cover_mode: previous } : a,
          ),
        );
        throw updateError;
      }

      dataRefreshEvents.emit('project_attachments');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to update attachment';
      setError(message);
      showToast.error(toastMessages.attachment.coverModeFailed);
      console.error('[useProjectAttachments] updateCoverMode failed', err);
    }
  };

  const updateCustomSheetId = async (
    attachmentId: string,
    value: string | null,
  ): Promise<void> => {
    const target = attachments.find((a) => a.id === attachmentId);
    if (!target) return;

    // Normalize: empty string → null (clear override). Trim incidental
    // whitespace so " C-201 " saves as "C-201".
    const trimmed = value === null ? null : value.trim();
    const normalized = trimmed === '' || trimmed === null ? null : trimmed;

    // Advisory validation — warn but still save (per feedback_validation_advisory).
    // We surface it as an info-style toast (`success` channel) rather than
    // an error since the value is still saved; the message itself makes
    // the "format looks unusual" caveat explicit.
    if (normalized && !isLikelyValidSheetId(normalized)) {
      showToast.success(toastMessages.attachment.customSheetIdInvalid);
    }

    // Optimistic update.
    const previous = target.custom_sheet_id;
    setAttachments((prev) =>
      prev.map((a) =>
        a.id === attachmentId ? { ...a, custom_sheet_id: normalized } : a,
      ),
    );

    try {
      const { error: updateError } = await supabase
        .from('project_attachments')
        .update({ custom_sheet_id: normalized })
        .eq('id', attachmentId);

      if (updateError) {
        // Rollback.
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachmentId ? { ...a, custom_sheet_id: previous } : a,
          ),
        );
        throw updateError;
      }

      showToast.success(toastMessages.attachment.customSheetIdSaved);
      dataRefreshEvents.emit('project_attachments');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to update custom sheet ID';
      setError(message);
      showToast.error(toastMessages.attachment.customSheetIdFailed);
      console.error('[useProjectAttachments] updateCustomSheetId failed', err);
    }
  };

  const updateDisciplineOverride = async (
    attachmentId: string,
    value: string | null,
  ): Promise<void> => {
    const target = attachments.find((a) => a.id === attachmentId);
    if (!target) return;

    // Normalize: trim and uppercase a non-null input so 'a' → 'A'. Empty
    // string → null (clear override).
    const trimmed = value === null ? null : value.trim().toUpperCase();
    const normalized = trimmed === '' || trimmed === null ? null : trimmed;

    // Advisory validation — warn but still save (feedback_validation_advisory).
    if (normalized && !isLikelyValidDisciplineLetter(normalized)) {
      showToast.success(toastMessages.attachment.disciplineOverrideInvalid);
    }

    // Optimistic update.
    const previous = target.discipline_override;
    setAttachments((prev) =>
      prev.map((a) =>
        a.id === attachmentId ? { ...a, discipline_override: normalized } : a,
      ),
    );

    try {
      const { error: updateError } = await supabase
        .from('project_attachments')
        .update({ discipline_override: normalized })
        .eq('id', attachmentId);

      if (updateError) {
        // Rollback.
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachmentId
              ? { ...a, discipline_override: previous }
              : a,
          ),
        );
        throw updateError;
      }

      showToast.success(toastMessages.attachment.disciplineOverrideSaved);
      dataRefreshEvents.emit('project_attachments');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to update discipline override';
      setError(message);
      showToast.error(toastMessages.attachment.disciplineOverrideFailed);
      console.error(
        '[useProjectAttachments] updateDisciplineOverride failed',
        err,
      );
    }
  };

  return {
    attachments,
    loading,
    error,
    upload,
    remove,
    updateCoverMode,
    updateCustomSheetId,
    updateDisciplineOverride,
  };
}

// ============================================================================
// PURE HELPERS (exported for testing)
// ============================================================================

/**
 * Validates a candidate upload file against shape + size constraints.
 * Pure function — no toast side effects; caller decides the UX response.
 *
 * @returns null on success, or a discriminated error object.
 */
export function validateAttachmentFile(
  file: File,
  maxSizeMB: number,
): { kind: 'invalid_type' } | { kind: 'too_large'; maxSizeMB: number } | null {
  // application/pdf is the canonical MIME; some scanners produce empty
  // type strings — fall back to extension check.
  const isPdfMime = file.type === 'application/pdf';
  const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
  if (!isPdfMime && !isPdfExt) {
    return { kind: 'invalid_type' };
  }
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { kind: 'too_large', maxSizeMB };
  }
  return null;
}

export { buildStoragePath, countPdfPages, STORAGE_BUCKET };

/**
 * Fetch the raw PDF bytes for an uploaded attachment from Supabase Storage.
 *
 * The merge orchestrator (Sprint 2B PR-3) calls this for each attachment
 * before invoking `mergePacket`. Kept as a free function (not a hook
 * method) so it can be invoked imperatively from the
 * "Generate packet" button handler without coupling to a React render
 * cycle.
 *
 * Returns null on failure so callers can surface a warning and continue
 * with the remaining attachments rather than aborting the whole packet.
 */
export async function downloadAttachmentBytes(
  storagePath: string,
): Promise<Uint8Array | null> {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);
    if (error || !data) return null;
    const buf = await data.arrayBuffer();
    return new Uint8Array(buf);
  } catch (err) {
    console.warn('[useProjectAttachments] downloadAttachmentBytes failed', err);
    return null;
  }
}

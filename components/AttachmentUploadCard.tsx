/**
 * AttachmentUploadCard (Sprint 2B PR-2)
 *
 * A drop-in upload + list card for a single `artifact_type`. The
 * PermitPacketGenerator renders one of these per artifact slot under the
 * "User-supplied artifacts" heading (site plan, cut sheets, fire stopping,
 * NOC, HOA letter, survey, manufacturer data).
 *
 * Validation:
 * - PDF only (application/pdf, or .pdf extension as fallback)
 * - Size ≤ maxSizeMB (default 25)
 *
 * Toasts are routed through `lib/toast.ts` per CLAUDE.md conventions.
 *
 * NOTE: The actual splicing of these PDFs into the generated permit packet
 * is PR-3's merge engine — this PR only handles upload + listing.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import {
  useProjectAttachments,
  validateAttachmentFile,
  type ArtifactType,
  type CoverMode,
} from '../hooks/useProjectAttachments';
import { DISCIPLINE_OVERRIDE_OPTIONS } from '../services/pdfExport/packetSections';
import { showToast, toastMessages } from '../lib/toast';

/**
 * Per-row 3-state cover selector (v4 commit 15). Replaces the 2-state
 * CoverToggle from commit 8.
 *
 *   separate  → SparkPlan title sheet as its own page preceding the
 *               upload (current default — for legal docs, cut sheets,
 *               NOC, HOA).
 *   overlay   → SparkPlan title block composited ONTO the upload page
 *               itself. For bare drawings (Bluebeam markups, Google
 *               Earth printouts) without their own title block.
 *   none      → upload appended as-is. For uploads that already carry
 *               an architect title block (e.g., HOK A100).
 *
 * Visually a 3-segment radio strip — small enough to fit alongside the
 * SheetIdEditor and the delete button in the row layout. Each segment
 * carries a tooltip explaining when to pick that mode.
 */
const COVER_MODE_LABELS: Record<CoverMode, string> = {
  separate: 'Cover',
  overlay: 'Overlay',
  none: 'As-is',
};

const COVER_MODE_TOOLTIPS: Record<CoverMode, string> = {
  separate:
    'Separate cover sheet — SparkPlan title sheet as its own page preceding the upload. Default for legal docs, cut sheets, NOC, HOA.',
  overlay:
    'Overlay title block — SparkPlan title block composited onto the upload page. For bare drawings with no existing title block (Bluebeam markups, Google Earth printouts).',
  none:
    'Add as-is — upload appended as-is. For pre-bordered drawings with their own architect title block.',
};

const CoverModeSelector: React.FC<{
  value: CoverMode;
  onChange: (next: CoverMode) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled = false }) => {
  const modes: CoverMode[] = ['separate', 'overlay', 'none'];
  return (
    <div
      role="radiogroup"
      aria-label="SparkPlan cover mode"
      className="inline-flex rounded border border-gray-300 overflow-hidden bg-white"
    >
      {modes.map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            title={COVER_MODE_TOOLTIPS[m]}
            onClick={() => !disabled && !active && onChange(m)}
            className={`px-1.5 py-0.5 text-[10px] transition-colors border-r last:border-r-0 border-gray-300 focus:outline-none focus:ring-1 focus:ring-electric-500 ${
              active
                ? 'bg-electric-500 text-[#2d3b2d] font-medium'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            {COVER_MODE_LABELS[m]}
          </button>
        );
      })}
    </div>
  );
};

/**
 * SheetIdEditor — small inline editor for the per-upload custom sheet ID
 * override (v4 feature A). When `value` is null, the "auto" placeholder
 * is shown until the contractor clicks the pencil icon. When set, the
 * custom value is shown with a faint pencil to re-open the editor. The
 * `duplicate` flag drives a small amber dot warning visual when another
 * sheet in the same packet uses the same ID — advisory, not blocking.
 */
const SheetIdEditor: React.FC<{
  value: string | null;
  duplicate: boolean;
  disabled?: boolean;
  onSave: (next: string | null) => void;
}> = ({ value, duplicate, disabled = false, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  const handleStart = () => {
    if (disabled) return;
    setDraft(value ?? '');
    setEditing(true);
  };

  const handleSave = () => {
    const trimmed = draft.trim();
    onSave(trimmed === '' ? null : trimmed);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value ?? '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          autoFocus
          placeholder="e.g., C-201, A-100, SP-1"
          className="w-28 px-1.5 py-0.5 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-electric-500 focus:border-electric-500"
          aria-label="Custom sheet ID"
        />
        <button
          type="button"
          onClick={handleSave}
          className="text-electric-500 hover:text-yellow-600 p-0.5"
          aria-label="Save sheet ID"
          title="Save (Enter)"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="text-gray-400 hover:text-gray-700 p-0.5"
          aria-label="Cancel sheet ID edit"
          title="Cancel (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const display = value ?? 'auto';
  const isCustom = value !== null;
  return (
    <button
      type="button"
      onClick={handleStart}
      disabled={disabled}
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] transition-colors ${
        isCustom
          ? 'bg-electric-500/15 text-[#2d3b2d] hover:bg-electric-500/25'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 italic'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
      title={
        isCustom
          ? `Custom sheet ID: ${value}. Click to edit. Clear the field to revert to auto-allocation.`
          : 'Sheet ID auto-allocated. Click to override (e.g., "A-100" to match an architect plan-set).'
      }
      aria-label={isCustom ? `Edit sheet ID ${value}` : 'Override auto-allocated sheet ID'}
    >
      <span className="font-mono">{display}</span>
      <Pencil className="w-2.5 h-2.5 opacity-60" />
      {duplicate && (
        <span
          className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-500"
          title="Another upload in this packet uses the same sheet ID — review before generating."
          aria-label="Duplicate sheet ID warning"
        />
      )}
    </button>
  );
};

/**
 * DisciplineOverrideSelector — small native select for the per-upload
 * discipline letter override (v5 commit 17). Default value "" maps to
 * null = auto-determine from artifact_type. Selecting a letter forces
 * that prefix into the sheet ID (e.g., "A-201" instead of "C-201") on
 * the next packet build.
 *
 * Native <select> rather than a custom popover because the option list
 * is short (7 entries including Auto) and we want native keyboard +
 * mobile-friendly behavior. The pill styling stays consistent with the
 * SheetIdEditor and CoverModeSelector siblings in the row.
 *
 * `E` is intentionally absent from the options — that's reserved for
 * SparkPlan-generated content. If a DB row ever carries `E` as an
 * override (e.g., manual edit), the orchestrator still honors it and
 * the select shows it via the rendered current-value option.
 */
const DisciplineOverrideSelector: React.FC<{
  value: string | null;
  disabled?: boolean;
  onChange: (next: string | null) => void;
}> = ({ value, disabled = false, onChange }) => {
  const currentValue = value ?? '';
  // If the DB carries an unexpected letter (manual edit / Sprint 3
  // expansion), surface it as an extra option so the user sees it
  // selected rather than silently switching back to Auto.
  const extraOptions = (
    value && !DISCIPLINE_OVERRIDE_OPTIONS.includes(value as never)
      ? [value]
      : []
  ) as string[];
  return (
    <select
      value={currentValue}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? null : v);
      }}
      title={
        value
          ? `Discipline prefix forced to "${value}-". Choose Auto to revert to the default (civil for site plans/surveys, manufacturer for everything else).`
          : 'Discipline auto-determined from file type. Pick a letter to override (e.g., "A" so this upload prints as "A-201" inside the architect plan set).'
      }
      aria-label="Discipline prefix override"
      className={`appearance-none rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] font-mono text-gray-700 focus:outline-none focus:ring-1 focus:ring-electric-500 focus:border-electric-500 ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      } ${value ? 'bg-electric-500/15 text-[#2d3b2d]' : ''}`}
    >
      <option value="">Auto</option>
      {DISCIPLINE_OVERRIDE_OPTIONS.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
      {extraOptions.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
    </select>
  );
};

interface AttachmentUploadCardProps {
  projectId: string;
  artifactType: ArtifactType;
  title: string;
  description?: string;
  /**
   * If false, restricts the user to a single file (older entries can still
   * be deleted; uploading another replaces it implicitly by being newer in
   * the sort order). Default true.
   */
  multiple?: boolean;
  /** Default 25MB. */
  maxSizeMB?: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export const AttachmentUploadCard: React.FC<AttachmentUploadCardProps> = ({
  projectId,
  artifactType,
  title,
  description,
  multiple = true,
  maxSizeMB = 25,
}) => {
  const {
    attachments,
    loading,
    upload,
    remove,
    updateCoverMode,
    updateCustomSheetId,
    updateDisciplineOverride,
  } = useProjectAttachments(projectId);

  // Filter the global list down to this card's slot.
  const ownAttachments = attachments.filter((a) => a.artifact_type === artifactType);

  // Build a duplicate-detection map across ALL attachments (not just this
  // card's slot) so cross-discipline collisions surface too — e.g., a
  // site_plan custom-set to "X-201" while a cut_sheet auto-allocates X-201.
  // Only non-null custom IDs are tracked; auto-allocated IDs aren't
  // counted because the orchestrator guarantees uniqueness.
  const duplicateIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of attachments) {
      const cs = a.custom_sheet_id?.trim();
      if (!cs) continue;
      counts.set(cs, (counts.get(cs) ?? 0) + 1);
    }
    const dupes = new Set<string>();
    for (const [id, n] of counts) {
      if (n > 1) dupes.add(id);
    }
    return dupes;
  }, [attachments]);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const acceptMultiple = multiple && ownAttachments.length === 0
    ? true
    : multiple; // multiple uploads always allowed for multi cards

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    // Enforce single-file slots (NOC, HOA letter) — block if one is already
    // present. Caller can delete-then-re-upload to replace.
    if (!multiple && (ownAttachments.length > 0 || files.length > 1)) {
      showToast.error(
        'This slot accepts only one file — delete the existing one first',
      );
      return;
    }

    setUploadingCount((c) => c + files.length);
    try {
      for (const file of files) {
        const validation = validateAttachmentFile(file, maxSizeMB);
        if (validation) {
          if (validation.kind === 'invalid_type') {
            showToast.error(toastMessages.attachment.invalidFileType);
          } else {
            showToast.error(toastMessages.attachment.fileTooLarge(validation.maxSizeMB));
          }
          continue;
        }

        await upload({
          file,
          artifactType,
          // Default display title strips the .pdf extension for readability;
          // the user can rename later (PR-3 will add inline editing).
          displayTitle: file.name.replace(/\.pdf$/i, ''),
        });
      }
    } finally {
      setUploadingCount((c) => Math.max(0, c - files.length));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (id: string, displayTitle: string | null) => {
    const label = displayTitle?.trim() || 'this attachment';
    // Inline simple confirm — codebase convention (see Billing/Permits/Estimates).
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;

    setDeletingId(id);
    try {
      await remove(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    await handleFiles(e.dataTransfer.files);
  };

  // Single-file slot with item already present — show the drop zone disabled.
  const dropDisabled = !multiple && ownAttachments.length > 0;

  return (
    <div className="border border-gray-200 rounded-md p-4 space-y-3 bg-white">
      <div>
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#2d3b2d]" />
          {title}
        </h4>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>

      {/* Drop zone */}
      <label
        className={`block cursor-pointer ${dropDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <div
          onDragEnter={dropDisabled ? undefined : handleDragEnter}
          onDragOver={dropDisabled ? undefined : handleDragOver}
          onDragLeave={dropDisabled ? undefined : handleDragLeave}
          onDrop={dropDisabled ? undefined : handleDrop}
          className={`border-2 border-dashed rounded-md p-3 text-center transition-colors ${
            isDragging
              ? 'border-[#2d3b2d] bg-[#e8f5e8]'
              : 'border-gray-300 hover:border-[#2d3b2d] hover:bg-[#f0f5f0]'
          }`}
        >
          {uploadingCount > 0 ? (
            <div className="flex flex-col items-center gap-1 py-1">
              <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
              <p className="text-xs text-gray-600">
                Uploading {uploadingCount} file{uploadingCount === 1 ? '' : 's'}…
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 py-1">
              <Upload className="w-5 h-5 text-gray-500" />
              <p className="text-xs text-gray-700">
                {dropDisabled
                  ? 'Delete existing file to replace'
                  : 'Drop PDF here or click to browse'}
              </p>
              <p className="text-[10px] text-gray-400">
                PDF only · ≤ {maxSizeMB}MB
              </p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple={acceptMultiple}
          disabled={dropDisabled || uploadingCount > 0}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </label>

      {/* File list — empty state OR populated rows */}
      {loading ? (
        <p className="text-xs text-gray-400 italic">Loading…</p>
      ) : ownAttachments.length === 0 && uploadingCount === 0 ? (
        <p className="text-xs text-gray-400 italic">No files uploaded yet</p>
      ) : (
        <ul className="space-y-1.5">
          {ownAttachments.map((a) => {
            const isDeleting = deletingId === a.id;
            const mode: CoverMode = a.cover_mode ?? 'separate';
            return (
              <li
                key={a.id}
                className="flex items-center gap-2 border border-gray-200 rounded px-2 py-1.5 text-xs bg-gray-50"
              >
                <FileText className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate" title={a.display_title || a.filename}>
                    {a.display_title || a.filename}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {a.page_count != null
                      ? `${a.page_count} page${a.page_count === 1 ? '' : 's'} · `
                      : ''}
                    uploaded {formatDate(a.uploaded_at)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-gray-500 select-none">
                    Disc
                  </span>
                  <DisciplineOverrideSelector
                    value={a.discipline_override}
                    disabled={isDeleting}
                    onChange={(next) => updateDisciplineOverride(a.id, next)}
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-gray-500 select-none">
                    Sheet
                  </span>
                  <SheetIdEditor
                    value={a.custom_sheet_id}
                    duplicate={
                      a.custom_sheet_id != null &&
                      duplicateIds.has(a.custom_sheet_id)
                    }
                    disabled={isDeleting}
                    onSave={(next) => updateCustomSheetId(a.id, next)}
                  />
                </div>
                <CoverModeSelector
                  value={mode}
                  disabled={isDeleting}
                  onChange={(next) => updateCoverMode(a.id, next)}
                />
                <button
                  type="button"
                  onClick={() => handleDelete(a.id, a.display_title)}
                  disabled={isDeleting}
                  className="text-gray-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed p-1"
                  aria-label={`Delete ${a.display_title || a.filename}`}
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

    </div>
  );
};

export default AttachmentUploadCard;

// Helpers re-exported for tests
export const __testing__ = { formatBytes, formatDate };

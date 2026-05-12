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

import React, { useRef, useState } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  useProjectAttachments,
  validateAttachmentFile,
  type ArtifactType,
} from '../hooks/useProjectAttachments';
import { showToast, toastMessages } from '../lib/toast';

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
  const { attachments, loading, upload, remove } = useProjectAttachments(projectId);

  // Filter the global list down to this card's slot.
  const ownAttachments = attachments.filter((a) => a.artifact_type === artifactType);

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

      {/* PR-2 reminder: the attachments aren't yet merged into the generated
          packet — flag this clearly so testers don't expect the file to
          appear in the downloaded PDF until PR-3 ships. */}
      {ownAttachments.length > 0 && (
        <div className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>
            Uploaded files are stored but not yet spliced into the generated
            packet PDF — that ships in the next release.
          </span>
        </div>
      )}
    </div>
  );
};

export default AttachmentUploadCard;

// Helpers re-exported for tests
export const __testing__ = { formatBytes, formatDate };

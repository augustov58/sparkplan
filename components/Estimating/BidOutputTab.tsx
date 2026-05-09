import React, { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import type { Database } from '@/lib/database.types';
import { EstimateBidDocument } from '@/services/estimating/estimatePdfGenerator';
import { showToast, toastMessages } from '@/lib/toast';

type Estimate = Database['public']['Tables']['estimates']['Row'];
type LineItem = Database['public']['Tables']['estimate_line_items']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];

interface BidOutputTabProps {
  estimate: Estimate;
  lineItems: LineItem[];
  project: Pick<Project, 'name' | 'address'> | null;
  /** When user clicks Generate, the parent persists `bid_pdf_generated_at`. */
  onMarkGenerated?: () => void;
}

const fmtDate = (iso: string | null): string => {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US');
};

export const BidOutputTab: React.FC<BidOutputTabProps> = ({
  estimate,
  lineItems,
  project,
  onMarkGenerated,
}) => {
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const generate = async (download: boolean) => {
    setGenerating(true);
    try {
      const blob = await pdf(
        <EstimateBidDocument estimate={estimate} lineItems={lineItems} project={project} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);

      if (download) {
        const a = document.createElement('a');
        a.href = url;
        const safeName = estimate.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        a.download = `bid-${safeName}-r${estimate.revision}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      onMarkGenerated?.();
      showToast.success(toastMessages.estimate.pdfGenerated);
    } catch (err) {
      console.error('PDF generation failed', err);
      showToast.error(toastMessages.estimate.pdfError);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          Last generated:{' '}
          <span className="font-medium text-gray-900">
            {fmtDate(estimate.bid_pdf_generated_at)}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => generate(false)}
            disabled={generating || lineItems.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Preview
          </button>
          <button
            onClick={() => generate(true)}
            disabled={generating || lineItems.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-electric-500 px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-electric-400 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PDF
          </button>
        </div>
      </div>

      {lineItems.length === 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Add at least one line item before generating the bid PDF.
        </div>
      )}

      {previewUrl ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          <iframe
            src={previewUrl}
            title="Bid PDF preview"
            className="block h-[80vh] w-full"
          />
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center text-sm text-gray-500">
          Click <span className="font-medium">Preview</span> to render a draft bid PDF inline, or{' '}
          <span className="font-medium">Download PDF</span> to save it locally.
          <br />
          <span className="text-xs">
            (Phase 1: PDF rendered client-side; Phase 4 will upload to Supabase Storage and persist
            the URL on the estimate.)
          </span>
        </div>
      )}
    </div>
  );
};

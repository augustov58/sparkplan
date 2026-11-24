/**
 * CSV fields per RFC 4180 (moved from services/pdfExport/commercialLoadExport.ts
 * so every CSV export shares it, #321):
 *   - A field containing a comma, quote, CR, or LF is wrapped in double quotes,
 *     with any internal double quote doubled: 3/4" → "3/4""".
 *   - Otherwise it is returned as-is.
 * Numbers are stringified; null/undefined become empty strings.
 */
export function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV row from an array of fields. */
export function csvRow(fields: ReadonlyArray<string | number | boolean | null | undefined>): string {
  return fields.map(csvEscape).join(',');
}

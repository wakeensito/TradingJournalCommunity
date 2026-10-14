// RFC-4180 CSV: quoted fields, "" escapes, CRLF/LF/CR line endings, BOM, embedded delimiters and newlines.

/**
 * Parse CSV text into rows of fields. Blank lines are skipped. `delimiter` defaults to ',' (pass '\t' for TSV).
 * Lenient on malformed input: a stray quote inside an unquoted field is kept literally.
 */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  if (!text) return rows;
  let s = text;
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false; // field has content or was quoted (distinguishes "" from nothing)
  const n = s.length;

  const endRow = () => {
    row.push(field);
    // skip blank lines (a single empty, unquoted field)
    if (!(row.length === 1 && row[0] === '' && !fieldStarted)) rows.push(row); // row.length > 1 ⇒ had a delimiter
    row = [];
    field = '';
    fieldStarted = false;
  };

  for (let i = 0; i < n; i++) {
    const ch = s[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === '' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
      fieldStarted = false;
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      endRow();
    } else {
      field += ch;
      fieldStarted = true;
    }
  }
  if (field !== '' || fieldStarted || row.length > 0) endRow();
  return rows;
}

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : String(v);
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize rows to RFC-4180 CSV (CRLF line endings, quoting only when needed). */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + (rows.length ? '\r\n' : '');
}

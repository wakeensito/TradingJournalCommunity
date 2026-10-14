// Display formatting. U+2212 (−) is the minus sign for money so columns align with '+'.

const MINUS = '−';

function trimZero(s: string): string {
  return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/** '+$1,234.50' (sign: true), '−$80.00', '$0.00'; compact: '+$1.2k', '$950', '−$2.5M'. */
export function formatMoney(n: number, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const v = Number.isFinite(n) ? n : 0;
  let abs = Math.abs(v);
  let body: string;
  if (opts.compact) {
    if (abs >= 999_950) body = trimZero((abs / 1_000_000).toFixed(1)) + 'M';
    else if (abs >= 999.5) body = trimZero((abs / 1000).toFixed(1)) + 'k';
    else {
      abs = Math.round(abs);
      body = String(abs);
    }
  } else {
    abs = Math.round(abs * 100) / 100;
    body = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (abs === 0) return '$' + body;
  if (v < 0) return `${MINUS}$${body}`;
  return (opts.sign ? '+' : '') + '$' + body;
}

/** 0.62 → '62%'; null → '—'. */
export function formatPct(x: number | null): string {
  if (x === null || !Number.isFinite(x)) return '—';
  return `${Math.round(x * 100)}%`;
}

/** Up to 4 decimals, at least 2, trailing zeros trimmed: 21034.25 → '21034.25', 5 → '5.00', 1.23456 → '1.2346'. */
export function formatPrice(n: number): string {
  if (!Number.isFinite(n)) return '—';
  let s = n.toFixed(4);
  s = s.replace(/0{1,2}$/, '');
  return s === '-0.00' ? '0.00' : s;
}

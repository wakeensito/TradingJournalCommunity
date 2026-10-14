// Ids. Manual trades get a time-sortable random id; imported trades get a deterministic fingerprint so re-imports are idempotent.

const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(out);
  else for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

/** 20 chars: 9 base36 chars of ms timestamp (sortable until year ~5188) + 11 random base36 chars. */
export function newId(): string {
  const ts = Date.now().toString(36).padStart(9, '0');
  const bytes = randomBytes(11);
  let rand = '';
  for (const b of bytes) rand += B36[b % 36];
  return ts + rand;
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK64 = 0xffffffffffffffffn;

/** FNV-1a 64-bit over the UTF-8 bytes of the parts (joined with U+001F), base36, prefixed 'imp_'. */
export function fingerprint(parts: (string | number)[]): string {
  const text = parts.map((p) => (typeof p === 'number' ? numKey(p) : p)).join('\u001f');
  const bytes = new TextEncoder().encode(text);
  let h = FNV_OFFSET;
  for (const b of bytes) {
    h ^= BigInt(b);
    h = (h * FNV_PRIME) & MASK64;
  }
  return 'imp_' + h.toString(36).padStart(13, '0');
}

// Stable number rendering so 1.5 and 1.50 (and float noise like 0.30000000000000004) hash identically.
function numKey(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  return String(Math.round(n * 1e6) / 1e6);
}

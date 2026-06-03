/**
 * Safe localStorage helpers. Reading and JSON-parsing localStorage directly in
 * a `useState` initializer throws (SyntaxError / SecurityError) if the value is
 * malformed or storage is unavailable — and that throw happens before any error
 * boundary mounts, producing a white screen. These wrappers never throw.
 */

/** Read and JSON-parse a localStorage key; returns `fallback` on miss, malformed data, or unavailable storage. */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** JSON-stringify and write a value to localStorage; swallows quota/availability errors. */
export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}

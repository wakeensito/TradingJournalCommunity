import { describe, expect, it } from 'vitest';
import { formatMoney, formatPct, formatPrice } from '../format';
import { fingerprint, newId } from '../ids';

describe('formatMoney', () => {
  it('signs and minus', () => {
    expect(formatMoney(1234.5, { sign: true })).toBe('+$1,234.50');
    expect(formatMoney(1234.5)).toBe('$1,234.50');
    expect(formatMoney(-80)).toBe('−$80.00');
    expect(formatMoney(-80, { sign: true })).toBe('−$80.00');
    expect(formatMoney(0, { sign: true })).toBe('$0.00');
    expect(formatMoney(-0.001, { sign: true })).toBe('$0.00');
    expect(formatMoney(1234567.891)).toBe('$1,234,567.89');
  });
  it('compact', () => {
    expect(formatMoney(1234.5, { sign: true, compact: true })).toBe('+$1.2k');
    expect(formatMoney(-2500, { compact: true })).toBe('−$2.5k');
    expect(formatMoney(1000, { compact: true })).toBe('$1k');
    expect(formatMoney(950.4, { compact: true })).toBe('$950');
    expect(formatMoney(2_500_000, { compact: true })).toBe('$2.5M');
    expect(formatMoney(0.3, { compact: true, sign: true })).toBe('$0');
  });
});

describe('formatPct / formatPrice', () => {
  it('pct', () => {
    expect(formatPct(0.62)).toBe('62%');
    expect(formatPct(2 / 3)).toBe('67%');
    expect(formatPct(null)).toBe('—');
  });
  it('price', () => {
    expect(formatPrice(21034.25)).toBe('21034.25');
    expect(formatPrice(0.85)).toBe('0.85');
    expect(formatPrice(5)).toBe('5.00');
    expect(formatPrice(4.915)).toBe('4.915');
    expect(formatPrice(1.23456)).toBe('1.2346');
    expect(formatPrice(21011.666667)).toBe('21011.6667');
  });
});

describe('ids', () => {
  it('newId is ~20 chars, unique, time-sortable', async () => {
    const a = newId();
    await new Promise((r) => setTimeout(r, 3));
    const b = newId();
    expect(a).toHaveLength(20);
    expect(a).toMatch(/^[0-9a-z]+$/);
    expect(a < b).toBe(true);
    expect(new Set(Array.from({ length: 500 }, newId)).size).toBe(500);
  });
  it('fingerprint is deterministic, prefixed, order-sensitive', () => {
    const p = ['tradovate', 'MNQZ5', '2025-12-03', '09:41', 'long', 2, 21034.25, 21040.75];
    expect(fingerprint(p)).toBe(fingerprint([...p]));
    expect(fingerprint(p)).toMatch(/^imp_[0-9a-z]{13}$/);
    expect(fingerprint(['a', 'b'])).not.toBe(fingerprint(['b', 'a']));
    expect(fingerprint(['ab', 'c'])).not.toBe(fingerprint(['a', 'bc']));
    expect(fingerprint([0.1 + 0.2])).toBe(fingerprint([0.3]));
  });
});

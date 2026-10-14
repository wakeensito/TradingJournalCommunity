import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '../csv';

describe('parseCsv', () => {
  it('basic', () => expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]));
  it('CRLF, CR and trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a,b\r1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('BOM', () => expect(parseCsv('﻿symbol,qty\nMNQ,1')[0]).toEqual(['symbol', 'qty']));
  it('quoted fields with commas, escaped quotes and newlines', () => {
    expect(parseCsv('"a,b","say ""hi""","line1\nline2",plain')).toEqual([['a,b', 'say "hi"', 'line1\nline2', 'plain']]);
    expect(parseCsv('"x\r\ny",z\r\n1,2')).toEqual([['x\r\ny', 'z'], ['1', '2']]);
  });
  it('empty fields and empty quoted fields', () => {
    expect(parseCsv('a,,c\n,,\n"",x')).toEqual([['a', '', 'c'], ['', '', ''], ['', 'x']]);
  });
  it('skips blank lines', () => expect(parseCsv('a\n\n\nb\n')).toEqual([['a'], ['b']]));
  it('$ and parentheses survive', () => expect(parseCsv('"$1,234.50","($300.06)"')).toEqual([['$1,234.50', '($300.06)']]));
  it('stray quote inside an unquoted field is literal', () => expect(parseCsv(`SPY Dec19'25 5"x,1`)).toEqual([[`SPY Dec19'25 5"x`, '1']]));
  it('unterminated quote keeps the rest', () => expect(parseCsv('"abc\ndef')).toEqual([['abc\ndef']]));
  it('tab delimiter', () => expect(parseCsv('a\tb\n1\t2', '\t')).toEqual([['a', 'b'], ['1', '2']]));
  it('empty input', () => expect(parseCsv('')).toEqual([]));
});

describe('toCsv', () => {
  it('quotes only when needed; null/undefined → empty', () => {
    expect(toCsv([['a', 1, null, undefined, 'x,y', 'q"q', 'l\nm', ' pad']])).toBe('a,1,,,"x,y","q""q","l\nm"," pad"\r\n');
  });
  it('round-trips through parseCsv', () => {
    const rows = [['id', 'notes'], ['1', 'he said "go", then\nleft'], ['2', '']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

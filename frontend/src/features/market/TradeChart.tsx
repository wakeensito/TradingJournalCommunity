// Candlesticks for a trade's day, zoomed to the trade window ± padding, with entry/exit markers and price lines.
// Hand-rolled SVG (no chart dependency): drawn at the container's real pixel width so 1px wicks stay crisp.
// Touch: horizontal drag scrubs a crosshair (vertical scroll still pans the sheet). Axis times are ET.
// Options chart the underlying, so they get time markers only — the option premium isn't on this price scale.

import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Trade } from '@/lib/types';
import { formatPrice } from '@/lib/format';
import { cx } from '@/ui/controls';
import {
  type ApiGet,
  type Bar,
  barIndexAt,
  barsRequestForTrade,
  etTime,
  niceTicks,
  shortTime,
  timeTickStep,
  tradeMarks,
  visibleRange,
} from './market';
import { barsTooOld, useMarketBars } from './useMarket';

export type ChartTrade = Pick<
  Trade,
  'symbol' | 'assetType' | 'date' | 'time' | 'exitTime' | 'side' | 'entry' | 'exit' | 'option' | 'stop'
>;

export interface TradeChartProps {
  trade: ChartTrade;
  apiGet: ApiGet;
  height?: number;
  className?: string;
}

const OLD_MESSAGE = 'Chart unavailable for trades older than 60 days';

export function TradeChart({ trade, apiGet, height = 240, className }: TradeChartProps) {
  const tooOld = barsTooOld(trade.date);
  const req = useMemo(
    () => barsRequestForTrade(trade),
    // Only these fields change the request; depending on `trade` would refetch on every edit.
    [trade.symbol, trade.date, trade.assetType, trade.option?.underlying],
  );
  const { data, loading, error } = useMarketBars(apiGet, tooOld ? null : req);
  const [ref, width] = useWidth<HTMLDivElement>();

  let body: JSX.Element;
  if (tooOld || (error?.status === 404 && /60 days/.test(error.message))) {
    body = <ChartEmpty height={height} text={OLD_MESSAGE} />;
  } else if (loading && !data) {
    body = <div aria-hidden className="skeleton w-full" style={{ height }} />;
  } else if (error || !data || data.bars.length === 0) {
    body = <ChartEmpty height={height} text="Chart unavailable for this trade" />;
  } else if (width > 0) {
    body = <Candles trade={trade} bars={data.bars} symbol={data.symbol} interval={data.interval} width={width} height={height} />;
  } else {
    body = <div style={{ height }} />;
  }
  return (
    <div ref={ref} className={cx('w-full min-w-0', className)}>
      {body}
    </div>
  );
}

function ChartEmpty({ height, text }: { height: number; text: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-[10px] border border-dashed border-line-strong bg-inset px-4 text-center text-body text-ink-3"
      style={{ height: Math.min(height, 96) }}
    >
      {text}
    </div>
  );
}

function useWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.floor(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw !== undefined) setW(Math.floor(cw));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// ── The chart ──────────────────────────────────────────────────────────
const PAD = { top: 10, right: 66, bottom: 22, left: 4 };

function decimalsFor(step: number): number {
  const s = String(Number(step.toPrecision(3)));
  const i = s.indexOf('.');
  return i < 0 ? 0 : Math.min(6, s.length - i - 1);
}

const crisp = (v: number) => Math.round(v) + 0.5;

function Candles({
  trade,
  bars,
  symbol,
  interval,
  width,
  height,
}: {
  trade: ChartTrade;
  bars: Bar[];
  symbol: string;
  interval: '1m' | '5m';
  width: number;
  height: number;
}) {
  const intervalSec = interval === '1m' ? 60 : 300;
  const showPrices = trade.assetType !== 'option';
  const [hover, setHover] = useState<number | null>(null);

  const m = useMemo(() => {
    const marks = tradeMarks(trade);
    const [i0, i1] = visibleRange(bars, marks, intervalSec);
    const vis = bars.slice(i0, i1);
    let lo = Math.min(...vis.map((b) => b.l));
    let hi = Math.max(...vis.map((b) => b.h));
    const span0 = Math.max(hi - lo, Math.abs(hi) * 1e-4, 1e-6);
    const near = (p: number | undefined): p is number =>
      p !== undefined && Number.isFinite(p) && p > lo - span0 && p < hi + span0;
    const levels = showPrices ? [trade.entry, trade.exit, trade.stop].filter(near) : [];
    for (const p of levels) {
      lo = Math.min(lo, p);
      hi = Math.max(hi, p);
    }
    const pad = Math.max(hi - lo, span0) * 0.08;
    lo -= pad;
    hi += pad;

    const plotW = Math.max(40, width - PAD.left - PAD.right);
    const plotH = Math.max(40, height - PAD.top - PAD.bottom);
    const slot = plotW / Math.max(1, vis.length);
    const bodyW = Math.max(1, Math.min(14, Math.floor(slot * 0.66)));
    const x = (i: number) => PAD.left + slot * (i + 0.5);
    const y = (p: number) => PAD.top + ((hi - p) / (hi - lo)) * plotH;

    const yTicks = niceTicks(lo, hi, Math.max(3, Math.floor(plotH / 48)));
    const dec = decimalsFor(yTicks.length > 1 ? yTicks[1]! - yTicks[0]! : 1);

    const spanSec = vis.length * intervalSec;
    const stepMin = timeTickStep(spanSec, plotW) / 60;
    const xTicks: { i: number; label: string }[] = [];
    let lastX = -Infinity;
    vis.forEach((b, i) => {
      const hm = etTime(b.t);
      const mins = Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));
      if (mins % stepMin === 0 && x(i) - lastX >= 52 && x(i) > PAD.left + 16 && x(i) < PAD.left + plotW - 16) {
        xTicks.push({ i, label: shortTime(hm) });
        lastX = x(i);
      }
    });

    const rel = (t: number | null) => {
      if (t === null) return null;
      const k = barIndexAt(bars, t, intervalSec);
      return k === null || k < i0 || k >= i1 ? null : k - i0;
    };
    return { vis, lo, hi, plotW, plotH, slot, bodyW, x, y, yTicks, dec, xTicks, entryI: rel(marks.entryT), exitI: rel(marks.exitT), marks };
  }, [trade, bars, intervalSec, width, height, showPrices]);

  const { vis, plotW, plotH, slot, bodyW, x, y, yTicks, dec, xTicks, entryI, exitI } = m;
  const long = trade.side === 'long';
  const sideColor = long ? 'var(--gain)' : 'var(--loss)';
  const won = long ? trade.exit > trade.entry : trade.exit < trade.entry;
  const outcomeColor = trade.exit === trade.entry ? 'var(--flat)' : won ? 'var(--gain)' : 'var(--loss)';
  const right = PAD.left + plotW;
  const bottom = PAD.top + plotH;
  const fmt = (p: number) => p.toFixed(dec);

  // Right-axis tags for entry/exit/stop; nudge apart when they'd collide.
  const tags: { key: string; label: string; price: number; color: string; dashed?: boolean }[] = [];
  if (showPrices) {
    tags.push({ key: 'entry', label: formatPrice(trade.entry), price: trade.entry, color: sideColor });
    if (Number.isFinite(trade.exit)) tags.push({ key: 'exit', label: formatPrice(trade.exit), price: trade.exit, color: outcomeColor });
    if (trade.stop !== undefined && trade.stop > m.lo && trade.stop < m.hi)
      tags.push({ key: 'stop', label: formatPrice(trade.stop), price: trade.stop, color: 'var(--ink-3)', dashed: true });
  }
  const tagY = tags.map((t) => y(t.price)).map((v) => Math.min(bottom - 8, Math.max(PAD.top + 8, v)));
  const order = tagY.map((_, i) => i).sort((a, b) => tagY[a]! - tagY[b]!);
  for (let k = 1; k < order.length; k++) {
    const prev = tagY[order[k - 1]!]!;
    if (tagY[order[k]!]! - prev < 16) tagY[order[k]!] = prev + 16;
  }

  const onPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left - PAD.left;
    const i = Math.floor(px / slot);
    setHover(i >= 0 && i < vis.length ? i : null);
  };

  const hb = hover !== null ? vis[hover] : undefined;
  const entryText = m.marks.entryT !== null ? etTime(m.marks.entryT) : null;
  const exitText = m.marks.exitT !== null ? etTime(m.marks.exitT) : null;
  const aria =
    `${symbol} ${interval} candles` +
    (entryText ? `, entry ${shortTime(entryText)} ET${showPrices ? ` at ${formatPrice(trade.entry)}` : ''}` : '') +
    (exitText ? `, exit ${shortTime(exitText)} ET${showPrices ? ` at ${formatPrice(trade.exit)}` : ''}` : '');

  return (
    <figure className="m-0">
      <figcaption className="flex h-6 items-center justify-between gap-2 text-caption text-ink-3">
        {hb ? (
          <span className="num truncate text-ink-2">
            <span className="text-ink-1">{shortTime(etTime(hb.t))}</span> O {fmt(hb.o)} H {fmt(hb.h)} L {fmt(hb.l)} C{' '}
            <span className={hb.c >= hb.o ? 'text-gain' : 'text-loss'}>{fmt(hb.c)}</span>
          </span>
        ) : (
          <span className="truncate">
            <span className="num text-ink-2">{symbol}</span> · {interval} · ET
          </span>
        )}
        {entryText === null ? (
          <span className="shrink-0">No entry time · session view</span>
        ) : entryI === null ? (
          <span className="shrink-0">Entry outside chart data</span>
        ) : null}
      </figcaption>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={aria}
        className="block touch-pan-y select-none"
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHover(null)}
        onPointerCancel={() => setHover(null)}
      >
        {/* grid + price axis */}
        {yTicks.map((p) => (
          <g key={p}>
            <line x1={PAD.left} x2={right} y1={crisp(y(p))} y2={crisp(y(p))} stroke="var(--line-soft)" />
            {!tagY.some((ty) => Math.abs(ty - y(p)) < 14) && (
              <text x={right + 6} y={y(p) + 4} fontSize="11" fill="var(--ink-3)" className="num">
                {fmt(p)}
              </text>
            )}
          </g>
        ))}
        <line x1={right + 0.5} x2={right + 0.5} y1={PAD.top} y2={bottom} stroke="var(--line)" />
        <line x1={PAD.left} x2={right} y1={bottom + 0.5} y2={bottom + 0.5} stroke="var(--line)" />
        {xTicks.map((t) => (
          <text key={t.i} x={x(t.i)} y={height - 6} fontSize="11" fill="var(--ink-3)" textAnchor="middle" className="num">
            {t.label}
          </text>
        ))}

        {/* hold span */}
        {entryI !== null && (
          <rect
            x={x(entryI) - slot / 2}
            y={PAD.top}
            width={Math.max(slot, ((exitI ?? entryI) - entryI + 1) * slot)}
            height={plotH}
            fill="var(--line-soft)"
          />
        )}

        {/* candles */}
        <g shapeRendering="crispEdges">
          {vis.map((b, i) => {
            const up = b.c >= b.o;
            const color = up ? 'var(--gain)' : 'var(--loss)';
            const cx0 = Math.round(x(i));
            const top = y(Math.max(b.o, b.c));
            const h = Math.max(1, y(Math.min(b.o, b.c)) - top);
            return (
              <g key={b.t}>
                <line x1={cx0 + 0.5} x2={cx0 + 0.5} y1={y(b.h)} y2={y(b.l)} stroke={color} />
                <rect
                  x={cx0 - Math.floor(bodyW / 2) + (bodyW % 2 ? 0 : 0.5)}
                  y={top}
                  width={bodyW}
                  height={h}
                  fill={up && bodyW > 3 ? 'var(--surface-1)' : color}
                  stroke={color}
                  strokeWidth={bodyW > 3 ? 1 : 0}
                />
              </g>
            );
          })}
        </g>

        {/* price lines + tags */}
        {tags.map((t, k) => (
          <g key={t.key}>
            <line
              x1={PAD.left}
              x2={right}
              y1={crisp(y(t.price))}
              y2={crisp(y(t.price))}
              stroke={t.color}
              strokeDasharray={t.dashed ? '2 3' : '5 4'}
              opacity={0.85}
            />
            <rect x={right + 1} y={tagY[k]! - 8} width={PAD.right - 2} height={16} rx={3} fill={t.color} />
            <text x={right + 6} y={tagY[k]! + 4} fontSize="11" fill="var(--bg)" className="num" fontWeight={600}>
              {t.label}
            </text>
          </g>
        ))}

        {/* markers */}
        {entryI !== null && vis[entryI] && (
          <Arrow
            x={x(entryI)}
            y={long ? y(vis[entryI].l) + 5 : y(vis[entryI].h) - 5}
            up={long}
            fill={sideColor}
            label="Entry"
          />
        )}
        {exitI !== null && vis[exitI] && (
          <Arrow
            x={x(exitI)}
            y={long ? y(vis[exitI].h) - 5 : y(vis[exitI].l) + 5}
            up={!long}
            fill="var(--surface-1)"
            stroke={outcomeColor}
            label="Exit"
          />
        )}

        {/* crosshair */}
        {hb && hover !== null && (
          <line x1={crisp(x(hover))} x2={crisp(x(hover))} y1={PAD.top} y2={bottom} stroke="var(--line-strong)" />
        )}
      </svg>
    </figure>
  );
}

/** Triangle whose tip sits at (x, y): `up` points up (tip on top). */
function Arrow({ x, y, up, fill, stroke, label }: { x: number; y: number; up: boolean; fill: string; stroke?: string; label: string }) {
  const w = 6;
  const h = 9;
  const d = up ? `M${x},${y} L${x - w},${y + h} L${x + w},${y + h} Z` : `M${x},${y} L${x - w},${y - h} L${x + w},${y - h} Z`;
  return (
    <path d={d} fill={fill} stroke={stroke ?? 'var(--bg)'} strokeWidth={stroke ? 1.75 : 1} strokeLinejoin="round">
      <title>{label}</title>
    </path>
  );
}

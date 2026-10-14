import { useMemo } from 'react';
import type { Trade } from '../lib/types';
import { netPnl, outcome } from '../lib/pnl';
import { formatMoney } from '../lib/format';
import { cx } from './controls';

/**
 * The signature: one tick per trade in time order, rising from a midline (gain) or falling (loss),
 * height ∝ |net| normalized within this tape. Ticks are left-aligned at a fixed rhythm so a two-trade
 * session reads as "early in the day", and a busy one fills the tape.
 */
const SIZES = {
  lg: { h: 72, slots: 24, stroke: 6, pad: 6 },
  sm: { h: 36, slots: 16, stroke: 4, pad: 3 },
  xs: { h: 18, slots: 7, stroke: 2.5, pad: 1 },
} as const;

function chrono(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ta = a.time ?? '';
    const tb = b.time ?? '';
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
}

export function SessionTape({
  trades,
  size = 'sm',
  band = 0,
  animateId,
  className,
  height,
}: {
  trades: Trade[];
  size?: 'lg' | 'sm' | 'xs';
  band?: number;
  /** Id of a trade whose tick should animate in (quick-log success). */
  animateId?: string | null;
  className?: string;
  height?: number;
}) {
  const cfg = SIZES[size];
  const h = height ?? cfg.h;
  const ticks = useMemo(() => {
    const ordered = chrono(trades);
    const nets = ordered.map((t) => netPnl(t));
    const max = Math.max(1e-9, ...nets.map(Math.abs));
    return ordered.map((t, i) => ({ id: t.id, net: nets[i]!, o: outcome(t, band), r: Math.abs(nets[i]!) / max }));
  }, [trades, band]);

  const total = ticks.reduce((s, t) => s + t.net, 0);
  const label =
    ticks.length === 0
      ? 'No trades'
      : `${ticks.length} trade${ticks.length === 1 ? '' : 's'}, net ${formatMoney(total, { sign: true })}`;

  const slots = Math.max(cfg.slots, ticks.length);
  const stroke = ticks.length > cfg.slots * 2 ? Math.max(1.5, cfg.stroke * 0.5) : cfg.stroke;
  const mid = h / 2;
  const reach = mid - cfg.pad;
  const minLen = size === 'xs' ? 1.5 : 2;

  return (
    <svg
      role="img"
      aria-label={label}
      width="100%"
      height={h}
      className={cx('block overflow-visible', className)}
    >
      <line x1="0" x2="100%" y1={mid} y2={mid} stroke="var(--line-strong)" strokeWidth="1" />
      {ticks.map((t, i) => {
        const len = Math.max(minLen, t.r * reach);
        const up = t.net >= 0;
        const x = `${((i + 0.5) / slots) * 100}%`;
        const color = t.o === 'win' ? 'var(--gain)' : t.o === 'loss' ? 'var(--loss)' : 'var(--flat)';
        const isNew = animateId === t.id;
        return (
          <line
            key={t.id}
            x1={x}
            x2={x}
            y1={mid}
            y2={up ? mid - len : mid + len}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="butt"
            className={isNew ? cx('tick-new', !up && 'tick-down') : undefined}
          />
        );
      })}
    </svg>
  );
}

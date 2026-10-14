// The insight that compounds: what mistakes cost, the setup that pays, the weekday that bleeds.
// Three quiet lines over the last 30 days. It appears on Today (after the bell) and leads Insights, so the
// trader never hunts for it, and it hides itself until there's enough data to be honest (≥ 10 trades).

import { useMemo } from 'react';
import { ArrowRight, Check, TriangleAlert } from 'lucide-react';
import type { Trade } from '../lib/types';
import { breakdown, type BreakdownRow } from '../lib/stats';
import { netPnl } from '../lib/pnl';
import { formatPct } from '../lib/format';
import { addDays } from '../lib/dates';
import { href } from '../app/router';
import { Money } from '../ui/Money';
import { cx } from '../ui/controls';

const MIN_TRADES = 10;
const MIN_GROUP = 3;

export interface Edge {
  count: number;
  mistakes: { cost: number; trades: number; worst: BreakdownRow | null } | null;
  bestSetup: BreakdownRow | null;
  bestDay: BreakdownRow | null;
  worstDay: BreakdownRow | null;
}

export function computeEdge(trades: Trade[], band: number): Edge {
  const tagged = trades.filter((t) => t.mistakes && t.mistakes.length > 0);
  const mistakeRows = breakdown(tagged, 'mistake', band);
  const worst = [...mistakeRows].sort((a, b) => a.net - b.net)[0] ?? null;
  const setups = breakdown(trades, 'setup', band).filter((r) => r.key !== '' && r.count >= MIN_GROUP);
  const days = breakdown(trades, 'weekday', band).filter((r) => r.count >= MIN_GROUP);
  const bestDay = days[0] && days[0].net > 0 ? days[0] : null;
  const last = days[days.length - 1];
  const worstDay = last && last.net < 0 && last !== bestDay ? last : null;
  return {
    count: trades.length,
    mistakes: tagged.length ? { cost: tagged.reduce((s, t) => s + netPnl(t), 0), trades: tagged.length, worst: worst && worst.net < 0 ? worst : null } : null,
    bestSetup: setups[0] && setups[0].net > 0 ? setups[0] : null,
    bestDay,
    worstDay,
  };
}

export function useEdge(trades: Trade[], band: number, today: string, days = 30): Edge {
  return useMemo(() => {
    const from = addDays(today, -(days - 1));
    return computeEdge(trades.filter((t) => t.date >= from && t.date <= today), band);
  }, [trades, band, today, days]);
}

export function EdgeCard({ edge, band, title = 'Last 30 days', link = true, className }: { edge: Edge; band: number; title?: string; link?: boolean; className?: string }) {
  if (edge.count < MIN_TRADES) return null;
  const rows: { k: string; label: string; value: React.ReactNode; sub?: React.ReactNode }[] = [];
  if (edge.mistakes) {
    rows.push({
      k: 'mistakes',
      label: edge.mistakes.cost < 0 ? 'Mistakes cost' : 'Mistake trades',
      value: <Money value={edge.mistakes.cost} flatBand={band} />,
      sub: edge.mistakes.worst ? (
        <>
          worst: {edge.mistakes.worst.label} <Money value={edge.mistakes.worst.net} className="text-caption" />
        </>
      ) : (
        `${edge.mistakes.trades} tagged trade${edge.mistakes.trades === 1 ? '' : 's'}`
      ),
    });
  }
  if (edge.bestSetup) {
    rows.push({
      k: 'setup',
      label: 'Best setup',
      value: <Money value={edge.bestSetup.net} flatBand={band} />,
      sub: `${edge.bestSetup.label} · ${edge.bestSetup.count} trades · ${formatPct(edge.bestSetup.winRate)} win`,
    });
  }
  if (edge.bestDay || edge.worstDay) {
    const d = edge.worstDay ?? edge.bestDay!;
    rows.push({
      k: 'weekday',
      label: edge.worstDay ? 'Weakest day' : 'Best day',
      value: <Money value={d.net} flatBand={band} />,
      sub: (
        <>
          {d.label} · {d.count} trades
          {edge.worstDay && edge.bestDay && (
            <>
              {' '}· best {edge.bestDay.label} <Money value={edge.bestDay.net} className="text-caption" />
            </>
          )}
        </>
      ),
    });
  }
  if (!rows.length) return null;
  return (
    <section className={cx('card @container', className)} aria-labelledby="edge-title" data-testid="edge-card">
      <div className="flex min-h-11 items-center justify-between gap-2 border-b border-line pr-1 pl-4 md:pl-5">
        <h2 id="edge-title" className="caption">
          {title}
        </h2>
        {link && (
          <a href={href('insights')} className="inline-flex min-h-11 items-center gap-1 rounded-control px-3 text-body text-ink-2 hover:text-ink-1">
            Insights <ArrowRight size={14} aria-hidden />
          </a>
        )}
      </div>
      {/* Stacked in narrow columns; three across once the card is ≥ 28rem wide (container query). */}
      <dl className="grid divide-y divide-line-soft @md:grid-cols-3 @md:divide-x @md:divide-y-0">
        {rows.map((r) => (
          <div key={r.k} className="flex min-w-0 items-start justify-between gap-3 px-4 py-2.5 @md:flex-col @md:justify-start @md:gap-0.5 @md:py-4 md:px-5">
            <div className="min-w-0 @md:contents">
              <dt className="text-body text-ink-1 @md:order-1 @md:text-ink-2">{r.label}</dt>
              {r.sub && <dd className="truncate text-caption text-ink-3 @md:order-3 @md:max-w-full">{r.sub}</dd>}
            </div>
            <dd className="shrink-0 text-body @md:order-2 @md:text-[17px] @md:leading-6">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** "How did I do, what went wrong, am I done?" — one row of facts under the hero after trades exist. */
export function DayVerdict({ trades, band, closed, onClose }: { trades: Trade[]; band: number; closed: boolean; onClose: () => void }) {
  const v = useMemo(() => {
    const tagged = trades.filter((t) => t.mistakes && t.mistakes.length);
    const names = [...new Set(tagged.flatMap((t) => t.mistakes ?? []))];
    const setups = breakdown(trades, 'setup', band).filter((r) => r.key !== '' && r.net > band);
    return { tagged, names, cost: tagged.reduce((s, t) => s + netPnl(t), 0), best: setups[0] ?? null };
  }, [trades, band]);
  if (!trades.length) return null;
  const pill = 'inline-flex h-8 max-w-full items-center gap-1.5 rounded-control border px-2.5 text-body';
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Day summary" data-testid="day-verdict">
      <li className="min-w-0">
        {v.tagged.length ? (
          <span className={cx(pill, 'border-[color-mix(in_oklab,var(--warn)_40%,transparent)] bg-warn-tint text-ink-1')}>
            <TriangleAlert size={14} className="shrink-0 text-warn" aria-hidden />
            <span className="truncate">{v.names.join(', ')}</span>
            <Money value={v.cost} flatBand={band} className="shrink-0" />
          </span>
        ) : (
          <span className={cx(pill, 'border-line bg-inset text-ink-2')}>No mistakes tagged</span>
        )}
      </li>
      {v.best && (
        <li className="min-w-0">
          <span className={cx(pill, 'border-line bg-inset text-ink-2')}>
            <span className="truncate">{v.best.label}</span>
            <Money value={v.best.net} flatBand={band} className="shrink-0" />
          </span>
        </li>
      )}
      <li>
        {closed ? (
          <span className={cx(pill, 'border-line bg-inset text-ink-2')}>
            <Check size={14} className="text-gain" aria-hidden /> Day closed
          </span>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className={cx(
              pill,
              "relative border-[color-mix(in_oklab,var(--brand)_55%,transparent)] bg-brand-tint text-ink-1 transition-colors duration-[120ms] after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] hover:bg-[color-mix(in_oklab,var(--brand)_22%,transparent)]",
            )}
          >
            Close the day <ArrowRight size={14} aria-hidden />
          </button>
        )}
      </li>
    </ul>
  );
}

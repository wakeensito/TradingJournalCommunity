// One quiet line of market context for a day: `ES +0.42% · NQ −1.10% · VIX 18.2 ▲` + USD event pills (ET).
// Loading → a skeleton line. Error or nothing to say → renders nothing (context is a nice-to-have, never an alarm).

import { useState } from 'react';
import { cx } from '@/ui/controls';
import {
  type ApiGet,
  type IndexQuote,
  type MarketEvent,
  type VixQuote,
  formatChangePct,
  shortTime,
  trendClass,
} from './market';
import { useMarketDay } from './useMarket';

export interface MarketContextStripProps {
  apiGet: ApiGet;
  date: string;
  /** Event pills shown before a "+N" expander (default 4). 0 hides events entirely. */
  maxEvents?: number;
  className?: string;
}

export function MarketContextStrip({ apiGet, date, maxEvents = 4, className }: MarketContextStripProps) {
  const { data, loading, error } = useMarketDay(apiGet, date);
  const [showAll, setShowAll] = useState(false);

  if (loading && !data) {
    return (
      <div className={cx('flex h-8 items-center', className)} aria-hidden>
        <div className="skeleton h-4 w-[min(320px,80%)]" />
      </div>
    );
  }
  if (error || !data) return null;

  const { ES, NQ } = data.indices;
  const hasQuotes = !!(ES || NQ || data.vix);
  const events = maxEvents > 0 ? data.events : [];
  if (!hasQuotes && !events.length) return null;

  const visible = showAll ? events : events.slice(0, maxEvents);
  const hidden = events.length - visible.length;

  return (
    <div
      role="group"
      aria-label="Market context (times ET)"
      className={cx('scroll-x flex min-h-8 items-center gap-3 whitespace-nowrap', className)}
    >
      {hasQuotes && (
        <div className="flex shrink-0 items-center gap-2 text-body">
          {ES && <IndexItem label="ES" q={ES} />}
          {ES && NQ && <Dot />}
          {NQ && <IndexItem label="NQ" q={NQ} />}
          {(ES || NQ) && data.vix && <Dot />}
          {data.vix && <VixItem q={data.vix} />}
        </div>
      )}
      {hasQuotes && events.length > 0 && <span aria-hidden className="h-4 w-px shrink-0 bg-line-strong" />}
      {events.length > 0 && (
        <ul className="flex shrink-0 items-center gap-1.5" aria-label="Economic events, Eastern time">
          {visible.map((e, i) => (
            <li key={`${e.time}-${e.title}-${i}`}>
              <EventPill e={e} />
            </li>
          ))}
          {hidden > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="relative inline-flex h-6 items-center rounded-[6px] border border-line px-2 text-caption text-ink-3 transition-colors duration-[var(--dur-fast)] after:absolute after:-inset-2.5 after:content-[''] hover:border-line-strong hover:text-ink-1 focus-visible:shadow-[var(--focus)] focus-visible:outline-none active:bg-surface-2"
                aria-label={`Show ${hidden} more events`}
              >
                +{hidden}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-ink-4">
      ·
    </span>
  );
}

function IndexItem({ label, q }: { label: string; q: IndexQuote }) {
  return (
    <span className="inline-flex items-baseline gap-1.5" title={`${label} settle ${q.close.toLocaleString('en-US')}`}>
      <span className="caption">{label}</span>
      <span className={cx('num', trendClass(q.changePct))}>{formatChangePct(q.changePct)}</span>
    </span>
  );
}

function VixItem({ q }: { q: VixQuote }) {
  const dir = q.change === null || Math.abs(q.change) < 0.005 ? null : q.change > 0 ? 'up' : 'down';
  const label = `VIX ${q.close.toFixed(1)}${dir ? `, ${dir} ${Math.abs(q.change ?? 0).toFixed(2)}` : ''}`;
  return (
    <span className="inline-flex items-baseline gap-1.5" aria-label={label} title={label}>
      <span className="caption">VIX</span>
      <span className="num text-ink-1">{q.close.toFixed(1)}</span>
      {dir && (
        <span aria-hidden className="text-[10px] leading-none text-ink-3">
          {dir === 'up' ? '▲' : '▼'}
        </span>
      )}
    </span>
  );
}

function eventDetail(e: MarketEvent): string {
  const bits = [
    e.actual && `actual ${e.actual}`,
    e.forecast && `forecast ${e.forecast}`,
    e.previous && `previous ${e.previous}`,
  ].filter(Boolean);
  return `${shortTime(e.time)} ET · ${e.title} (${e.impact} impact)${bits.length ? ` · ${bits.join(', ')}` : ''}`;
}

function EventPill({ e }: { e: MarketEvent }) {
  const high = e.impact === 'high';
  return (
    <span
      title={eventDetail(e)}
      aria-label={eventDetail(e)}
      className={cx(
        'inline-flex h-6 max-w-[22ch] items-center gap-1.5 rounded-[6px] border px-2 text-caption',
        high
          ? 'border-[color-mix(in_oklab,var(--warn)_40%,transparent)] bg-warn-tint text-ink-1'
          : 'border-line bg-inset text-ink-2',
      )}
    >
      <span className={cx('num', high ? 'text-warn' : 'text-ink-3')}>{shortTime(e.time)}</span>
      <span className="truncate">{e.title}</span>
    </span>
  );
}

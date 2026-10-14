import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useData } from '../lib/store';
import { dailySeries, type DayPoint } from '../lib/stats';
import { isSameMonth, monthMatrix, todayLocal, fromDateStr } from '../lib/dates';
import { formatMoney, formatPct } from '../lib/format';
import { PageHeader } from '../app/Shell';
import { useAppUi } from '../app/ui-context';
import { dayLabel, monthLabel } from '../app/domain';
import { Button, IconButton, cx } from '../ui/controls';
import { Money } from '../ui/Money';
import { SessionTape } from '../ui/SessionTape';
import { EmptyState } from '../ui/states';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarScreen() {
  const { trades, days, settings } = useData();
  const ui = useAppUi();
  const today = todayLocal();
  const band = settings.breakevenBand;
  const t0 = fromDateStr(today);
  const [ym, setYm] = useState({ y: t0.getFullYear(), m: t0.getMonth() });

  const byDate = useMemo(() => {
    const m = new Map<string, DayPoint>();
    for (const p of dailySeries(trades)) m.set(p.date, p);
    return m;
  }, [trades]);
  const noted = useMemo(
    () => new Set(days.filter((d) => d.review?.text || d.plan?.focus || d.plan?.levels || d.review?.followedPlan != null).map((d) => d.date)),
    [days],
  );

  const weeks = useMemo(() => {
    const rows = monthMatrix(ym.y, ym.m).filter((row) => row.some((d) => isSameMonth(d, ym.y, ym.m)));
    return rows.map((row) => {
      const pts = row.filter((d) => isSameMonth(d, ym.y, ym.m)).map((d) => byDate.get(d)).filter((p): p is DayPoint => !!p);
      return { row, net: pts.reduce((s, p) => s + p.net, 0), days: pts.length, trades: pts.reduce((s, p) => s + p.count, 0) };
    });
  }, [ym, byDate]);

  const month = useMemo(() => {
    const pts = [...byDate.values()].filter((p) => isSameMonth(p.date, ym.y, ym.m));
    const green = pts.filter((p) => p.net > band).length;
    const red = pts.filter((p) => p.net < -band).length;
    return {
      net: pts.reduce((s, p) => s + p.net, 0),
      days: pts.length,
      trades: pts.reduce((s, p) => s + p.count, 0),
      dayWin: green + red ? green / (green + red) : null,
    };
  }, [byDate, ym, band]);

  const shift = (n: number) => setYm(({ y, m }) => {
    const d = new Date(y, m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const isCurrent = ym.y === t0.getFullYear() && ym.m === t0.getMonth();

  return (
    <div>
      <PageHeader
        title="Calendar"
        actions={
          !isCurrent && (
            <Button size="sm" variant="ghost" onClick={() => setYm({ y: t0.getFullYear(), m: t0.getMonth() })}>
              Today
            </Button>
          )
        }
      />

      <div className="mb-4 flex items-center gap-1">
        <IconButton label="Previous month" onClick={() => shift(-1)} className="-ml-3">
          <ChevronLeft size={20} />
        </IconButton>
        <h2 className="min-w-0 flex-1 truncate text-center text-[17px] leading-6 font-semibold md:flex-none md:text-left" aria-live="polite">
          {monthLabel(ym.y, ym.m)}
        </h2>
        <IconButton label="Next month" onClick={() => shift(1)} className="max-md:-mr-3">
          <ChevronRight size={20} />
        </IconButton>
        <div className="ml-auto hidden items-baseline gap-4 md:flex">
          <MonthMeta month={month} band={band} />
        </div>
      </div>
      <div className="mb-4 flex items-baseline justify-between gap-3 md:hidden">
        <MonthMeta month={month} band={band} />
      </div>

      <div className="card overflow-hidden" role="grid" aria-label={`P&L calendar, ${monthLabel(ym.y, ym.m)}`}>
        <div role="row" className="grid grid-cols-7 border-b border-line md:grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.1fr)]">
          {WEEKDAYS.map((w) => (
            <div key={w} role="columnheader" className="caption py-2 text-center">
              {w}
            </div>
          ))}
          <div role="columnheader" className="caption hidden border-l border-line py-2 text-center md:block">
            Week
          </div>
        </div>
        {weeks.map((wk, i) => (
          <div
            key={wk.row[0]}
            role="row"
            className={cx('grid grid-cols-7 md:grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.1fr)]', i > 0 && 'border-t border-line-soft')}
          >
            {wk.row.map((d) => (
              <DayCell
                key={d}
                date={d}
                inMonth={isSameMonth(d, ym.y, ym.m)}
                isToday={d === today}
                point={byDate.get(d)}
                noted={noted.has(d)}
                band={band}
                onOpen={() => ui.openDay(d)}
              />
            ))}
            <div role="gridcell" className="hidden flex-col items-end justify-center gap-0.5 border-l border-line bg-bg/40 px-3 md:flex">
              {wk.days > 0 ? (
                <>
                  <Money value={wk.net} flatBand={band} className="text-body" />
                  <span className="num text-caption text-ink-3">
                    {wk.days}d · {wk.trades}t
                  </span>
                </>
              ) : (
                <span className="text-caption text-ink-4">—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Weekly totals (mobile: below the grid; desktop: the Week column). */}
      <section aria-label="Weekly totals" className="mt-4 md:hidden">
        <h2 className="caption mb-2">Weeks</h2>
        <ul className="card divide-y divide-line-soft">
          {weeks.map((wk) => {
            const inMonth = wk.row.filter((d) => isSameMonth(d, ym.y, ym.m));
            return (
              <li key={wk.row[0]} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
                <span className="text-body text-ink-2">
                  {dayLabel(inMonth[0]!, { month: 'short', day: 'numeric' })} – {dayLabel(inMonth[inMonth.length - 1]!, { day: 'numeric' })}
                  <span className="num ml-2 text-caption text-ink-3">{wk.days ? `${wk.days}d · ${wk.trades}t` : ''}</span>
                </span>
                {wk.days ? <Money value={wk.net} flatBand={band} className="text-body" /> : <span className="text-caption text-ink-4">—</span>}
              </li>
            );
          })}
        </ul>
      </section>

      {trades.length === 0 && (
        <EmptyState
          className="mt-4"
          title="Your calendar fills in as you trade"
          body="Each day turns green or red with its own tape."
          action={
            <Button variant="primary" onClick={ui.openQuickLog}>
              Log a trade
            </Button>
          }
          secondary={<Button onClick={ui.openImport}>Import a CSV</Button>}
        />
      )}
    </div>
  );
}

function MonthMeta({ month, band }: { month: { net: number; days: number; trades: number; dayWin: number | null }; band: number }) {
  return (
    <>
      <Money value={month.net} flatBand={band} className="text-[17px]" />
      <span className="num text-caption text-ink-3">
        <span className="whitespace-nowrap">{month.days} day{month.days === 1 ? '' : 's'}</span> · <span className="whitespace-nowrap">{month.trades} trades</span> ·{' '}
        <span className="whitespace-nowrap">{formatPct(month.dayWin)} green</span>
      </span>
    </>
  );
}

function DayCell({
  date,
  inMonth,
  isToday,
  point,
  noted,
  band,
  onOpen,
}: {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  point?: DayPoint;
  noted: boolean;
  band: number;
  onOpen: () => void;
}) {
  const n = fromDateStr(date).getDate();
  const tone = point && inMonth ? (point.net > band ? 'gain' : point.net < -band ? 'loss' : 'flat') : null;
  const label = `${dayLabel(date, { weekday: 'long', month: 'long', day: 'numeric' })}${
    point ? `, ${point.count} trade${point.count === 1 ? '' : 's'}, net ${formatMoney(point.net, { sign: true })}` : ', no trades'
  }${noted ? ', has notes' : ''}`;
  return (
    <div role="gridcell" className="min-w-0 border-line-soft [&:not(:first-child)]:border-l">
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        data-date={date}
        className={cx(
          'flex h-[68px] w-full min-w-0 flex-col justify-between overflow-hidden px-1 pt-1 pb-1 text-left transition-colors duration-[120ms] md:h-[92px] md:px-2 md:pt-1.5',
          tone === 'gain' && 'bg-gain-tint hover:bg-[color-mix(in_oklab,var(--gain)_18%,transparent)]',
          tone === 'loss' && 'bg-loss-tint hover:bg-[color-mix(in_oklab,var(--loss)_18%,transparent)]',
          (!tone || tone === 'flat') && 'hover:bg-surface-2',
        )}
      >
        <span className="flex items-center justify-between gap-1">
          <span
            className={cx(
              'num grid h-5 min-w-5 place-items-center rounded-full text-[11px] leading-none md:text-caption',
              !inMonth ? 'text-ink-4' : isToday ? 'bg-ink-1 px-1 text-bg' : 'text-ink-3',
            )}
          >
            {n}
          </span>
          {noted && inMonth && <span aria-hidden className="mr-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-2" />}
        </span>
        {point && inMonth ? (
          <>
            <SessionTape trades={point.trades} size="xs" band={band} height={16} />
            <Money value={point.net} flatBand={band} compact className="block truncate text-[10px] leading-3 md:text-caption" />
          </>
        ) : (
          <span />
        )}
      </button>
    </div>
  );
}

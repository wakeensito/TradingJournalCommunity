import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { Trade } from '../lib/types';
import { useData } from '../lib/store';
import { api, ApiError } from '../lib/api';
import { breakdown, computeStats, dailySeries, type BreakdownKey, type BreakdownRow, type Stats } from '../lib/stats';
import { netPnl, rMultiple } from '../lib/pnl';
import { formatMoney, formatPct } from '../lib/format';
import { addDays, startOfWeek, todayLocal } from '../lib/dates';
import { PageHeader } from '../app/Shell';
import { useAppUi } from '../app/ui-context';
import { useTokens } from '../app/theme';
import { dayLabel } from '../app/domain';
import { Button, SegmentedControl, TextInput, cx } from '../ui/controls';
import { Money } from '../ui/Money';
import { TickerStrip } from '../ui/TickerStrip';
import { EmptyState, Skeleton } from '../ui/states';
import { EdgeCard, computeEdge } from '../features/Edge';

type Range = '7d' | '30d' | '90d' | 'all';
const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 };

export function Insights() {
  const { trades, settings } = useData();
  const ui = useAppUi();
  const band = settings.breakevenBand;
  const today = todayLocal();
  const [range, setRange] = useState<Range>('30d');

  const from = range === 'all' ? null : addDays(today, -(RANGE_DAYS[range] - 1));
  const inRange = useMemo(() => (from ? trades.filter((t) => t.date >= from) : trades), [trades, from]);
  const stats = useMemo(() => computeStats(inRange, band), [inRange, band]);
  const series = useMemo(() => dailySeries(inRange), [inRange]);
  const edge = useMemo(() => computeEdge(inRange, band), [inRange, band]);

  const rangeControl = (cls: string) => (
    <SegmentedControl
      label="Range"
      size="sm"
      value={range}
      onChange={setRange}
      className={cls}
      options={[
        { value: '7d', label: '7D' },
        { value: '30d', label: '30D' },
        { value: '90d', label: '90D' },
        { value: 'all', label: 'All' },
      ]}
    />
  );
  const header = (
    <>
      <PageHeader title="Insights" actions={<div className="hidden md:block">{rangeControl('w-[240px]')}</div>} />
      <div className="-mt-2 mb-4 md:hidden">{rangeControl('w-full')}</div>
    </>
  );

  if (!trades.length) {
    return (
      <div>
        {header}
        <div className="card">
          <EmptyState
            title="Insights need a few trades"
            body="Log or import trades and this page turns into your edge: what works, and what your mistakes cost."
            action={<Button variant="primary" onClick={ui.openQuickLog}>Log a trade</Button>}
            secondary={<Button onClick={ui.openImport}>Import a CSV</Button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
      {inRange.length === 0 ? (
        <div className="card">
          <EmptyState title="No trades in this range" body="Pick a longer range to see your stats." action={<Button onClick={() => setRange('all')}>Show all time</Button>} />
        </div>
      ) : (
        <div className="flex flex-col gap-4 md:gap-5">
          <TickerStrip
            items={[
              { label: 'Net P&L', value: <Money value={stats.net} flatBand={band} /> },
              { label: 'Win %', value: formatPct(stats.winRate), title: 'Wins ÷ (wins + losses). Breakevens excluded.' },
              { label: 'Profit factor', value: stats.profitFactor === null ? '—' : stats.profitFactor.toFixed(2), title: 'Gross wins ÷ gross losses' },
              { label: 'Avg win', value: stats.avgWin === null ? '—' : <span className="text-gain">{formatMoney(stats.avgWin, { sign: true })}</span> },
              { label: 'Avg loss', value: stats.avgLoss === null ? '—' : <span className="text-loss">{formatMoney(-stats.avgLoss)}</span> },
              { label: 'Day win %', value: formatPct(stats.dayWinRate) },
              { label: 'Trades', value: String(stats.count) },
            ]}
          />

          <EdgeCard edge={edge} band={band} link={false} title={range === 'all' ? 'What compounds · all time' : `What compounds · last ${RANGE_DAYS[range]} days`} />

          <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <ChartCard title="Equity" aside={<Money value={stats.net} flatBand={band} className="text-body" />}>
              <EquityChart series={series} />
            </ChartCard>
            <ChartCard title="Daily P&L" aside={<span className="num text-caption text-ink-3">{series.length} days</span>}>
              <DailyBars series={series} band={band} />
            </ChartCard>
          </div>

          <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
            <MistakeCost trades={inRange} band={band} net={stats.net} onLog={ui.openQuickLog} />
            <Breakdowns trades={inRange} band={band} />
          </div>

          <DeeperStats stats={stats} trades={inRange} />
          <CoachCard from={from ?? series[0]?.date ?? today} to={today} rangeLabel={range === 'all' ? 'all time' : `last ${RANGE_DAYS[range]} days`} />
        </div>
      )}
    </div>
  );
}

// ---------- charts ----------

function ChartCard({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card min-w-0 p-4 md:p-5" aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[15px] leading-6 font-semibold">{title}</h2>
        {aside}
      </div>
      <div className="h-[200px] md:h-[240px]">{children}</div>
    </section>
  );
}

const axisTick = { fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 };

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number; payload: { date: string; net: number; cum: number; count: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  return (
    <div className="rounded-control border border-line-strong bg-surface-2 px-3 py-2 text-caption" style={{ boxShadow: 'var(--sheet-shadow)' }}>
      <p className="text-ink-3">{dayLabel(p.date ?? label ?? '')}</p>
      <p className="num mt-0.5">
        day <Money value={p.net} className="text-caption" /> · {p.count}t
      </p>
      <p className="num text-ink-2">total {formatMoney(p.cum, { sign: true })}</p>
    </div>
  );
}

function EquityChart({ series }: { series: { date: string; net: number; cum: number; count: number }[] }) {
  const tk = useTokens();
  const gid = useId().replace(/:/g, '');
  // Prepend a zero point so the curve starts from flat.
  const data = series.length ? [{ date: '', net: 0, cum: 0, count: 0 }, ...series] : [];
  const vals = data.map((d) => d.cum);
  const max = Math.max(0, ...vals);
  const min = Math.min(0, ...vals);
  const off = max - min === 0 ? 1 : max / (max - min);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`eq-fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset={0} stopColor={tk.gain} stopOpacity={0.22} />
            <stop offset={off} stopColor={tk.gain} stopOpacity={0.04} />
            <stop offset={off} stopColor={tk.loss} stopOpacity={0.04} />
            <stop offset={1} stopColor={tk.loss} stopOpacity={0.22} />
          </linearGradient>
          <linearGradient id={`eq-line-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset={off} stopColor={tk.gain} />
            <stop offset={off} stopColor={tk.loss} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" hide />
        <YAxis
          width={52}
          tick={{ ...axisTick, fill: tk.ink3 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatMoney(v, { compact: true })}
        />
        <ReferenceLine y={0} stroke={tk.lineStrong} />
        <Tooltip content={<ChartTip />} cursor={{ stroke: tk.lineStrong }} />
        <Area type="monotone" dataKey="cum" stroke={`url(#eq-line-${gid})`} strokeWidth={2} fill={`url(#eq-fill-${gid})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DailyBars({ series, band }: { series: { date: string; net: number; cum: number; count: number }[]; band: number }) {
  const tk = useTokens();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey="date" hide />
        <YAxis width={52} tick={{ ...axisTick, fill: tk.ink3 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatMoney(v, { compact: true })} />
        <ReferenceLine y={0} stroke={tk.lineStrong} />
        <Tooltip content={<ChartTip />} cursor={{ fill: tk.line }} />
        <Bar dataKey="net" isAnimationActive={false} maxBarSize={18}>
          {series.map((d) => (
            <Cell key={d.date} fill={d.net > band ? tk.gain : d.net < -band ? tk.loss : tk.flat} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- cost of mistakes (hero insight) ----------

function MistakeCost({ trades, band, net, onLog }: { trades: Trade[]; band: number; net: number; onLog: () => void }) {
  const rows = useMemo(() => breakdown(trades, 'mistake', band).sort((a, b) => a.net - b.net), [trades, band]);
  const tagged = useMemo(() => trades.filter((t) => t.mistakes && t.mistakes.length > 0), [trades]);
  const cost = useMemo(() => tagged.reduce((s, t) => s + netPnl(t), 0), [tagged]);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)));

  return (
    <section className="card p-4 md:p-5" aria-labelledby="mistake-cost">
      <h2 id="mistake-cost" className="caption">
        Cost of mistakes
      </h2>
      {rows.length === 0 ? (
        <div className="mt-3">
          <p className="text-[17px] leading-6 font-semibold">No mistakes tagged in this range.</p>
          <p className="mt-1 text-body text-ink-3">
            Tag a mistake when you log (FOMO entry, moved stop…). This card then shows exactly what each habit costs you.
          </p>
          <Button size="sm" className="mt-4" onClick={onLog}>
            Log a trade
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-body text-ink-2">
            {tagged.length} tagged trade{tagged.length === 1 ? '' : 's'} netted <Money value={cost} className="text-body" /> · without them you’d be at{' '}
            <Money value={net - cost} className="text-body" />
          </p>
          <ul className="mt-4 flex flex-col gap-3" data-testid="mistake-rows">
            {rows.map((r) => (
              <li key={r.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-body">
                    {r.label} <span className="num text-caption text-ink-3">×{r.count}</span>
                  </span>
                  <Money value={r.net} flatBand={band} className="text-body" />
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-inset">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(Math.abs(r.net) / max) * 100}%`, background: r.net < 0 ? 'var(--loss)' : 'var(--gain)', opacity: 0.8 }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ---------- breakdowns ----------

function Breakdowns({ trades, band }: { trades: Trade[]; band: number }) {
  const [key, setKey] = useState<Exclude<BreakdownKey, 'mistake'>>('setup');
  const rows = useMemo(() => {
    const r = breakdown(trades, key, band);
    if (key === 'weekday' || key === 'hour') return [...r].sort((a, b) => (a.key === '' ? 1 : b.key === '' ? -1 : a.key.localeCompare(b.key)));
    return r;
  }, [trades, key, band]);
  return (
    <section className="card min-w-0 p-4 md:p-5" aria-labelledby="bd-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="bd-title" className="text-[15px] leading-6 font-semibold">
          Breakdown
        </h2>
        <SegmentedControl
          label="Breakdown by"
          size="sm"
          value={key}
          onChange={setKey}
          className="w-full sm:w-auto sm:min-w-[300px]"
          options={[
            { value: 'setup', label: 'Setup' },
            { value: 'symbol', label: 'Symbol' },
            { value: 'weekday', label: 'Day' },
            { value: 'hour', label: 'Hour' },
          ]}
        />
      </div>
      <BreakdownTable rows={rows} band={band} />
    </section>
  );
}

function BreakdownTable({ rows, band }: { rows: BreakdownRow[]; band: number }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  if (!rows.length) return <p className="text-body text-ink-3">Nothing to break down yet.</p>;
  return (
    <table className="w-full table-fixed text-body">
      <thead>
        <tr className="text-left">
          <th className="caption pb-2 font-medium">Group</th>
          <th className="caption w-12 pb-2 text-right font-medium">#</th>
          <th className="caption w-14 pb-2 text-right font-medium">Win</th>
          <th className="caption w-[96px] pb-2 text-right font-medium sm:w-[112px]">Net</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-line-soft">
            <td className="py-2 pr-2">
              <span className={cx('block truncate', r.key === '' && 'text-ink-3')}>{r.label}</span>
              <span className="mt-1 block h-1 rounded-full bg-inset">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${(Math.abs(r.net) / max) * 100}%`, background: r.net > band ? 'var(--gain)' : r.net < -band ? 'var(--loss)' : 'var(--flat)', opacity: 0.7 }}
                />
              </span>
            </td>
            <td className="num py-2 text-right text-ink-2">{r.count}</td>
            <td className="num py-2 text-right text-ink-2">{formatPct(r.winRate)}</td>
            <td className="py-2 text-right">
              <Money value={r.net} flatBand={band} compact className="text-body" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- deeper stats (collapsed) ----------

function DeeperStats({ stats, trades }: { stats: Stats; trades: Trade[] }) {
  const [open, setOpen] = useState(false);
  const rs = useMemo(() => trades.map(rMultiple).filter((r): r is number => r !== null), [trades]);
  const buckets = useMemo(() => {
    const defs = [
      { label: '≤ −2R', test: (r: number) => r <= -2 },
      { label: '−2 to −1R', test: (r: number) => r > -2 && r <= -1 },
      { label: '−1 to 0R', test: (r: number) => r > -1 && r < 0 },
      { label: '0 to 1R', test: (r: number) => r >= 0 && r < 1 },
      { label: '1 to 2R', test: (r: number) => r >= 1 && r < 2 },
      { label: '≥ 2R', test: (r: number) => r >= 2 },
    ];
    return defs.map((d, i) => ({ ...d, n: rs.filter(d.test).length, neg: i < 3 }));
  }, [rs]);
  const bmax = Math.max(1, ...buckets.map((b) => b.n));
  const streak = stats.currentStreak;

  const items: [string, ReactNode][] = [
    ['Expectancy', stats.expectancy === null ? '—' : <Money value={stats.expectancy} />],
    ['Payoff ratio', stats.payoff === null ? '—' : stats.payoff.toFixed(2)],
    ['Max drawdown', stats.maxDrawdown ? <span className="text-loss">{formatMoney(-stats.maxDrawdown)}</span> : '$0.00'],
    ['Best day', stats.bestDay ? <span><Money value={stats.bestDay.net} /> <span className="text-ink-3">{dayLabel(stats.bestDay.date, { month: 'short', day: 'numeric' })}</span></span> : '—'],
    ['Worst day', stats.worstDay ? <span><Money value={stats.worstDay.net} /> <span className="text-ink-3">{dayLabel(stats.worstDay.date, { month: 'short', day: 'numeric' })}</span></span> : '—'],
    ['Current streak', streak.kind === 'none' ? '—' : <span className={streak.kind === 'win' ? 'text-gain' : 'text-loss'}>{streak.length} {streak.kind === 'win' ? 'W' : 'L'}</span>],
    ['Longest win streak', String(stats.longestWinStreak)],
    ['Longest loss streak', String(stats.longestLossStreak)],
    ['Avg R', stats.avgR === null ? '—' : `${stats.avgR.toFixed(2)}R`],
    ['Gross', <Money value={stats.gross} />],
    ['Fees', formatMoney(stats.fees)],
    ['Trading days', String(stats.tradingDays)],
  ];

  return (
    <section className="card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-card px-4 text-left md:px-5"
      >
        <span>
          <span className="font-semibold">Deeper stats</span>
          {!open && <span className="ml-2 text-body text-ink-3">Expectancy, drawdown, streaks, R</span>}
        </span>
        <ChevronDown size={16} className={cx('shrink-0 text-ink-3 transition-transform duration-[180ms]', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid gap-6 border-t border-line px-4 py-4 md:grid-cols-2 md:px-5 md:py-5">
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2.5 text-body">
            {items.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-3">{k}</dt>
                <dd className="num text-right text-ink-1">{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <p className="caption mb-3">R distribution</p>
            {rs.length === 0 ? (
              <p className="text-body text-ink-3">Add a stop when you log to see R multiples.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {buckets.map((b) => (
                  <li key={b.label} className="grid grid-cols-[84px_minmax(0,1fr)_32px] items-center gap-3">
                    <span className="num text-caption text-ink-3">{b.label}</span>
                    <span className="h-2 rounded-full bg-inset">
                      <span className="block h-full rounded-full" style={{ width: `${(b.n / bmax) * 100}%`, background: b.neg ? 'var(--loss)' : 'var(--gain)', opacity: 0.7 }} />
                    </span>
                    <span className="num text-right text-caption text-ink-2">{b.n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- AI coach ----------

function CoachCard({ from, to, rangeLabel }: { from: string; to: string; rangeLabel: string }) {
  const [q, setQ] = useState('');
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'loading'; what: string } | { kind: 'ok'; text: string; what: string } | { kind: 'error'; msg: string; retry: () => void }>({ kind: 'idle' });

  async function ask(f: string, t: string, question: string | undefined, what: string) {
    setState({ kind: 'loading', what });
    try {
      const r = await api.coach(f, t, question);
      setState({ kind: 'ok', text: r.text, what });
    } catch (e) {
      setState({
        kind: 'error',
        msg: e instanceof ApiError ? (e.status === 0 ? 'You’re offline.' : e.message) : 'The coach didn’t answer.',
        retry: () => void ask(f, t, question, what),
      });
    }
  }

  const today = todayLocal();
  const reviewWeek = () => ask(startOfWeek(today), today, undefined, 'This week');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    void ask(from, to, q.trim(), `“${q.trim()}” · ${rangeLabel}`);
  };
  const busy = state.kind === 'loading';

  return (
    <section className="card p-4 md:p-5" aria-labelledby="coach-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="coach-title" className="flex items-center gap-2 text-[15px] leading-6 font-semibold">
            <Sparkles size={16} className="text-ink-3" /> Coach
          </h2>
          <p className="text-body text-ink-3">Reads your trades and notes on demand. Never changes your data.</p>
        </div>
        <Button onClick={reviewWeek} disabled={busy}>
          Review my week
        </Button>
      </div>
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <label htmlFor="coach-q" className="sr-only">
          Ask about the {rangeLabel}
        </label>
        <TextInput id="coach-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder={`Ask about the ${rangeLabel}…`} className="min-w-0 flex-1" />
        <Button type="submit" variant="primary" disabled={busy || !q.trim()}>
          Ask
        </Button>
      </form>
      <div aria-live="polite">
        {state.kind === 'loading' && (
          <div className="mt-4 flex flex-col gap-2" aria-busy="true">
            <p className="caption">{state.what}</p>
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        {state.kind === 'ok' && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="caption mb-2">{state.what}</p>
            <div className="max-w-[68ch] text-[15px] leading-6 whitespace-pre-wrap text-ink-1">{state.text}</div>
          </div>
        )}
        {state.kind === 'error' && (
          <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-control border border-[color-mix(in_oklab,var(--loss)_30%,transparent)] bg-loss-tint px-3 py-2">
            <span className="text-body">{state.msg}</span>
            <Button size="sm" onClick={state.retry}>
              Try again
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

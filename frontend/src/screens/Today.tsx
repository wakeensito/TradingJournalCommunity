import { useMemo } from 'react';
import { TriangleAlert, Upload } from 'lucide-react';
import { useData } from '../lib/store';
import { computeStats, sortTrades } from '../lib/stats';
import { formatMoney, formatPct } from '../lib/format';
import { netPnl } from '../lib/pnl';
import { startOfWeek, todayLocal } from '../lib/dates';
import { PageHeader } from '../app/Shell';
import { useAppUi } from '../app/ui-context';
import { accountProgress, longDayLabel } from '../app/domain';
import { Money } from '../ui/Money';
import { SessionTape } from '../ui/SessionTape';
import { Button } from '../ui/controls';
import { EmptyState } from '../ui/states';
import { CloseDayCard, PlanCard, TradeList } from '../features/DayParts';

export function Today() {
  const { trades, settings, accounts } = useData();
  const ui = useAppUi();
  const today = todayLocal();
  const band = settings.breakevenBand;

  const todays = useMemo(() => trades.filter((t) => t.date === today), [trades, today]);
  const stats = useMemo(() => computeStats(todays, band), [todays, band]);
  const list = useMemo(() => sortTrades(todays), [todays]);
  const weekNet = useMemo(() => {
    const from = startOfWeek(today);
    return trades.filter((t) => t.date >= from && t.date <= today).reduce((s, t) => s + netPnl(t), 0);
  }, [trades, today]);

  const propAlerts = useMemo(
    () =>
      accounts
        .filter((a) => a.status === 'active' && a.type !== 'personal')
        .map((a) => ({ a, p: accountProgress(a, trades, today) }))
        .filter(({ p }) => (p.dailyLoss && p.dailyLoss.pct >= 0.75) || (p.drawdown && p.drawdown.pct >= 0.75)),
    [accounts, trades, today],
  );

  const hasAnyTrades = trades.length > 0;

  return (
    <div>
      <PageHeader title="Today" sub={longDayLabel(today)} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Today’s P&L" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <Money value={stats.net} flatBand={band} className="text-hero-sm md:text-hero" />
              <p className="num pb-1.5 text-caption text-ink-3" data-testid="today-meta">
                <span className="whitespace-nowrap">{stats.count} trade{stats.count === 1 ? '' : 's'}</span>
                {stats.count > 0 && (
                  <>
                    {' · '}
                    <span className="whitespace-nowrap">{formatPct(stats.winRate)} win</span>
                    {' · '}
                    <span className="whitespace-nowrap">fees {formatMoney(stats.fees)}</span>
                  </>
                )}
                {' · '}
                <span className="whitespace-nowrap">
                  week <span className={weekNet > 0 ? 'text-gain' : weekNet < 0 ? 'text-loss' : ''}>{formatMoney(weekNet, { sign: true })}</span>
                </span>
              </p>
            </div>
            <div className="rounded-card border border-line bg-surface-1 px-3">
              <SessionTape trades={todays} size="lg" band={band} />
            </div>
            {/* MOUNT: market context — MarketContextStrip goes here (under the hero P&L). */}
          </section>

          {propAlerts.map(({ a, p }) => (
            <div key={a.id} role="alert" className="flex items-start gap-3 rounded-card border border-[color-mix(in_oklab,var(--warn)_35%,transparent)] bg-warn-tint px-4 py-3">
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />
              <p className="text-body text-ink-1">
                <span className="font-medium">{a.name}</span>:{' '}
                {p.dailyLoss && p.dailyLoss.pct >= 0.75
                  ? `${formatMoney(p.dailyLoss.limit - p.dailyLoss.used)} left before the daily loss limit.`
                  : `${formatMoney((p.drawdown?.limit ?? 0) - (p.drawdown?.used ?? 0))} left before max drawdown.`}
              </p>
            </div>
          ))}

          <section className="card overflow-hidden" aria-labelledby="today-trades">
            <div className="flex min-h-12 items-center justify-between gap-2 border-b border-line px-4">
              <h2 id="today-trades" className="text-[15px] leading-6 font-semibold">
                Trades
              </h2>
              {list.length > 0 && <span className="num text-caption text-ink-3">{list.length}</span>}
            </div>
            {list.length > 0 ? (
              <TradeList trades={list} band={band} onOpen={ui.openTrade} />
            ) : (
              <EmptyState
                title={hasAnyTrades ? 'No trades yet today' : 'Log your first trade'}
                body={hasAnyTrades ? 'Log one right after you close it — five fields, done.' : 'Five fields and you’re done. Or bring your history in from your broker.'}
                action={
                  <Button variant="primary" onClick={ui.openQuickLog}>
                    Log a trade
                  </Button>
                }
                secondary={
                  !hasAnyTrades && (
                    <Button onClick={ui.openImport}>
                      <Upload size={16} /> Import a CSV
                    </Button>
                  )
                }
              />
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <CloseDayCard date={today} />
          <PlanCard date={today} />
        </div>
      </div>
    </div>
  );
}

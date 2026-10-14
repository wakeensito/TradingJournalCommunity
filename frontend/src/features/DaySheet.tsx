import { useMemo } from 'react';
import { useData } from '../lib/store';
import { computeStats, sortTrades } from '../lib/stats';
import { formatPct } from '../lib/format';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/controls';
import { Money } from '../ui/Money';
import { SessionTape } from '../ui/SessionTape';
import { longDayLabel } from '../app/domain';
import { useAppUi } from '../app/ui-context';
import { CloseDayCard, PlanCard, TradeList } from './DayParts';
import { MarketContextStrip } from './market';
import { api } from '../lib/api';

export function DaySheet({ date, onClose }: { date: string | null; onClose: () => void }) {
  if (!date) return null;
  return <DaySheetInner key={date} date={date} onClose={onClose} />;
}

function DaySheetInner({ date, onClose }: { date: string; onClose: () => void }) {
  const { trades, settings } = useData();
  const ui = useAppUi();
  const band = settings.breakevenBand;
  const dayTrades = useMemo(() => trades.filter((t) => t.date === date), [trades, date]);
  const stats = useMemo(() => computeStats(dayTrades, band), [dayTrades, band]);
  const list = useMemo(() => sortTrades(dayTrades), [dayTrades]);

  return (
    <Sheet open onClose={onClose} title={longDayLabel(date)} testId="day-sheet">
      <div className="flex flex-col gap-5">
        <MarketContextStrip apiGet={api.get} date={date} maxEvents={3} className="-mb-2" />
        <div>
          <div className="flex items-end justify-between gap-3">
            <Money value={stats.net} flatBand={band} className="text-hero-sm" />
            <span className="num pb-1 text-caption text-ink-3">
              {stats.count} trade{stats.count === 1 ? '' : 's'} · {formatPct(stats.winRate)} win
            </span>
          </div>
          <div className="mt-3">
            <SessionTape trades={dayTrades} size="sm" band={band} />
          </div>
        </div>

        {list.length > 0 ? (
          <div className="-mx-4 border-y border-line md:-mx-5">
            <TradeList trades={list} band={band} onOpen={ui.openTrade} />
          </div>
        ) : (
          <p className="rounded-card border border-dashed border-line-strong px-4 py-5 text-center text-body text-ink-3">
            No trades on this day.
          </p>
        )}

        <PlanCard date={date} />
        <CloseDayCard date={date} compact />

        <Button variant="ghost" onClick={() => ui.openQuickLog(date)} className="self-center">
          Log a trade
        </Button>
      </div>
    </Sheet>
  );
}

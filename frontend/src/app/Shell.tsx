import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, CalendarDays, ChartNoAxesColumn, Plus, Rows3, Settings as SettingsIcon, type LucideIcon } from 'lucide-react';
import { useStore } from '../lib/store';
import { href, useRoute, type Route } from './router';
import { AppUiContext, type AppUi } from './ui-context';
import { cx } from '../ui/controls';
import { BrandMark } from '../ui/BrandMark';
import { ErrorState, ScreenSkeleton } from '../ui/states';
import { overlayOpen } from '../ui/Sheet';
import { SaveStatusBadge } from './SaveStatus';
import { Today } from '../screens/Today';
import { CalendarScreen } from '../screens/Calendar';
import { Trades } from '../screens/Trades';
import { SettingsScreen } from '../screens/Settings';
import { QuickLog } from '../features/QuickLog';
import { TradeSheet } from '../features/TradeSheet';
import { DaySheet } from '../features/DaySheet';
import { ImportSheet } from '../features/ImportSheet';

const Insights = lazy(() => import('../screens/Insights').then((m) => ({ default: m.Insights })));

const NAV: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: 'today', label: 'Today', icon: Activity },
  { route: 'calendar', label: 'Calendar', icon: CalendarDays },
  { route: 'trades', label: 'Trades', icon: Rows3 },
  { route: 'insights', label: 'Insights', icon: ChartNoAxesColumn },
];

export function Shell() {
  const route = useRoute();
  const store = useStore();
  const [quickLog, setQuickLog] = useState(false);
  const [qlDate, setQlDate] = useState<string | null>(null);
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const ui = useMemo<AppUi>(
    () => ({
      openQuickLog: (d?: unknown) => {
        setQlDate(typeof d === 'string' ? d : null);
        setQuickLog(true);
      },
      openTrade: (id) => setTradeId(id),
      openDay: (d) => setDay(d),
      openImport: () => setImporting(true),
    }),
    [],
  );

  const ready = store.status === 'ready' && !!store.data;

  // `N` opens quick log when not typing and nothing else is open.
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (overlayOpen() || !ready) return;
      e.preventDefault();
      setQlDate(null);
      setQuickLog(true);
    },
    [ready],
  );
  useEffect(() => {
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onKey]);

  let screen: ReactNode;
  if (store.status === 'error' && !store.data) {
    screen = <ErrorState message={store.error ?? 'Unknown error'} onRetry={store.reload} />;
  } else if (!ready) {
    screen = <ScreenSkeleton />;
  } else {
    screen =
      route === 'today' ? (
        <Today />
      ) : route === 'calendar' ? (
        <CalendarScreen />
      ) : route === 'trades' ? (
        <Trades />
      ) : route === 'insights' ? (
        <Suspense fallback={<ScreenSkeleton />}>
          <Insights />
        </Suspense>
      ) : (
        <SettingsScreen />
      );
  }

  return (
    <AppUiContext.Provider value={ui}>
      <div className="min-h-dvh md:pl-[var(--rail-w)]">
        <Rail route={route} onLog={() => ready && ui.openQuickLog()} />
        <main
          className="mx-auto w-full max-w-[1100px] pr-[max(16px,var(--safe-right))] pl-[max(16px,var(--safe-left))] md:px-8"
          style={{ paddingTop: 'calc(12px + var(--safe-top))' }}
        >
          <div className="pb-[calc(var(--tabbar-h)+var(--safe-bottom)+32px)] md:pt-6 md:pb-16">{screen}</div>
        </main>
        <TabBar route={route} onLog={() => ready && ui.openQuickLog()} />
      </div>

      {ready && (
        <>
          <QuickLog open={quickLog} date={qlDate} onClose={() => setQuickLog(false)} />
          <DaySheet date={day} onClose={() => setDay(null)} />
          <TradeSheet id={tradeId} onClose={() => setTradeId(null)} />
          <ImportSheet open={importing} onClose={() => setImporting(false)} />
        </>
      )}
    </AppUiContext.Provider>
  );
}

// ---------- page header (screens render their own) ----------

export function PageHeader({ title, sub, actions, noSettingsLink }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; noSettingsLink?: boolean }) {
  return (
    <header className="mb-5 flex min-h-11 items-center gap-2">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-title font-semibold">{title}</h1>
        {sub && <div className="truncate text-body text-ink-3">{sub}</div>}
      </div>
      {actions}
      <div className="flex items-center md:hidden">
        <SaveStatusBadge compact />
        {!noSettingsLink && <a
          href={href('settings')}
          aria-label="Settings"
          title="Settings"
          className="-mr-2 grid h-11 w-11 place-items-center rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink-1"
        >
          <SettingsIcon size={20} />
        </a>}
      </div>
    </header>
  );
}

// ---------- desktop rail ----------

function Rail({ route, onLog }: { route: Route; onLog: () => void }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-30 hidden w-[var(--rail-w)] flex-col items-center border-r border-line bg-bg py-5 md:flex"
    >
      <a href={href('today')} aria-label="Trading Journal — Today" className="mb-5 rounded-card">
        <BrandMark size={36} />
      </a>
      <button
        type="button"
        onClick={onLog}
        aria-label="Log a trade (N)"
        title="Log a trade (N)"
        className="mb-4 grid h-12 w-12 place-items-center rounded-full text-white transition-[filter] duration-[120ms] hover:brightness-110 active:brightness-95"
        style={{ background: 'var(--brand-grad)' }}
      >
        <Plus size={22} strokeWidth={2.25} />
      </button>
      <ul className="flex w-full flex-col items-center gap-1 px-2">
        {NAV.map((n) => (
          <li key={n.route} className="w-full">
            <RailLink route={n.route} label={n.label} icon={n.icon} active={route === n.route} />
          </li>
        ))}
      </ul>
      <div className="mt-auto flex w-full flex-col items-center gap-2 px-2">
        <SaveStatusBadge />
        <RailLink route="settings" label="Settings" icon={SettingsIcon} active={route === 'settings'} />
      </div>
    </nav>
  );
}

function RailLink({ route, label, icon: Icon, active }: { route: Route; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <a
      href={href(route)}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex w-full flex-col items-center gap-1 rounded-card py-2.5 text-[11px] leading-4 font-medium transition-colors duration-[120ms]',
        active ? 'bg-surface-2 text-ink-1' : 'text-ink-3 hover:bg-surface-1 hover:text-ink-1',
      )}
    >
      <Icon size={20} strokeWidth={active ? 2.1 : 1.75} />
      {label}
    </a>
  );
}

// ---------- mobile tab bar ----------

function TabBar({ route, onLog }: { route: Route; onLog: () => void }) {
  const left = NAV.slice(0, 2);
  const right = NAV.slice(2);
  return (
    <nav
      aria-label="Main"
      data-testid="tabbar"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg md:hidden"
      style={{ paddingBottom: 'var(--safe-bottom)', paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
    >
      <ul className="mx-auto grid h-[var(--tabbar-h)] max-w-[520px] grid-cols-5 items-stretch">
        {left.map((n) => (
          <li key={n.route} className="min-w-0">
            <Tab {...n} active={route === n.route} />
          </li>
        ))}
        <li className="grid min-w-0 place-items-center">
          <button
            type="button"
            onClick={onLog}
            aria-label="Log a trade"
            className="-mt-5 grid h-14 w-14 place-items-center rounded-full text-white ring-4 ring-bg transition-[filter] duration-[120ms] active:brightness-95"
            style={{ background: 'var(--brand-grad)' }}
          >
            <Plus size={24} strokeWidth={2.25} />
          </button>
        </li>
        {right.map((n) => (
          <li key={n.route} className="min-w-0">
            <Tab {...n} active={route === n.route} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Tab({ route, label, icon: Icon, active }: { route: Route; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <a
      href={href(route)}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex h-full flex-col items-center justify-center gap-1 text-[11px] leading-4 font-medium',
        active ? 'text-ink-1' : 'text-ink-3 active:text-ink-2',
      )}
    >
      <span className={cx('grid h-7 w-12 place-items-center rounded-full transition-colors', active && 'bg-surface-2')}>
        <Icon size={20} strokeWidth={active ? 2.1 : 1.75} />
      </span>
      {label}
    </a>
  );
}

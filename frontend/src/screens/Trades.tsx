import { useMemo, useState } from 'react';
import { Download, FileJson, FileSpreadsheet, ListChecks, SlidersHorizontal, Upload } from 'lucide-react';
import type { Trade } from '../lib/types';
import { useData, useStore } from '../lib/store';
import { computeStats, groupByDay } from '../lib/stats';
import { netPnl, outcome, rootSymbol } from '../lib/pnl';
import { exportCsv, exportJson } from '../lib/export';
import { newId } from '../lib/ids';
import { formatMoney, formatPct } from '../lib/format';
import { todayLocal } from '../lib/dates';
import { PageHeader } from '../app/Shell';
import { useAppUi } from '../app/ui-context';
import { accountName, canCombine, dayLabel, download, mergeTrades } from '../app/domain';
import { Button, Chip, Field, SegmentedControl, TextInput } from '../ui/controls';
import { Money } from '../ui/Money';
import { SessionTape } from '../ui/SessionTape';
import { Sheet } from '../ui/Sheet';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/states';
import { useToast } from '../ui/Toast';
import { TradeRow } from '../features/DayParts';

interface Filters {
  account: string | null; // account id, '__none' for unassigned
  symbol: string | null;
  setup: string | null;
  result: 'all' | 'win' | 'loss';
  from: string;
  to: string;
}
const NO_FILTERS: Filters = { account: null, symbol: null, setup: null, result: 'all', from: '', to: '' };
const PAGE_DAYS = 30;

function symbolKey(t: Trade): string {
  return t.assetType === 'futures' ? rootSymbol(t.symbol) : (t.option?.underlying ?? t.symbol.split(/\s+/)[0] ?? t.symbol).toUpperCase();
}

export function Trades() {
  const data = useData();
  const { trades, accounts, settings } = data;
  const { combineTrades, deleteTrades } = useStore();
  const ui = useAppUi();
  const toast = useToast();
  const band = settings.breakevenBand;

  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | 'combine' | 'delete'>(null);
  const [pages, setPages] = useState(1);

  const filtered = useMemo(
    () =>
      trades.filter((t) => {
        if (f.account && (f.account === '__none' ? t.accountId !== null && accounts.some((a) => a.id === t.accountId) : t.accountId !== f.account)) return false;
        if (f.symbol && symbolKey(t) !== f.symbol) return false;
        if (f.setup && t.setup !== f.setup) return false;
        if (f.from && t.date < f.from) return false;
        if (f.to && t.date > f.to) return false;
        if (f.result !== 'all' && outcome(t, band) !== f.result) return false;
        return true;
      }),
    [trades, f, band, accounts],
  );
  const groups = useMemo(() => [...groupByDay(filtered).entries()], [filtered]);
  const stats = useMemo(() => computeStats(filtered, band), [filtered, band]);
  const shown = groups.slice(0, pages * PAGE_DAYS);

  const symbols = useMemo(() => [...new Set(trades.map(symbolKey))].sort(), [trades]);
  const activeCount = [f.account, f.symbol, f.setup, f.from || null, f.to || null].filter(Boolean).length;
  const selected = useMemo(() => trades.filter((t) => sel.has(t.id)), [trades, sel]);
  const combineIssue = canCombine(selected);

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const endSelect = () => {
    setSelecting(false);
    setSel(new Set());
  };

  const merged = !combineIssue && selected.length >= 2 ? mergeTrades(selected, newId(), new Date().toISOString()) : null;

  return (
    <div>
      <PageHeader
        title="Trades"
        actions={
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={ui.openImport} aria-label="Import CSV" className="max-sm:w-11 max-sm:px-0">
              <Upload size={16} />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setExportOpen(true)} aria-label="Export" disabled={!trades.length} className="max-sm:w-11 max-sm:px-0">
              <Download size={16} />
              <span className="hidden sm:inline">Export</span>
            </Button>
            {trades.length > 1 && (
              <Button
                size="sm"
                variant={selecting ? 'secondary' : 'ghost'}
                onClick={() => (selecting ? endSelect() : setSelecting(true))}
                aria-label={selecting ? 'Cancel selection' : 'Select trades'}
                aria-pressed={selecting}
                className="max-sm:w-11 max-sm:px-0"
              >
                <ListChecks size={16} />
                <span className="hidden sm:inline">{selecting ? 'Cancel' : 'Select'}</span>
              </Button>
            )}
          </div>
        }
      />

      {trades.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No trades yet"
            body="Import your broker’s CSV (Tradovate, NinjaTrader, Webull, Robinhood) or log one by hand."
            action={
              <Button variant="primary" onClick={ui.openImport}>
                <Upload size={16} /> Import a CSV
              </Button>
            }
            secondary={<Button onClick={ui.openQuickLog}>Log a trade</Button>}
          />
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SegmentedControl
              label="Result"
              size="sm"
              value={f.result}
              onChange={(v) => setF((s) => ({ ...s, result: v }))}
              className="w-full sm:w-64"
              options={[
                { value: 'all', label: 'All' },
                { value: 'win', label: 'Wins', tone: 'gain' },
                { value: 'loss', label: 'Losses', tone: 'loss' },
              ]}
            />
            <div className="scroll-x flex min-w-0 flex-1 items-center gap-2">
              <Chip selected={activeCount > 0} onClick={() => setFilterOpen(true)}>
                <SlidersHorizontal size={14} />
                Filters{activeCount ? <span className="num">· {activeCount}</span> : null}
              </Chip>
              {f.account && <Chip onRemove={() => setF((s) => ({ ...s, account: null }))}>{f.account === '__none' ? 'Unassigned' : accountName(accounts, f.account)}</Chip>}
              {f.symbol && <Chip onRemove={() => setF((s) => ({ ...s, symbol: null }))}>{f.symbol}</Chip>}
              {f.setup && <Chip onRemove={() => setF((s) => ({ ...s, setup: null }))}>{f.setup}</Chip>}
              {(f.from || f.to) && (
                <Chip onRemove={() => setF((s) => ({ ...s, from: '', to: '' }))}>
                  {f.from ? dayLabel(f.from, { month: 'short', day: 'numeric' }) : '…'} – {f.to ? dayLabel(f.to, { month: 'short', day: 'numeric' }) : 'now'}
                </Chip>
              )}
            </div>
          </div>

          <p className="num mb-4 text-caption text-ink-3" data-testid="trades-summary">
            {stats.count} trades · <Money value={stats.net} flatBand={band} className="text-caption" /> · {formatPct(stats.winRate)} win
            {stats.profitFactor !== null && <> · PF {stats.profitFactor.toFixed(2)}</>}
          </p>

          {groups.length === 0 ? (
            <div className="card">
              <EmptyState title="Nothing matches" body="Try a wider date range or clear the filters." action={<Button onClick={() => setF(NO_FILTERS)}>Clear filters</Button>} />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {shown.map(([date, list]) => {
                const net = list.reduce((s, t) => s + netPnl(t), 0);
                const ordered = [...list].reverse();
                return (
                  <section key={date} className="card overflow-hidden" aria-label={dayLabel(date)}>
                    <button
                      type="button"
                      onClick={() => ui.openDay(date)}
                      className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_72px_auto] items-center gap-3 border-b border-line px-4 text-left hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_120px_auto]"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {dayLabel(date)}
                        <span className="num ml-2 text-caption text-ink-3">{list.length}</span>
                      </span>
                      <SessionTape trades={list} size="xs" band={band} height={20} />
                      <Money value={net} flatBand={band} className="text-body" />
                    </button>
                    <ul className="divide-y divide-line-soft">
                      {ordered.map((t) => (
                        <li key={t.id}>
                          <TradeRow t={t} band={band} onOpen={() => ui.openTrade(t.id)} selectable={selecting} selected={sel.has(t.id)} onToggle={() => toggle(t.id)} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              {groups.length > shown.length && (
                <Button onClick={() => setPages((p) => p + 1)} className="self-center">
                  Show older days ({groups.length - shown.length})
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {selecting && (
        <div className="h-20" aria-hidden />
      )}
      {selecting && (
        <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+12px)] z-40 px-4 md:bottom-6 md:left-[var(--rail-w)] md:px-8">
          <div
            className="anim-rise mx-auto flex max-w-[640px] flex-wrap items-center gap-2 rounded-card border border-line-strong bg-surface-2 p-2 pl-4"
            style={{ boxShadow: 'var(--sheet-shadow)' }}
            role="toolbar"
            aria-label="Selection"
          >
            <span className="num mr-auto text-body text-ink-2">{sel.size} selected</span>
            <Button size="sm" variant="danger" disabled={!sel.size} onClick={() => setConfirm('delete')}>
              Delete
            </Button>
            <Button size="sm" variant="primary" disabled={!!combineIssue} title={combineIssue ?? undefined} onClick={() => setConfirm('combine')}>
              Combine
            </Button>
          </div>
        </div>
      )}

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} value={f} onChange={setF} symbols={symbols} setups={settings.setups} accounts={accounts} />

      <Sheet open={exportOpen} onClose={() => setExportOpen(false)} title="Export" subtitle="Everything you’ve logged — yours to keep.">
        <div className="flex flex-col gap-3">
          <ExportOption
            icon={<FileSpreadsheet size={20} />}
            title="CSV"
            body={`All ${trades.length} trades with net P&L. Opens in Excel or Sheets, and re-imports here.`}
            onClick={() => {
              download(`trading-journal-${todayLocal()}.csv`, exportCsv(trades, accounts), 'text/csv');
              toast.show('CSV downloaded.', { tone: 'success' });
            }}
          />
          <ExportOption
            icon={<FileJson size={20} />}
            title="JSON backup"
            body="Trades, accounts, day notes and settings — the complete journal."
            onClick={() => {
              download(`trading-journal-${todayLocal()}.json`, exportJson(data), 'application/json');
              toast.show('Backup downloaded.', { tone: 'success' });
            }}
          />
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirm === 'combine'}
        title={`Combine ${selected.length} trades?`}
        body={
          merged && (
            <>
              They become one <span className="num">{merged.symbol}</span> trade:{' '}
              <span className="num">
                {merged.qty} @ {merged.entry.toFixed(2)} → {merged.exit.toFixed(2)}, fees {formatMoney(merged.fees)}
              </span>
              . Net P&amp;L is unchanged.
            </>
          )
        }
        confirmLabel="Combine"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          if (!merged) return;
          void combineTrades(selected.map((t) => t.id), merged).then((ok) => ok && toast.show('Trades combined.', { tone: 'success' }));
          endSelect();
        }}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title={`Delete ${sel.size} trade${sel.size === 1 ? '' : 's'}?`}
        body="Screenshots go with them. This can’t be undone."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          const ids = [...sel];
          endSelect();
          void deleteTrades(ids).then((ok) => ok && toast.show(`${ids.length} deleted.`));
        }}
      />
    </div>
  );
}


function ExportOption({ icon, title, body, onClick }: { icon: React.ReactNode; title: string; body: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-card border border-line bg-inset p-4 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <span className="mt-0.5 text-ink-2">{icon}</span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-body text-ink-3">{body}</span>
      </span>
    </button>
  );
}

function FilterSheet({
  open,
  onClose,
  value,
  onChange,
  symbols,
  setups,
  accounts,
}: {
  open: boolean;
  onClose: () => void;
  value: Filters;
  onChange: (f: Filters) => void;
  symbols: string[];
  setups: string[];
  accounts: { id: string; name: string }[];
}) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v });
  const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <fieldset className="flex flex-col gap-2">
      <legend className="caption mb-2">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filters"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => onChange({ ...NO_FILTERS, result: value.result })}>Clear</Button>
          <Button variant="primary" onClick={onClose}>
            Show trades
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {accounts.length > 0 && (
          <Group label="Account">
            {accounts.map((a) => (
              <Chip key={a.id} selected={value.account === a.id} onClick={() => set('account', value.account === a.id ? null : a.id)}>
                {a.name}
              </Chip>
            ))}
            <Chip selected={value.account === '__none'} onClick={() => set('account', value.account === '__none' ? null : '__none')}>
              Unassigned
            </Chip>
          </Group>
        )}
        {symbols.length > 0 && (
          <Group label="Symbol">
            {symbols.map((s) => (
              <Chip key={s} className="num" selected={value.symbol === s} onClick={() => set('symbol', value.symbol === s ? null : s)}>
                {s}
              </Chip>
            ))}
          </Group>
        )}
        {setups.length > 0 && (
          <Group label="Setup">
            {setups.map((s) => (
              <Chip key={s} selected={value.setup === s} onClick={() => set('setup', value.setup === s ? null : s)}>
                {s}
              </Chip>
            ))}
          </Group>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="From" htmlFor="flt-from">
            <TextInput id="flt-from" type="date" value={value.from} onChange={(e) => set('from', e.target.value)} />
          </Field>
          <Field label="To" htmlFor="flt-to">
            <TextInput id="flt-to" type="date" value={value.to} onChange={(e) => set('to', e.target.value)} />
          </Field>
        </div>
      </div>
    </Sheet>
  );
}

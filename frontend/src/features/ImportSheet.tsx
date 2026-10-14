import { useMemo, useRef, useState } from 'react';
import { Check, FileUp, TriangleAlert } from 'lucide-react';
import type { TradeSource } from '../lib/types';
import { useData, useStore } from '../lib/store';
import { importCsv, ImportError, type ImportResult } from '../lib/import';
import { netPnl } from '../lib/pnl';
import { formatMoney, formatPrice } from '../lib/format';
import { Sheet } from '../ui/Sheet';
import { Button, Chip, cx } from '../ui/controls';
import { Money } from '../ui/Money';
import { navigate } from '../app/router';
import { dayLabel } from '../app/domain';
import { lastAccountId } from './tradeDraft';

const SOURCE_LABEL: Record<TradeSource, string> = {
  manual: 'Manual',
  tradovate: 'Tradovate',
  ninjatrader: 'NinjaTrader',
  webull: 'Webull',
  robinhood: 'Robinhood',
  generic: 'Trading Journal export',
};
const PREVIEW_ROWS = 200;

type Stage =
  | { kind: 'pick'; error?: string }
  | { kind: 'preview'; name: string; text: string; result: ImportResult }
  | { kind: 'importing'; done: number; total: number }
  | { kind: 'done'; written: number };

export function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [gen, setGen] = useState(0);
  if (!open) return null;
  return (
    <ImportInner
      key={gen}
      onClose={() => {
        setGen((g) => g + 1);
        onClose();
      }}
    />
  );
}

function ImportInner({ onClose }: { onClose: () => void }) {
  const { settings, accounts, trades } = useData();
  const { importTrades } = useStore();
  const [stage, setStage] = useState<Stage>({ kind: 'pick' });
  const [accountId, setAccountId] = useState<string | null>(() => lastAccountId(accounts, settings));
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const existing = useMemo(() => new Set(trades.map((t) => t.id)), [trades]);

  function parse(name: string, text: string, acct: string | null) {
    try {
      const result = importCsv(text, { settings, accountId: acct, nowIso: new Date().toISOString(), accounts });
      if (!result.trades.length) {
        setStage({ kind: 'pick', error: `No closed trades found in ${name}.${result.warnings[0] ? ` ${result.warnings[0]}` : ''}` });
        return;
      }
      setStage({ kind: 'preview', name, text, result });
    } catch (e) {
      setStage({
        kind: 'pick',
        error: e instanceof ImportError ? e.message : `Couldn’t read ${name}: ${e instanceof Error ? e.message : 'unknown error'}`,
      });
    }
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setStage({ kind: 'pick', error: 'That file is over 20 MB — export a shorter date range.' });
      return;
    }
    const text = await file.text();
    parse(file.name, text, accountId);
  }

  const fresh = stage.kind === 'preview' ? stage.result.trades.filter((t) => !existing.has(t.id)) : [];
  const dupes = stage.kind === 'preview' ? stage.result.trades.length - fresh.length : 0;

  async function doImport() {
    if (stage.kind !== 'preview' || !fresh.length) return;
    const total = fresh.length;
    setStage({ kind: 'importing', done: 0, total });
    const r = await importTrades(fresh, (done) => setStage({ kind: 'importing', done, total }));
    if (r.ok) setStage({ kind: 'done', written: r.written });
    else setStage({ kind: 'pick', error: `Import stopped after ${r.written} of ${total} trades. Nothing was duplicated — try again to finish.` });
  }

  const footer =
    stage.kind === 'preview' ? (
      <Button variant="primary" block disabled={!fresh.length} onClick={doImport} data-testid="import-confirm">
        {fresh.length ? `Import ${fresh.length} trade${fresh.length === 1 ? '' : 's'}` : 'Already imported'}
      </Button>
    ) : stage.kind === 'importing' ? (
      <Button variant="primary" block loading>
        Importing {stage.done}/{stage.total}…
      </Button>
    ) : stage.kind === 'done' ? (
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onClose}>Done</Button>
        <Button
          variant="primary"
          onClick={() => {
            onClose();
            navigate('trades');
          }}
        >
          View trades
        </Button>
      </div>
    ) : undefined;

  return (
    <Sheet open onClose={onClose} title="Import trades" subtitle="CSV from your broker. Re-importing never duplicates." wide footer={footer} testId="import-sheet">
      {stage.kind === 'pick' && (
        <div className="flex flex-col gap-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void pickFile(e.dataTransfer.files[0]);
            }}
            className={cx(
              'flex flex-col items-center gap-3 rounded-card border border-dashed px-4 py-10 text-center transition-colors',
              drag ? 'border-brand bg-brand-tint' : 'border-line-strong bg-inset',
            )}
          >
            <FileUp size={28} className="text-ink-3" />
            <p className="text-ink-2">
              <span className="hidden md:inline">Drop a CSV here, or </span>
              <span className="md:hidden">Pick your broker’s CSV</span>
            </p>
            <Button variant="primary" onClick={() => fileRef.current?.click()}>
              Choose file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.tsv,text/csv"
              hidden
              data-testid="import-file"
              onChange={(e) => {
                void pickFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
          {stage.error && (
            <p role="alert" className="flex items-start gap-2 rounded-control border border-[color-mix(in_oklab,var(--loss)_35%,transparent)] bg-loss-tint px-3 py-2 text-body">
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-loss" />
              {stage.error}
            </p>
          )}
          <div>
            <p className="caption mb-2">Works with</p>
            <ul className="grid gap-1 text-body text-ink-3 sm:grid-cols-2">
              <li>Tradovate — Performance or Orders</li>
              <li>NinjaTrader — Trades grid</li>
              <li>Webull — Orders</li>
              <li>Robinhood — Activity</li>
              <li>This app’s CSV export</li>
            </ul>
          </div>
        </div>
      )}

      {stage.kind === 'preview' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="min-w-0">
              <span className="font-medium">{SOURCE_LABEL[stage.result.source]}</span>
              <span className="text-ink-3"> · {stage.name}</span>
            </p>
            <Money
              value={stage.result.trades.reduce((s, t) => s + netPnl(t), 0)}
              flatBand={settings.breakevenBand}
              className="text-[17px]"
            />
          </div>
          <p className="num text-body text-ink-2" data-testid="import-summary">
            {stage.result.trades.length} trades found · <span className="text-ink-1">{fresh.length} new</span>
            {dupes > 0 && <> · {dupes} already in your journal (kept as-is)</>}
            {stage.result.skipped > 0 && <> · {stage.result.skipped} rows skipped</>}
          </p>

          {stage.result.warnings.length > 0 && (
            <details className="rounded-control border border-[color-mix(in_oklab,var(--warn)_30%,transparent)] bg-warn-tint px-3 py-2">
              <summary className="flex min-h-8 cursor-pointer items-center gap-2 text-body text-ink-1">
                <TriangleAlert size={14} className="text-warn" />
                {stage.result.warnings.length} warning{stage.result.warnings.length === 1 ? '' : 's'}
              </summary>
              <ul className="mt-2 flex max-h-40 list-disc flex-col gap-1 overflow-auto pl-5 text-caption text-ink-2">
                {stage.result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}

          {accounts.length > 0 && (
            <fieldset>
              <legend className="caption mb-2">Into account</legend>
              <div className="flex flex-wrap gap-2">
                <Chip
                  selected={accountId === null}
                  onClick={() => {
                    setAccountId(null);
                    parse(stage.name, stage.text, null);
                  }}
                >
                  None
                </Chip>
                {accounts
                  .filter((a) => a.status !== 'archived')
                  .map((a) => (
                    <Chip
                      key={a.id}
                      selected={accountId === a.id}
                      onClick={() => {
                        setAccountId(a.id);
                        parse(stage.name, stage.text, a.id);
                      }}
                    >
                      {a.name}
                    </Chip>
                  ))}
              </div>
            </fieldset>
          )}

          <div className="overflow-hidden rounded-card border border-line">
            <div className="max-h-[40dvh] overflow-auto">
              <table className="w-full min-w-[420px] text-body">
                <thead className="sticky top-0 bg-surface-2">
                  <tr className="text-left">
                    <th className="caption px-3 py-2 font-medium">Date</th>
                    <th className="caption px-3 py-2 font-medium">Symbol</th>
                    <th className="caption px-3 py-2 font-medium">Side</th>
                    <th className="caption px-3 py-2 text-right font-medium">Qty</th>
                    <th className="caption px-3 py-2 text-right font-medium">Entry → Exit</th>
                    <th className="caption px-3 py-2 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {stage.result.trades.slice(0, PREVIEW_ROWS).map((t) => {
                    const dup = existing.has(t.id);
                    return (
                      <tr key={t.id} className={dup ? 'text-ink-4' : undefined}>
                        <td className="num px-3 py-2 whitespace-nowrap">
                          {dayLabel(t.date, { month: 'short', day: 'numeric' })} <span className="text-ink-3">{t.time ?? ''}</span>
                        </td>
                        <td className="num px-3 py-2 whitespace-nowrap">{t.symbol}</td>
                        <td className={cx('px-3 py-2', !dup && (t.side === 'long' ? 'text-gain' : 'text-loss'))}>{t.side === 'long' ? 'L' : 'S'}</td>
                        <td className="num px-3 py-2 text-right">{t.qty}</td>
                        <td className="num px-3 py-2 text-right whitespace-nowrap">
                          {formatPrice(t.entry)} → {formatPrice(t.exit)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {dup ? <span className="num">{formatMoney(netPnl(t), { sign: true })}</span> : <Money value={netPnl(t)} flatBand={settings.breakevenBand} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {stage.result.trades.length > PREVIEW_ROWS && (
              <p className="border-t border-line px-3 py-2 text-caption text-ink-3">
                Showing {PREVIEW_ROWS} of {stage.result.trades.length}.
              </p>
            )}
          </div>
          <Button variant="ghost" onClick={() => setStage({ kind: 'pick' })} className="self-start">
            Choose a different file
          </Button>
        </div>
      )}

      {stage.kind === 'importing' && (
        <div className="py-10" aria-live="polite">
          <p className="mb-3 text-center text-body text-ink-2">Saving trades…</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-inset">
            <div className="h-full bg-brand transition-[width] duration-[180ms]" style={{ width: `${(stage.done / Math.max(1, stage.total)) * 100}%` }} />
          </div>
        </div>
      )}

      {stage.kind === 'done' && (
        <div className="flex flex-col items-center gap-3 py-10 text-center" role="status" data-testid="import-done">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-gain-tint text-gain">
            <Check size={20} />
          </span>
          <p className="text-[17px] font-semibold">
            Imported <span className="num">{stage.written}</span> trade{stage.written === 1 ? '' : 's'}
          </p>
          <p className="text-body text-ink-3">They’re in your calendar and stats now.</p>
        </div>
      )}
    </Sheet>
  );
}

import { useRef, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { Trade } from '../lib/types';
import { useData, useStore } from '../lib/store';
import { netPnl } from '../lib/pnl';
import { formatMoney } from '../lib/format';
import { useToast } from '../ui/Toast';
import { Sheet } from '../ui/Sheet';
import { Button, IconButton } from '../ui/controls';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { accountName, dayLabel, time12 } from '../app/domain';
import { draftFromTrade, useTradeDraft } from './tradeDraft';
import { CoreFields, DetailFields, PnlPreview, acceptImages, imagesFromClipboard, submitOnEnter } from './TradeFields';

export function TradeSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const data = useData();
  const trade = id ? data.trades.find((t) => t.id === id) : undefined;
  if (!id || !trade) return null;
  return <TradeSheetInner key={id} trade={trade} onClose={onClose} />;
}

function TradeSheetInner({ trade, onClose }: { trade: Trade; onClose: () => void }) {
  const data = useData();
  const { saveTrade, deleteTrades, uploadPhoto } = useStore();
  const toast = useToast();
  const { settings, accounts, trades } = data;
  const draft = useTradeDraft(() => draftFromTrade(trade), settings, trades);
  const { d, setD, valid, build } = draft;
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const addFiles = (files: File[]) => {
    const { ok, rejected } = acceptImages(files, d.photoKeys.length + d.pending.length);
    if (rejected) toast.show(rejected, { tone: 'error' });
    if (ok.length) setD((s) => ({ ...s, pending: [...s.pending, ...ok] }));
  };

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setShowErrors(true);
    if (!valid) return;
    const t = build(trade);
    setBusy(true);
    if (d.pending.length) {
      const keys: string[] = [];
      for (const f of d.pending) {
        try {
          keys.push(await uploadPhoto(t.id, f));
        } catch (err) {
          toast.show(`Screenshot didn’t upload: ${err instanceof Error ? err.message : 'unknown error'}`, { tone: 'error' });
        }
      }
      if (keys.length) t.photoKeys = [...(t.photoKeys ?? []), ...keys].slice(0, 6);
    }
    const ok = await saveTrade(t);
    setBusy(false);
    if (ok) {
      toast.show('Trade saved.', { tone: 'success' });
      onClose();
    }
  }

  const net = netPnl(trade);

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        testId="trade-sheet"
        title={
          <span className="flex items-center gap-2">
            <span className="num">{trade.symbol}</span>
            <span className={trade.side === 'long' ? 'text-body text-gain' : 'text-body text-loss'}>
              {trade.side === 'long' ? 'Long' : 'Short'}
            </span>
          </span>
        }
        subtitle={
          <span>
            {dayLabel(trade.date)}
            {trade.time ? <span className="num"> · {time12(trade.time)}</span> : ''} · {accountName(accounts, trade.accountId)}
            {trade.source !== 'manual' ? ` · ${trade.source}` : ''}
          </span>
        }
        footer={
          <div className="flex gap-2">
            <IconButton label="Delete trade" onClick={() => setConfirm(true)} className="border border-line text-loss hover:bg-loss-tint hover:text-loss">
              <Trash2 size={18} />
            </IconButton>
            <Button onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button variant="primary" className="flex-1" loading={busy} onClick={() => formRef.current?.requestSubmit()}>
              Save
            </Button>
          </div>
        }
      >
        {/* MOUNT: market context — TradeChart goes here (under the price row). */}

        <form
          ref={formRef}
            onSubmit={submit}
          onKeyDown={submitOnEnter}
          noValidate
          onPaste={(e) => {
            const imgs = imagesFromClipboard(e);
            if (imgs.length) {
              e.preventDefault();
              addFiles(imgs);
            }
          }}
          className="flex flex-col gap-5"
        >
          <CoreFields draft={draft} settings={settings} showErrors={showErrors} />
          <PnlPreview draft={draft} band={settings.breakevenBand} />
          <DetailFields draft={draft} settings={settings} accounts={accounts} showErrors={showErrors} onAddFiles={addFiles} />
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        title="Delete this trade?"
        body={
          <>
            <span className="num">
              {trade.symbol} {formatMoney(net, { sign: true })}
            </span>{' '}
            on {dayLabel(trade.date)}. Screenshots go with it. This can’t be undone.
          </>
        }
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          onClose();
          void deleteTrades([trade.id]).then((ok) => ok && toast.show('Trade deleted.'));
        }}
      />
    </>
  );
}

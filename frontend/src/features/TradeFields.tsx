import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ChevronDown, ImagePlus, TriangleAlert, X } from 'lucide-react';
import type { Account, AssetType, Settings } from '../lib/types';
import { useStore } from '../lib/store';
import { formatMoney } from '../lib/format';
import { Chip, DecimalInput, Field, SegmentedControl, Stepper, TextInput, cx } from '../ui/controls';
import { Money } from '../ui/Money';
import { assetLabel } from '../app/domain';
import type { TradeDraft } from './tradeDraft';

const NEXT_ASSET: Record<AssetType, AssetType> = { futures: 'option', option: 'stock', stock: 'futures' };
export const MAX_PHOTOS = 6;

/** Required inputs: symbol, side, qty, entry, exit (the five). */
export function CoreFields({
  draft,
  settings,
  showErrors,
  symbolRef,
  entryRef,
}: {
  draft: TradeDraft;
  settings: Settings;
  showErrors: boolean;
  symbolRef?: RefObject<HTMLInputElement>;
  entryRef?: RefObject<HTMLInputElement>;
}) {
  const { d, set, setD, assetType, errors } = draft;
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : undefined);
  const recents = settings.recentSymbols.filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Symbol"
        htmlFor="tf-symbol"
        error={err('symbol')}
        aside={
          <button
            type="button"
            onClick={() => setD((s) => ({ ...s, assetType: NEXT_ASSET[assetType], assetTouched: true }))}
            aria-label={`Asset type: ${assetLabel(assetType)}. Tap to change.`}
            className="inline-flex min-h-7 items-center gap-1 rounded-control border border-line bg-inset px-2 text-caption text-ink-2 hover:border-line-strong hover:text-ink-1"
          >
            {assetLabel(assetType)}
            <ChevronDown size={12} />
          </button>
        }
      >
        {recents.length > 0 && (
          <div className="scroll-x -mx-1 flex gap-2 px-1 pb-1" role="group" aria-label="Recent symbols">
            {recents.map((s) => (
              <Chip key={s} selected={d.symbol.toUpperCase() === s.toUpperCase()} onClick={() => set('symbol', s)} className="num">
                {s}
              </Chip>
            ))}
          </div>
        )}
        <TextInput
          id="tf-symbol"
          ref={symbolRef}
          mono
          value={d.symbol}
          onChange={(e) => set('symbol', e.target.value.toUpperCase())}
          placeholder="MNQ, MESZ5, SPY 500C 12/19"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!err('symbol')}
          enterKeyHint="next"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="caption" id="tf-side-label">
            Side
          </span>
          <SegmentedControl
            label="Side"
            value={d.side}
            onChange={(v) => set('side', v)}
            options={[
              { value: 'long', label: 'Long', tone: 'gain' },
              { value: 'short', label: 'Short', tone: 'loss' },
            ]}
          />
        </div>
        <Field label="Qty" htmlFor="tf-qty" error={err('qty')}>
          <Stepper id="tf-qty" label="Quantity" value={d.qty} onChange={(v) => set('qty', v)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Entry" htmlFor="tf-entry" error={err('entry')}>
          <DecimalInput
            id="tf-entry"
            ref={entryRef}
            value={d.entry}
            onChange={(v) => set('entry', v)}
            placeholder="0.00"
            aria-invalid={!!err('entry')}
            enterKeyHint="next"
          />
        </Field>
        <Field label="Exit" htmlFor="tf-exit" error={err('exit')}>
          <DecimalInput
            id="tf-exit"
            value={d.exit}
            onChange={(v) => set('exit', v)}
            placeholder="0.00"
            aria-invalid={!!err('exit')}
            enterKeyHint="done"
          />
        </Field>
      </div>
    </div>
  );
}

/** Live preview: net P&L (fees included), fee line, R when a stop is set. */
export function PnlPreview({ draft, band }: { draft: TradeDraft; band: number }) {
  const { preview, fees, mult, assetType } = draft;
  return (
    <div className="rounded-card border border-line bg-inset px-4 py-3" aria-live="polite" data-testid="pnl-preview">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="caption">Net P&amp;L</p>
          {preview ? (
            <Money value={preview.net} flatBand={band} className="text-hero-sm" />
          ) : (
            <span className="num text-hero-sm text-ink-4">$—</span>
          )}
        </div>
        <div className="num flex flex-col items-end gap-0.5 text-caption text-ink-3">
          {preview && <span>gross {formatMoney(preview.net + fees, { sign: true })}</span>}
          <span data-testid="preview-fees">fees {formatMoney(fees)}</span>
          {assetType !== 'stock' && <span>×{mult.multiplier}</span>}
          {preview?.r !== null && preview?.r !== undefined && (
            <span className={preview.r >= 0 ? 'text-gain' : 'text-loss'}>
              {preview.r >= 0 ? '+' : '−'}
              {Math.abs(preview.r).toFixed(2)}R
            </span>
          )}
        </div>
      </div>
      {mult.unknown && assetType === 'futures' && draft.d.symbol.trim() && (
        <p className="mt-2 flex items-start gap-1.5 text-caption text-warn">
          <TriangleAlert size={14} className="mt-px shrink-0" />
          Unknown contract — P&amp;L uses ×1. Switch to Stock/Option if this isn’t a future.
        </p>
      )}
    </div>
  );
}

/** Optional details: setup, mistakes, mood, stop, fees, note, screenshots, date/time, account. */
export function DetailFields({
  draft,
  settings,
  accounts,
  showErrors,
  onAddFiles,
}: {
  draft: TradeDraft;
  settings: Settings;
  accounts: Account[];
  showErrors: boolean;
  onAddFiles: (files: File[]) => void;
}) {
  const { d, set, setD, errors, autoFees } = draft;
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : undefined);
  const liveAccounts = accounts.filter((a) => a.status !== 'archived' || a.id === d.accountId);

  return (
    <div className="flex flex-col gap-5">
      {settings.setups.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="caption mb-2">Setup</legend>
          <div className="flex flex-wrap gap-2">
            {settings.setups.map((s) => (
              <Chip key={s} selected={d.setup === s} onClick={() => set('setup', d.setup === s ? null : s)}>
                {s}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      {settings.mistakes.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="caption mb-2">Mistakes</legend>
          <div className="flex flex-wrap gap-2">
            {settings.mistakes.map((m) => {
              const on = d.mistakes.includes(m);
              return (
                <Chip
                  key={m}
                  tone="warn"
                  selected={on}
                  onClick={() => set('mistakes', on ? d.mistakes.filter((x) => x !== m) : [...d.mistakes, m])}
                >
                  {m}
                </Chip>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="caption mb-2">Mood</legend>
        <div className="grid grid-cols-5 gap-2" role="group" aria-label="Mood, 1 tilted to 5 calm">
          {([1, 2, 3, 4, 5] as const).map((m) => (
            <Chip
              key={m}
              selected={d.mood === m}
              onClick={() => set('mood', d.mood === m ? null : m)}
              className="num justify-center"
              aria-label={`Mood ${m}${m === 1 ? ' (tilted)' : m === 5 ? ' (calm)' : ''}`}
            >
              {m}
            </Chip>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-caption text-ink-4">
          <span>tilted</span>
          <span>calm</span>
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Stop" htmlFor="tf-stop" hint="Adds R" error={err('stop')}>
          <DecimalInput id="tf-stop" value={d.stop} onChange={(v) => set('stop', v)} placeholder="optional" />
        </Field>
        <Field
          label="Fees"
          htmlFor="tf-fees"
          error={err('fees')}
          hint={d.feesTouched ? (
            <button type="button" className="text-brand hover:underline" onClick={() => setD((s) => ({ ...s, feesTouched: false, fees: '' }))}>
              Reset to {formatMoney(autoFees)}
            </button>
          ) : 'From settings'}
        >
          <DecimalInput
            id="tf-fees"
            value={d.feesTouched ? d.fees : String(autoFees)}
            onChange={(v) => setD((s) => ({ ...s, fees: v, feesTouched: true }))}
          />
        </Field>
      </div>

      <Field label="Note" htmlFor="tf-notes">
        <textarea
          id="tf-notes"
          className="field"
          rows={3}
          maxLength={5000}
          value={d.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="What did you see? (Enter saves, Shift+Enter for a new line)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
      </Field>

      <PhotoField draft={draft} onAddFiles={onAddFiles} />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="tf-date" error={err('date')}>
          <TextInput id="tf-date" type="date" value={d.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Time" htmlFor="tf-time">
          <TextInput id="tf-time" type="time" value={d.time} onChange={(e) => set('time', e.target.value)} />
        </Field>
      </div>

      {liveAccounts.length > 0 && (
        <fieldset>
          <legend className="caption mb-2">Account</legend>
          <div className="flex flex-wrap gap-2">
            <Chip selected={d.accountId === null} onClick={() => set('accountId', null)}>
              None
            </Chip>
            {liveAccounts.map((a) => (
              <Chip key={a.id} selected={d.accountId === a.id} onClick={() => set('accountId', a.id)}>
                {a.name}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

// ---------- screenshots ----------

function PhotoField({ draft, onAddFiles }: { draft: TradeDraft; onAddFiles: (files: File[]) => void }) {
  const { d, setD } = draft;
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const count = d.photoKeys.length + d.pending.length;
  const full = count >= MAX_PHOTOS;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="caption">Screenshots</span>
        <span className="num text-caption text-ink-4">
          {count}/{MAX_PHOTOS}
        </span>
      </div>
      <div
        onDragOver={(e) => {
          if (!full && [...e.dataTransfer.types].includes('Files')) {
            e.preventDefault();
            setDrag(true);
          }
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onAddFiles([...e.dataTransfer.files]);
        }}
        className={cx(
          'flex flex-wrap gap-2 rounded-card border border-dashed p-2 transition-colors',
          drag ? 'border-brand bg-brand-tint' : 'border-line-strong',
        )}
      >
        <PhotoThumbs
          keys={d.photoKeys}
          onRemove={(k) => setD((s) => ({ ...s, photoKeys: s.photoKeys.filter((x) => x !== k) }))}
        />
        <PendingThumbs files={d.pending} onRemove={(f) => setD((s) => ({ ...s, pending: s.pending.filter((x) => x !== f) }))} />
        {!full && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-16 min-w-[64px] flex-1 items-center justify-center gap-2 rounded-control px-3 text-body text-ink-3 hover:bg-surface-2 hover:text-ink-1"
          >
            <ImagePlus size={18} />
            <span>Add · paste · drop</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => {
            onAddFiles([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

function Thumb({ src, label, onRemove, onOpen }: { src?: string; label: string; onRemove: () => void; onOpen?: () => void }) {
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-control border border-line bg-inset">
      {src ? (
        <button type="button" onClick={onOpen} className="block h-full w-full" aria-label={`Open ${label}`}>
          <img src={src} alt="" className="h-full w-full object-cover" />
        </button>
      ) : (
        <div className="skeleton h-full w-full" />
      )}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 grid h-6 w-6 place-items-center rounded-full bg-[var(--scrim)] text-white"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function PhotoThumbs({ keys, onRemove }: { keys: string[]; onRemove?: (k: string) => void }) {
  const { photoUrls } = useStore();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const keyStr = keys.join('|');
  useEffect(() => {
    if (!keys.length) return;
    let live = true;
    photoUrls(keys)
      .then((u) => live && setUrls(u))
      .catch(() => {
        /* thumbnails are best-effort */
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyStr, photoUrls]);
  return (
    <>
      {keys.map((k, i) => (
        <Thumb
          key={k}
          src={urls[k]}
          label={`screenshot ${i + 1}`}
          onRemove={() => onRemove?.(k)}
          onOpen={() => urls[k] && window.open(urls[k], '_blank', 'noopener')}
        />
      ))}
    </>
  );
}

function PendingThumbs({ files, onRemove }: { files: File[]; onRemove: (f: File) => void }) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return (
    <>
      {files.map((f, i) => (
        <Thumb key={urls[i]} src={urls[i]} label={`new screenshot ${i + 1}`} onRemove={() => onRemove(f)} />
      ))}
    </>
  );
}

/** Pull image files from a paste event. */
export function imagesFromClipboard(e: React.ClipboardEvent): File[] {
  const out: File[] = [];
  for (const item of e.clipboardData?.items ?? []) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  return out;
}

export function acceptImages(files: File[], current: number): { ok: File[]; rejected: string | null } {
  const imgs = files.filter((f) => /^image\/(png|jpe?g|webp)$/.test(f.type));
  let rejected: string | null = imgs.length < files.length ? 'Only PNG, JPEG or WebP screenshots.' : null;
  const small = imgs.filter((f) => f.size <= 8 * 1024 * 1024);
  if (small.length < imgs.length) rejected = 'Screenshots must be 8 MB or smaller.';
  const room = Math.max(0, MAX_PHOTOS - current);
  if (small.length > room) rejected = `Up to ${MAX_PHOTOS} screenshots per trade.`;
  return { ok: small.slice(0, room), rejected };
}

/** Enter in any single-line input submits the form (explicit — implicit submission is unreliable with a hidden button). */
export function submitOnEnter(e: React.KeyboardEvent<HTMLFormElement>) {
  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
  const el = e.target as HTMLElement;
  if (el.tagName !== 'INPUT') return;
  const type = (el as HTMLInputElement).type;
  if (type === 'checkbox' || type === 'radio' || type === 'file') return;
  e.preventDefault();
  e.currentTarget.requestSubmit();
}

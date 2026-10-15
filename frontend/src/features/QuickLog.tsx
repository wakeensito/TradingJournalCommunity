import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useData, useStore } from '../lib/store';
import { useToast } from '../ui/Toast';
import { Sheet } from '../ui/Sheet';
import { Button, Chip, cx } from '../ui/controls';
import { Money } from '../ui/Money';
import { SessionTape } from '../ui/SessionTape';
import { dayLabel, pushRecentSymbol } from '../app/domain';
import { addDays, nowTimeLocal, todayLocal } from '../lib/dates';
import { FUTURE_TIME_HINT, defaultLogDate, impossibleTimeFix } from '../lib/logDate';
import { blankDraft, lastAccountId, rememberAccount, useTradeDraft } from './tradeDraft';
import { CoreFields, DetailFields, PnlPreview, acceptImages, imagesFromClipboard, submitOnEnter } from './TradeFields';

export function QuickLog({ open, date, onClose }: { open: boolean; date?: string | null; onClose: () => void }) {
  const [gen, setGen] = useState(0);
  if (!open) return null;
  return (
    <QuickLogInner
      key={gen}
      date={date ?? null}
      onClose={() => {
        setGen((g) => g + 1);
        onClose();
      }}
    />
  );
}

function QuickLogInner({ date, onClose }: { date: string | null; onClose: () => void }) {
  const data = useData();
  const { saveTrade, saveSettings, uploadPhoto } = useStore();
  const toast = useToast();
  const { settings, accounts, trades } = data;
  // Why the date isn't today: 'yesterday' = late-night default (nothing logged today yet), 'future' = the time typed
  // hasn't happened yet today. Either shows a "Yesterday" chip that switches back to today.
  const [dateHint, setDateHint] = useState<'yesterday' | 'future' | null>(() =>
    !date && defaultLogDate(new Date(), trades.map((t) => t.date)).yesterday ? 'yesterday' : null,
  );

  const draft = useTradeDraft(
    () => {
      const b = blankDraft({ symbol: settings.recentSymbols[0] ?? '', accountId: lastAccountId(accounts, settings) });
      const target = date ?? (dateHint === 'yesterday' ? addDays(b.date, -1) : null);
      if (target && target !== b.date) {
        b.date = target;
        b.time = '';
      }
      return b;
    },
    settings,
    trades,
  );
  const { d, setD, valid, errors, build } = draft;

  // A time later than now can't be today: move the date to yesterday (the trader can still change it back).
  // Keyed on the time only, so picking a date by hand afterwards is respected.
  useEffect(() => {
    const fix = impossibleTimeFix(d.date, d.time, new Date());
    if (fix) {
      setD((s) => ({ ...s, date: fix }));
      setDateHint('future');
    }
  }, [d.time]);

  const yesterday = addDays(todayLocal(), -1);
  const showYesterday = dateHint !== null && d.date === yesterday;
  const switchToToday = () => {
    setD((s) => ({ ...s, date: todayLocal(), time: !s.time || impossibleTimeFix(todayLocal(), s.time, new Date()) ? nowTimeLocal() : s.time }));
    setDateHint(null);
  };

  const [details, setDetails] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{ id: string; net: number; date: string } | null>(null);
  const symbolRef = useRef<HTMLInputElement>(null);
  const entryRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const addFiles = (files: File[]) => {
    const { ok, rejected } = acceptImages(files, d.photoKeys.length + d.pending.length);
    if (rejected) toast.show(rejected, { tone: 'error' });
    if (ok.length) {
      setD((s) => ({ ...s, pending: [...s.pending, ...ok] }));
      setDetails(true);
    }
  };

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setShowErrors(true);
    if (!valid) {
      const first = (['symbol', 'qty', 'entry', 'exit'] as const).find((k) => errors[k]);
      const id = first ? `tf-${first}` : null;
      if (id) document.getElementById(id)?.focus();
      else setDetails(true);
      return;
    }
    const t = build();
    if (d.pending.length) {
      setBusy(true);
      const keys: string[] = [];
      for (const f of d.pending) {
        try {
          keys.push(await uploadPhoto(t.id, f));
        } catch (err) {
          toast.show(`Screenshot didn’t upload: ${err instanceof Error ? err.message : 'unknown error'}`, { tone: 'error' });
        }
      }
      setBusy(false);
      if (keys.length) t.photoKeys = [...(t.photoKeys ?? []), ...keys];
    }
    // Optimistic: the store applies instantly and rolls back + toasts on failure.
    void saveTrade(t);
    rememberAccount(t.accountId);
    const nextSettings = pushRecentSymbol(settings, t.symbol);
    if (nextSettings) void saveSettings(nextSettings);

    const net = draft.preview?.net ?? 0;
    setSuccess({ id: t.id, net, date: t.date });
    setShowErrors(false);
    setDetails(false);
    const next = blankDraft({ symbol: d.symbol, accountId: d.accountId, assetType: d.assetType });
    next.assetTouched = d.assetTouched;
    next.date = d.date;
    if (d.date !== todayLocal()) next.time = d.time;
    setD(next);
    window.setTimeout(() => entryRef.current?.focus({ preventScroll: true }), 0);
  }

  const dayTrades = success ? data.trades.filter((t) => t.date === success.date) : [];

  return (
    <Sheet
      open
      onClose={onClose}
      title={date && date !== todayLocal() ? `Log a trade · ${dayLabel(date)}` : 'Log a trade'}
      subtitle={<span className="hidden md:inline">Enter saves · Esc closes</span>}
      initialFocus={settings.recentSymbols[0] ? entryRef : symbolRef}
      testId="quick-log"
      footer={
        success ? (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={onClose}>Done</Button>
            <Button
              variant="primary"
              onClick={() => {
                setSuccess(null);
                entryRef.current?.focus();
              }}
            >
              Log another
            </Button>
          </div>
        ) : (
          <Button variant="primary" block loading={busy} onClick={() => formRef.current?.requestSubmit()}>
            Log trade
          </Button>
        )
      }
    >
      <form
        ref={formRef}
        onSubmit={submit}
        onKeyDown={submitOnEnter}
        noValidate
        onInput={() => success && setSuccess(null)}
        onPaste={(e) => {
          const imgs = imagesFromClipboard(e);
          if (imgs.length) {
            e.preventDefault();
            addFiles(imgs);
          }
        }}
        className="flex flex-col gap-4"
      >
        {success && (
          <div
            role="status"
            data-testid="quicklog-success"
            className="anim-rise flex flex-col gap-2 rounded-card border border-line bg-surface-2 px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-medium">
                <Check size={16} className="text-gain" />
                Logged
                {success.date !== todayLocal() && <span className="text-ink-3">· {dayLabel(success.date)}</span>}
              </span>
              <Money value={success.net} flatBand={settings.breakevenBand} className="text-[17px]" />
            </div>
            <SessionTape trades={dayTrades} size="sm" band={settings.breakevenBand} animateId={success.id} />
          </div>
        )}

        {showYesterday && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="ql-yesterday">
            <Chip selected onClick={switchToToday} aria-label="Logging for yesterday. Tap to log for today instead">
              Yesterday
            </Chip>
            <span role="status" className="text-caption text-ink-3">
              {dateHint === 'future' ? FUTURE_TIME_HINT : 'Tap to log for today'}
            </span>
          </div>
        )}

        <CoreFields draft={draft} settings={settings} showErrors={showErrors} symbolRef={symbolRef} entryRef={entryRef} />
        <PnlPreview draft={draft} band={settings.breakevenBand} />

        <div className="rounded-card border border-line">
          <button
            type="button"
            aria-expanded={details}
            aria-controls="ql-details"
            onClick={() => setDetails((v) => !v)}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-card px-4 text-body text-ink-2 hover:text-ink-1"
          >
            <span className="min-w-0 truncate text-left">
              Add details
              <DetailSummary setup={d.setup} mistakes={d.mistakes.length} note={!!d.notes.trim()} photos={d.pending.length} />
            </span>
            <ChevronDown size={16} className={cx('transition-transform duration-[180ms]', details && 'rotate-180')} />
          </button>
          {details && (
            <div id="ql-details" className="border-t border-line px-4 pt-4 pb-4">
              <DetailFields draft={draft} settings={settings} accounts={accounts} showErrors={showErrors} onAddFiles={addFiles} />
            </div>
          )}
        </div>
        {/* Hidden submit so Enter in any single-line input saves. */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}

function DetailSummary({ setup, mistakes, note, photos }: { setup: string | null; mistakes: number; note: boolean; photos: number }) {
  const parts = [setup, mistakes ? `${mistakes} mistake${mistakes > 1 ? 's' : ''}` : null, note ? 'note' : null, photos ? `${photos} screenshot${photos > 1 ? 's' : ''}` : null].filter(Boolean);
  if (!parts.length) return <span className="text-ink-3"> · setup, mistakes, note, screenshot</span>;
  return <span className="text-ink-3"> · {parts.join(', ')}</span>;
}

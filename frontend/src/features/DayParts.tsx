import { useState, type FormEvent } from 'react';
import { Check, ChevronDown, Pencil } from 'lucide-react';
import type { DayNote, Trade } from '../lib/types';
import { useData, useStore } from '../lib/store';
import { netPnl } from '../lib/pnl';
import { formatPrice } from '../lib/format';
import { Button, Chip, Field, SegmentedControl, TextInput, cx } from '../ui/controls';
import { Money } from '../ui/Money';
import { time12 } from '../app/domain';
import { useToast } from '../ui/Toast';

// ---------- trade rows ----------

export function TradeRow({
  t,
  band,
  onOpen,
  selectable,
  selected,
  onToggle,
  showDate,
}: {
  t: Trade;
  band: number;
  onOpen: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  showDate?: string;
}) {
  const net = netPnl(t);
  const body = (
    <>
      <span className="num w-11 shrink-0 text-caption text-ink-3">{showDate ?? time12(t.time) ?? ''}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="num truncate font-medium text-ink-1">{t.symbol}</span>
          <span className={cx('text-caption font-medium', t.side === 'long' ? 'text-gain' : 'text-loss')}>
            {t.side === 'long' ? 'L' : 'S'}
          </span>
          {t.mistakes && t.mistakes.length > 0 && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" title={t.mistakes.join(', ')} aria-label={`${t.mistakes.length} mistake tagged`} />
          )}
        </span>
        <span className="truncate text-caption text-ink-3 tabular-nums">
          {t.qty} @ {formatPrice(t.entry)} → {formatPrice(t.exit)}
          {t.setup ? <> · {t.setup}</> : null}
        </span>
      </span>
      <Money value={net} flatBand={band} className="shrink-0 text-body" />
    </>
  );
  if (selectable) {
    return (
      <label className={cx('flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2 transition-colors', selected ? 'bg-brand-tint' : 'hover:bg-surface-2')}>
        <input type="checkbox" checked={!!selected} onChange={onToggle} className="h-5 w-5 shrink-0 accent-[var(--brand)]" aria-label={`Select ${t.symbol} ${t.time ?? ''}`} />
        {body}
      </label>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="trade-row"
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-[120ms] hover:bg-surface-2 active:bg-surface-2"
    >
      {body}
    </button>
  );
}

export function TradeList({ trades, band, onOpen }: { trades: Trade[]; band: number; onOpen: (id: string) => void }) {
  return (
    <ul className="divide-y divide-line-soft">
      {trades.map((t) => (
        <li key={t.id}>
          <TradeRow t={t} band={band} onOpen={() => onOpen(t.id)} />
        </li>
      ))}
    </ul>
  );
}

// ---------- close the day ----------

export function CloseDayCard({ date, compact }: { date: string; compact?: boolean }) {
  const { days } = useData();
  const existing = days.find((x) => x.date === date);
  const review = existing?.review;
  const hasReview = !!(review && (review.text || review.followedPlan !== undefined || review.mood));
  const [editing, setEditing] = useState(!hasReview);

  return (
    <section className={cx('card', compact ? 'p-4' : 'p-4 md:p-5')} aria-labelledby={`close-${date}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id={`close-${date}`} className="text-[15px] leading-6 font-semibold">
          {hasReview && !editing ? 'Day closed' : 'Close the day'}
        </h2>
        {hasReview && !editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Edit
          </Button>
        )}
      </div>
      {hasReview && !editing ? (
        <div className="flex flex-col gap-2" data-testid="day-review">
          {review?.text && <p className="text-ink-1">“{review.text}”</p>}
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-body text-ink-3">
            {review?.followedPlan !== undefined && review?.followedPlan !== null && (
              <span>
                Followed plan:{' '}
                <span className={review.followedPlan ? 'text-ink-1' : 'text-warn'}>{review.followedPlan ? 'Yes' : 'No'}</span>
              </span>
            )}
            {review?.mood && (
              <span>
                Mood: <span className="num text-ink-1">{review.mood}/5</span>
              </span>
            )}
          </p>
        </div>
      ) : (
        <CloseDayForm date={date} existing={existing} onDone={() => setEditing(false)} />
      )}
    </section>
  );
}

function CloseDayForm({ date, existing, onDone }: { date: string; existing?: DayNote; onDone: () => void }) {
  const { saveDay } = useStore();
  const toast = useToast();
  const r = existing?.review;
  const [text, setText] = useState(r?.text ?? '');
  const [followed, setFollowed] = useState<'yes' | 'no' | null>(r?.followedPlan === true ? 'yes' : r?.followedPlan === false ? 'no' : null);
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5 | null>(r?.mood ?? null);
  const empty = !text.trim() && followed === null && mood === null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (empty) return;
    const review: NonNullable<DayNote['review']> = {};
    if (text.trim()) review.text = text.trim();
    review.followedPlan = followed === null ? null : followed === 'yes';
    if (mood) review.mood = mood;
    const ok = await saveDay({ ...(existing ?? { date }), date, review, updatedAt: new Date().toISOString() });
    if (ok) {
      toast.show('Day closed.', { tone: 'success' });
      onDone();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="One line" htmlFor={`cd-text-${date}`}>
        <TextInput
          id={`cd-text-${date}`}
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          placeholder="What happened today?"
          enterKeyHint="done"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="caption">Followed plan</span>
          <SegmentedControl
            label="Followed plan"
            value={followed}
            onChange={setFollowed}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="caption">Mood</span>
          <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Mood, 1 tilted to 5 calm">
            {([1, 2, 3, 4, 5] as const).map((m) => (
              <Chip key={m} selected={mood === m} onClick={() => setMood(mood === m ? null : m)} className="num justify-center px-0" aria-label={`Mood ${m}`}>
                {m}
              </Chip>
            ))}
          </div>
        </div>
      </div>
      <Button type="submit" variant="primary" disabled={empty} className="self-start max-sm:self-stretch">
        <Check size={16} /> Close the day
      </Button>
    </form>
  );
}

// ---------- pre-market plan ----------

export function PlanCard({ date, defaultOpen }: { date: string; defaultOpen?: boolean }) {
  const { days } = useData();
  const { saveDay } = useStore();
  const toast = useToast();
  const existing = days.find((x) => x.date === date);
  const p = existing?.plan;
  const [open, setOpen] = useState(!!defaultOpen);
  const [bias, setBias] = useState<'long' | 'neutral' | 'short' | null>(p?.bias ?? null);
  const [levels, setLevels] = useState(p?.levels ?? '');
  const [focus, setFocus] = useState(p?.focus ?? '');
  const has = !!(p && (p.bias || p.levels || p.focus));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const plan: NonNullable<DayNote['plan']> = {};
    if (bias) plan.bias = bias;
    if (levels.trim()) plan.levels = levels.trim();
    if (focus.trim()) plan.focus = focus.trim();
    const ok = await saveDay({ ...(existing ?? { date }), date, plan, updatedAt: new Date().toISOString() });
    if (ok) {
      toast.show('Plan saved.', { tone: 'success' });
      setOpen(false);
    }
  }

  return (
    <section className="card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-card px-4 text-left md:px-5"
      >
        <span className="min-w-0">
          <span className="font-semibold">Pre-market plan</span>
          {!open && (
            <span className="ml-2 truncate text-body text-ink-3">
              {has ? [p?.bias && `${p.bias} bias`, p?.focus].filter(Boolean).join(' · ') || 'Saved' : 'Optional'}
            </span>
          )}
        </span>
        <ChevronDown size={16} className={cx('shrink-0 text-ink-3 transition-transform duration-[180ms]', open && 'rotate-180')} />
      </button>
      {open && (
        <form onSubmit={submit} className="flex flex-col gap-4 border-t border-line px-4 pt-4 pb-4 md:px-5" noValidate>
          {/* MOUNT: market context — pre-market levels/strip can go here. */}
          <div className="flex flex-col gap-1.5">
            <span className="caption">Bias</span>
            <SegmentedControl
              label="Bias"
              value={bias}
              onChange={setBias}
              options={[
                { value: 'long', label: 'Long', tone: 'gain' },
                { value: 'neutral', label: 'Neutral' },
                { value: 'short', label: 'Short', tone: 'loss' },
              ]}
            />
          </div>
          <Field label="Key levels" htmlFor={`pl-levels-${date}`}>
            <TextInput id={`pl-levels-${date}`} mono value={levels} maxLength={500} onChange={(e) => setLevels(e.target.value)} placeholder="21050 resistance, 20980 VWAP" />
          </Field>
          <Field label="Focus" htmlFor={`pl-focus-${date}`}>
            <TextInput id={`pl-focus-${date}`} value={focus} maxLength={500} onChange={(e) => setFocus(e.target.value)} placeholder="Wait for the pullback. Max 3 trades." />
          </Field>
          <Button type="submit" variant="primary" className="self-start max-sm:self-stretch">
            Save plan
          </Button>
        </form>
      )}
    </section>
  );
}

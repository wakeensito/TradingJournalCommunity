import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Minus, Plus, X } from 'lucide-react';

export function cx(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}

// ---------- Button ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'sm';
  loading?: boolean;
  block?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand text-white border border-transparent hover:bg-[color-mix(in_oklab,var(--brand)_88%,white)] active:bg-[color-mix(in_oklab,var(--brand)_85%,black)] disabled:bg-surface-2 disabled:text-ink-4 disabled:border-line',
  secondary:
    'bg-surface-2 text-ink-1 border border-line-strong hover:border-[color-mix(in_oklab,var(--ink-3)_45%,transparent)] active:bg-surface-1 disabled:text-ink-4 disabled:border-line',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-surface-2 hover:text-ink-1 active:bg-surface-1 disabled:text-ink-4',
  danger:
    'bg-transparent text-loss border border-[color-mix(in_oklab,var(--loss)_35%,transparent)] hover:bg-loss-tint active:bg-[color-mix(in_oklab,var(--loss)_18%,transparent)] disabled:text-ink-4 disabled:border-line',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition-colors duration-[120ms] ease-quiet select-none',
        size === 'md' ? 'min-h-11 px-4 text-body' : 'min-h-9 px-3 text-body max-md:min-h-11',
        block && 'w-full',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'grid h-11 w-11 shrink-0 place-items-center rounded-control text-ink-2 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-ink-1 active:bg-surface-1 disabled:text-ink-4',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="spin shrink-0" width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ---------- Segmented control (CSS grid — never an absolutely positioned thumb) ----------

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  tone?: 'gain' | 'loss';
  ariaLabel?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: SegOption<T>[];
  label: string;
  size?: 'md' | 'sm';
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('grid rounded-full border border-line bg-inset p-[3px]', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const i = Math.max(0, options.findIndex((o) => o.value === value));
        const n = options[(i + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length];
        if (n) {
          onChange(n.value);
          const btns = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=radio]');
          btns[options.indexOf(n)]?.focus();
        }
      }}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        const tabbable = active || (value === null && i === 0);
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.ariaLabel}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cx(
              'min-w-0 truncate rounded-full border font-medium transition-colors duration-[120ms]',
              size === 'md' ? 'min-h-[38px] px-3' : 'min-h-[30px] px-2 text-caption max-md:min-h-[38px]',
              active
                ? cx(
                    'border-line-strong bg-surface-2',
                    o.tone === 'gain' ? 'text-gain' : o.tone === 'loss' ? 'text-loss' : 'text-ink-1',
                  )
                : 'border-transparent text-ink-3 hover:text-ink-1',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Chip ----------

export function Chip({
  selected,
  tone = 'brand',
  onClick,
  onRemove,
  children,
  className,
  ...rest
}: {
  selected?: boolean;
  tone?: 'brand' | 'warn';
  onClick?: () => void;
  onRemove?: () => void;
  children: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  const sel =
    tone === 'warn'
      ? 'border-[color-mix(in_oklab,var(--warn)_70%,transparent)] text-warn bg-warn-tint'
      : 'border-[color-mix(in_oklab,var(--brand)_70%,transparent)] text-ink-1 bg-brand-tint';
  if (onRemove) {
    return (
      <span
        className={cx(
          'inline-flex h-9 max-w-full items-center gap-1 rounded-control border border-line bg-inset pl-3 text-body text-ink-1 md:h-8',
          className,
        )}
      >
        <span className="truncate">{children}</span>
        <button
          type="button"
          aria-label={`Remove ${typeof children === 'string' ? children : ''}`}
          onClick={onRemove}
          className="grid h-full w-8 place-items-center rounded-r-control text-ink-3 hover:text-loss"
        >
          <X size={14} />
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        'inline-flex h-9 max-w-full shrink-0 items-center gap-1.5 rounded-control border px-3 text-body whitespace-nowrap transition-colors duration-[120ms] md:h-8',
        selected ? sel : 'border-line bg-inset text-ink-2 hover:border-line-strong hover:text-ink-1',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ---------- Field wrapper ----------

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
  aside,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex min-h-4 items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="caption">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p className="text-caption text-loss" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(
  function TextInput({ className, mono, ...rest }, ref) {
    return <input ref={ref} className={cx('field', mono && 'num', className)} {...rest} />;
  },
);

/** Decimal input: text field with inputmode=decimal so phones show the number pad. */
export const DecimalInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: string; onChange: (v: string) => void }
>(function DecimalInput({ value, onChange, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.,\-]/g, '').replace(',', '.'))}
      className={cx('field num', className)}
      {...rest}
    />
  );
});

export function parseDecimal(s: string): number | null {
  if (s.trim() === '' || s.trim() === '-' || s.trim() === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ---------- Stepper ----------

export function Stepper({
  value,
  onChange,
  label,
  min = 1,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  min?: number;
  id?: string;
}) {
  const n = parseDecimal(value) ?? 0;
  const set = (x: number) => onChange(String(Math.max(min, Math.round(x * 1000) / 1000)));
  return (
    <div className="grid h-11 grid-cols-[44px_minmax(0,1fr)_44px] overflow-hidden rounded-control border border-line bg-inset focus-within:border-[color-mix(in_oklab,var(--brand)_60%,transparent)]">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={n <= min}
        onClick={() => set(n - 1)}
        className="grid place-items-center text-ink-2 hover:bg-surface-2 hover:text-ink-1 disabled:text-ink-4 disabled:hover:bg-transparent"
      >
        <Minus size={16} />
      </button>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
        onFocus={(e) => e.currentTarget.select()}
        className="num min-w-0 border-x border-line bg-transparent text-center text-input focus-visible:shadow-none"
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => set(n + 1)}
        className="grid place-items-center text-ink-2 hover:bg-surface-2 hover:text-ink-1"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

// ---------- Section heading ----------

export function SectionTitle({ children, aside, id }: { children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
      <h2 id={id} className="text-[15px] leading-6 font-semibold tracking-[-0.005em] text-ink-1">
        {children}
      </h2>
      {aside}
    </div>
  );
}

export function useFieldId(prefix: string): string {
  return `${prefix}-${useId().replace(/:/g, '')}`;
}

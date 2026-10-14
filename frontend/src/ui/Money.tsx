import { formatMoney } from '../lib/format';
import { cx } from './controls';

/** Mono money with sign and gain/loss/flat colour. `flatBand` treats |v| ≤ band as breakeven. */
export function Money({
  value,
  compact,
  className,
  muted,
  flatBand = 0,
  noSign,
}: {
  value: number;
  compact?: boolean;
  className?: string;
  muted?: boolean;
  flatBand?: number;
  noSign?: boolean;
}) {
  const tone = Math.abs(value) <= Math.abs(flatBand) || value === 0 ? 'flat' : value > 0 ? 'gain' : 'loss';
  return (
    <span
      className={cx(
        'num whitespace-nowrap',
        muted ? 'text-ink-2' : tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-flat',
        className,
      )}
    >
      {formatMoney(value, { sign: !noSign, compact })}
    </span>
  );
}

export function moneyText(value: number, compact = false): string {
  return formatMoney(value, { sign: true, compact });
}

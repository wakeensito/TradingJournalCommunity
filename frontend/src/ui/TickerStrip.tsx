import type { ReactNode } from 'react';
import { cx } from './controls';

export interface TickerItem {
  label: string;
  value: ReactNode;
  title?: string;
}

/** Horizontal row of caption-label / mono-value pairs with hairline separators. Scrolls on mobile, never wraps. */
export function TickerStrip({ items, className }: { items: TickerItem[]; className?: string }) {
  return (
    <div className={cx('scroll-x -mx-4 px-4 md:mx-0 md:px-0', className)}>
      <dl className="flex w-max min-w-full divide-x divide-line rounded-card border border-line bg-surface-1">
        {items.map((it) => (
          <div key={it.label} className="flex min-w-[104px] flex-1 flex-col gap-1 px-4 py-3" title={it.title}>
            <dt className="caption whitespace-nowrap">{it.label}</dt>
            <dd className="num text-[17px] leading-6 whitespace-nowrap text-ink-1">{it.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

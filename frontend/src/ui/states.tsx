import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, cx } from './controls';

export function EmptyState({
  title,
  body,
  action,
  secondary,
  art,
  className,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  secondary?: ReactNode;
  art?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center px-4 py-10 text-center', className)}>
      {art ?? <FlatTape />}
      <h3 className="mt-4 text-[15px] leading-6 font-semibold text-ink-1">{title}</h3>
      {body && <p className="mt-1 max-w-[34ch] text-body text-ink-3">{body}</p>}
      {(action || secondary) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}

/** A tape with no ticks — the empty-state mark, drawn from the signature. */
function FlatTape() {
  return (
    <svg width="120" height="32" viewBox="0 0 120 32" aria-hidden>
      <line x1="0" x2="120" y1="16" y2="16" stroke="var(--line-strong)" />
      {[14, 30, 46].map((x, i) => (
        <line key={x} x1={x} x2={x} y1="16" y2={i === 1 ? 22 : 10} stroke="var(--ink-4)" strokeWidth="4" />
      ))}
      <line x1="62" x2="62" y1="11" y2="21" stroke="var(--brand)" strokeWidth="1.5" strokeDasharray="2 2" />
    </svg>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-start gap-3 border-[color-mix(in_oklab,var(--loss)_30%,transparent)] p-4">
      <div>
        <p className="font-medium text-ink-1">Couldn’t load this.</p>
        <p className="mt-1 text-body text-ink-3">{message}</p>
      </div>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={cx('skeleton', className)} style={style} />;
}

export function ScreenSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-4">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-12 w-52" />
      <Skeleton className="h-[72px] w-full" />
      <div className="card flex flex-col gap-3 p-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-[420px] px-4 py-16">
        <div className="card p-5">
          <p className="caption">Something broke</p>
          <h1 className="mt-2 text-title font-semibold">This screen hit an error.</h1>
          <p className="mt-2 text-body text-ink-3">Your saved data is safe. Reload to continue.</p>
          <pre className="num mt-3 max-h-32 overflow-auto rounded-control bg-inset p-3 text-caption whitespace-pre-wrap text-ink-3">
            {this.state.error.message}
          </pre>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={() => location.reload()}>
              Reload
            </Button>
            <Button onClick={() => this.setState({ error: null })}>Dismiss</Button>
          </div>
        </div>
      </div>
    );
  }
}

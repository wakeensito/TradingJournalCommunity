import { useEffect, useState } from 'react';
import { Check, CloudOff } from 'lucide-react';
import { useStore } from '../lib/store';
import { Spinner, cx } from '../ui/controls';

/** Tiny save indicator: "Saving…" / "Saved" / "Offline — retry". Quiet unless something is wrong. */
export function SaveStatusBadge({ compact }: { compact?: boolean }) {
  const { save, status } = useStore();
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    if (!save.lastSavedAt) return;
    setFresh(true);
    const t = window.setTimeout(() => setFresh(false), 2500);
    return () => window.clearTimeout(t);
  }, [save.lastSavedAt]);

  if (status !== 'ready') return null;

  if (save.failed) {
    return (
      <button
        type="button"
        onClick={save.failed.retry}
        data-testid="save-status"
        className={cx(
          'inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-caption font-medium text-warn hover:bg-warn-tint',
          !compact && 'flex-col gap-0.5 px-1 py-1 text-[11px] leading-4',
        )}
        title={save.failed.message}
      >
        <CloudOff size={14} />
        {save.failed.offline ? (compact ? 'Offline — retry' : 'Retry') : compact ? 'Not saved — retry' : 'Retry'}
      </button>
    );
  }

  const saving = save.pending > 0;
  if (compact && !saving && !fresh) return null;
  return (
    <span
      role="status"
      data-testid="save-status"
      className={cx(
        'inline-flex items-center gap-1.5 px-2 text-caption transition-opacity duration-[180ms]',
        compact ? 'min-h-11' : 'flex-col gap-0.5 px-1 py-1 text-[11px] leading-4',
        saving ? 'text-ink-3' : fresh ? 'text-ink-3' : 'text-ink-4',
      )}
      aria-live="polite"
    >
      {saving ? <Spinner size={12} /> : <Check size={12} />}
      {saving ? 'Saving…' : 'Saved'}
    </span>
  );
}

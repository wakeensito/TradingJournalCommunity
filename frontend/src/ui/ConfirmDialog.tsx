import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './controls';
import { useOverlay } from './Sheet';

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useOverlay(open, panel, onCancel, cancelRef);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="anim-fade absolute inset-0" style={{ background: 'var(--scrim)' }} onClick={onCancel} aria-hidden />
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="anim-rise relative w-full max-w-[380px] rounded-card border border-line-strong bg-surface-1 p-5"
        style={{ boxShadow: 'var(--sheet-shadow)' }}
      >
        <h2 id={titleId} className="text-[17px] leading-6 font-semibold">
          {title}
        </h2>
        {body && <div className="mt-2 text-body text-ink-2">{body}</div>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button ref={cancelRef} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

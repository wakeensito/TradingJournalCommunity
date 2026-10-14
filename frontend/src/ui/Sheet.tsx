import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx, IconButton } from './controls';
import { useMediaQuery } from './useMediaQuery';

// ---------- shared overlay plumbing ----------

const stack: string[] = [];
let lockCount = 0;
let savedOverflow = '';

function lockScroll() {
  if (lockCount++ === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
}
function unlockScroll() {
  if (--lockCount <= 0) {
    lockCount = 0;
    document.body.style.overflow = savedOverflow;
  }
}

/** Whether any sheet/dialog is open (used by the global `N` shortcut). */
export function overlayOpen(): boolean {
  return stack.length > 0;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useOverlay(open: boolean, panel: RefObject<HTMLElement | null>, onClose: () => void, initialFocus?: RefObject<HTMLElement | null>) {
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    stack.push(id);
    lockScroll();
    const t = window.setTimeout(() => {
      const el = initialFocus?.current ?? panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current;
      el?.focus({ preventScroll: true });
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key === 'Tab' && panel.current) {
        const els = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
        if (!els.length) return;
        const first = els[0]!;
        const last = els[els.length - 1]!;
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      const i = stack.lastIndexOf(id);
      if (i >= 0) stack.splice(i, 1);
      unlockScroll();
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);
}

/** iOS Safari doesn't shrink dvh for the keyboard; track it via visualViewport and expose --kb. */
function useKeyboardInset(active: boolean) {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return;
    const root = document.documentElement;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--kb', `${kb > 80 ? kb : 0}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.setProperty('--kb', '0px');
    };
  }, [active]);
}

// ---------- Sheet ----------

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  headerAside,
  initialFocus,
  wide,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  headerAside?: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
  wide?: boolean;
  testId?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const desktop = useMediaQuery('(min-width: 768px)');
  const titleId = useId();
  useOverlay(open, panel, onClose, initialFocus);
  useKeyboardInset(open && !desktop);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" data-testid={testId}>
      <div className="anim-fade absolute inset-0" style={{ background: 'var(--scrim)' }} onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'absolute flex flex-col border-line-strong bg-surface-1 outline-none',
          desktop
            ? cx('anim-sheet-left top-0 right-0 bottom-0 border-l', wide ? 'w-[min(640px,100vw)]' : 'w-[min(440px,100vw)]')
            : 'anim-sheet-up inset-x-0 rounded-t-sheet border-t',
        )}
        style={
          desktop
            ? { boxShadow: 'var(--sheet-shadow)' }
            : {
                bottom: 'var(--kb)',
                maxHeight: 'calc(92dvh - var(--kb))',
                boxShadow: 'var(--sheet-shadow)',
              }
        }
      >
        {!desktop && <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong" />}
        <header className="flex shrink-0 items-start gap-2 px-4 pt-2 pb-2 md:px-5 md:pt-4">
          <div className="min-w-0 flex-1 pt-2">
            <h2 id={titleId} className="truncate text-title font-semibold">
              {title}
            </h2>
            {subtitle && <div className="mt-0.5 text-body text-ink-3">{subtitle}</div>}
          </div>
          {headerAside}
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X size={18} />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 md:px-5">{children}</div>
        {footer && (
          <footer
            className="shrink-0 border-t border-line bg-surface-1 px-4 pt-3 md:px-5"
            style={{ paddingBottom: desktop ? 16 : 'calc(12px + var(--safe-bottom))' }}
          >
            {footer}
          </footer>
        )}
        {!footer && !desktop && <div className="shrink-0" style={{ height: 'var(--safe-bottom)' }} />}
      </div>
    </div>,
    document.body,
  );
}

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

type Tone = 'neutral' | 'error' | 'success';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
  action?: { label: string; run: () => void };
}
interface ToastApi {
  show: (message: string, opts?: { tone?: Tone; action?: ToastItem['action']; ms?: number }) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const show = useCallback<ToastApi['show']>(
    (message, opts) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-2), { id, message, tone: opts?.tone ?? 'neutral', action: opts?.action }]);
      window.setTimeout(() => dismiss(id), opts?.ms ?? (opts?.tone === 'error' ? 6000 : 3500));
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(8px+var(--safe-top))] z-[70] flex flex-col items-center gap-2 px-4 md:top-auto md:bottom-4 md:items-end md:pr-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="anim-rise pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-card border border-line-strong bg-surface-2 py-2 pr-2 pl-4 text-body text-ink-1"
            style={{ boxShadow: 'var(--sheet-shadow)' }}
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                background: t.tone === 'error' ? 'var(--loss)' : t.tone === 'success' ? 'var(--gain)' : 'var(--ink-3)',
              }}
            />
            <span className="min-w-0 flex-1 py-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="min-h-[36px] shrink-0 rounded-control px-3 font-medium text-brand hover:bg-brand-tint"
                onClick={() => {
                  t.action?.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-control text-ink-3 hover:bg-surface-1 hover:text-ink-1"
              onClick={() => dismiss(t.id)}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast outside ToastProvider');
  return v;
}

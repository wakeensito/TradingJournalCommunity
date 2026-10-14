// App data store: Bootstrap loaded once after sign-in, optimistic per-entity mutations with rollback.
// One document per write — never whole collections.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, putToPresigned } from './api';
import { DEFAULT_SETTINGS, type Account, type Bootstrap, type DayNote, type Settings, type Trade } from './types';
import { useToast } from '../ui/Toast';

// ---------- state ----------

export type LoadStatus = 'loading' | 'ready' | 'error';
interface State {
  status: LoadStatus;
  data: Bootstrap | null;
  error: string | null;
}

type Action =
  | { type: 'load-start' }
  | { type: 'load-ok'; data: Bootstrap }
  | { type: 'load-err'; error: string }
  | { type: 'upsert-trades'; trades: Trade[] }
  | { type: 'remove-trades'; ids: string[] }
  | { type: 'upsert-day'; day: DayNote }
  | { type: 'remove-day'; date: string }
  | { type: 'upsert-account'; account: Account }
  | { type: 'remove-account'; id: string }
  | { type: 'set-settings'; settings: Settings };

function reduce(s: State, a: Action): State {
  if (a.type === 'load-start') return { status: 'loading', data: s.data, error: null };
  if (a.type === 'load-ok') return { status: 'ready', data: a.data, error: null };
  if (a.type === 'load-err') return { status: 'error', data: s.data, error: a.error };
  const d = s.data;
  if (!d) return s;
  switch (a.type) {
    case 'upsert-trades': {
      const byId = new Map(d.trades.map((t) => [t.id, t] as const));
      for (const t of a.trades) byId.set(t.id, t);
      return { ...s, data: { ...d, trades: [...byId.values()] } };
    }
    case 'remove-trades': {
      const ids = new Set(a.ids);
      return { ...s, data: { ...d, trades: d.trades.filter((t) => !ids.has(t.id)) } };
    }
    case 'upsert-day':
      return { ...s, data: { ...d, days: [...d.days.filter((x) => x.date !== a.day.date), a.day] } };
    case 'remove-day':
      return { ...s, data: { ...d, days: d.days.filter((x) => x.date !== a.date) } };
    case 'upsert-account':
      return {
        ...s,
        data: {
          ...d,
          accounts: d.accounts.some((x) => x.id === a.account.id)
            ? d.accounts.map((x) => (x.id === a.account.id ? a.account : x))
            : [...d.accounts, a.account],
        },
      };
    case 'remove-account':
      return { ...s, data: { ...d, accounts: d.accounts.filter((x) => x.id !== a.id) } };
    case 'set-settings':
      return { ...s, data: { ...d, settings: a.settings } };
  }
}

function normalize(b: Partial<Bootstrap> | null | undefined): Bootstrap {
  const settings = { ...DEFAULT_SETTINGS, ...(b?.settings ?? {}) } as Settings;
  settings.feesPerContract = { ...(b?.settings?.feesPerContract ?? DEFAULT_SETTINGS.feesPerContract) };
  if (settings.feesPerContract.default === undefined) settings.feesPerContract.default = 0;
  return {
    settings,
    accounts: Array.isArray(b?.accounts) ? b.accounts : [],
    trades: Array.isArray(b?.trades) ? b.trades : [],
    days: Array.isArray(b?.days) ? b.days : [],
  };
}

// ---------- save status ----------

export interface SaveStatus {
  pending: number;
  failed: null | { message: string; offline: boolean; retry: () => void };
  lastSavedAt: number | null;
}

// ---------- photos (module cache, cleared on sign-out) ----------

const PHOTO_TTL_MS = 50 * 60 * 1000;
const photoCache = new Map<string, { url: string; exp: number }>();
export function clearPhotoCache() {
  photoCache.clear();
}

/** Shrink screenshots to ≤ 2000px on the long edge (WebP, else JPEG). Falls back to the original on any failure. */
async function downscale(file: File): Promise<Blob> {
  const MAX = 2000;
  try {
    if (typeof createImageBitmap !== 'function') return file;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size <= 2 * 1024 * 1024) {
      bmp.close();
      return file;
    }
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.86));
    if (out && out.type === 'image/webp') return out;
    const jpg = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
    return jpg ?? file;
  } catch {
    return file;
  }
}

// ---------- context ----------

export interface StoreApi {
  status: LoadStatus;
  error: string | null;
  data: Bootstrap | null;
  save: SaveStatus;
  reload: () => void;
  saveTrade: (t: Trade) => Promise<boolean>;
  deleteTrades: (ids: string[]) => Promise<boolean>;
  importTrades: (trades: Trade[], onProgress?: (written: number) => void) => Promise<{ written: number; ok: boolean }>;
  combineTrades: (sourceIds: string[], merged: Trade) => Promise<boolean>;
  saveDay: (d: DayNote) => Promise<boolean>;
  saveAccount: (a: Account) => Promise<boolean>;
  deleteAccount: (id: string) => Promise<boolean>;
  saveSettings: (s: Settings) => Promise<boolean>;
  uploadPhoto: (tradeId: string, file: File) => Promise<string>;
  photoUrls: (keys: string[]) => Promise<Record<string, string>>;
}

const Ctx = createContext<StoreApi | null>(null);

function messageOf(e: unknown): { message: string; offline: boolean } {
  if (e instanceof ApiError) return { message: e.message, offline: e.status === 0 };
  if (e instanceof Error) return { message: e.message, offline: false };
  return { message: 'Something went wrong.', offline: false };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const ref = useRef<State>({ status: 'loading', data: null, error: null });
  const [state, setState] = useState<State>(ref.current);
  const [save, setSave] = useState<SaveStatus>({ pending: 0, failed: null, lastSavedAt: null });
  const alive = useRef(true);

  const dispatch = useCallback((a: Action) => {
    ref.current = reduce(ref.current, a);
    if (alive.current) setState(ref.current);
  }, []);

  const load = useCallback(async () => {
    dispatch({ type: 'load-start' });
    try {
      const b = await api.bootstrap();
      dispatch({ type: 'load-ok', data: normalize(b) });
    } catch (e) {
      dispatch({ type: 'load-err', error: messageOf(e).message });
    }
  }, [dispatch]);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
      clearPhotoCache();
    };
  }, [load]);

  /**
   * Run one optimistic write: apply → call → (rollback + toast) on failure.
   * Never runs before bootstrap has loaded (that would overwrite server data with blanks).
   */
  const run = useCallback(
    async (label: string, apply: () => void, call: () => Promise<unknown>, rollback: () => void): Promise<boolean> => {
      if (ref.current.status !== 'ready' || !ref.current.data) {
        toast.show('Still loading your journal — try again in a second.', { tone: 'error' });
        return false;
      }
      apply();
      setSave((s) => ({ ...s, pending: s.pending + 1 }));
      try {
        await call();
        setSave((s) => ({ pending: Math.max(0, s.pending - 1), failed: null, lastSavedAt: Date.now() }));
        return true;
      } catch (e) {
        rollback();
        const m = messageOf(e);
        const retry = () => void run(label, apply, call, rollback);
        setSave((s) => ({ ...s, pending: Math.max(0, s.pending - 1), failed: { ...m, retry } }));
        toast.show(m.offline ? `Offline — ${label} not saved.` : `${label} not saved: ${m.message}`, {
          tone: 'error',
          action: { label: 'Retry', run: retry },
        });
        return false;
      }
    },
    [toast],
  );

  const tradeById = (id: string) => ref.current.data?.trades.find((t) => t.id === id);

  const saveTrade = useCallback<StoreApi['saveTrade']>(
    (t) => {
      const prev = tradeById(t.id);
      return run(
        'Trade',
        () => dispatch({ type: 'upsert-trades', trades: [t] }),
        () => api.putTrade(t),
        () => dispatch(prev ? { type: 'upsert-trades', trades: [prev] } : { type: 'remove-trades', ids: [t.id] }),
      );
    },
    [run, dispatch],
  );

  const deleteTrades = useCallback<StoreApi['deleteTrades']>(
    async (ids) => {
      let allOk = true;
      for (const id of ids) {
        const prev = tradeById(id);
        if (!prev) continue;
        const ok = await run(
          'Delete',
          () => dispatch({ type: 'remove-trades', ids: [id] }),
          () => api.deleteTrade(id),
          () => dispatch({ type: 'upsert-trades', trades: [prev] }),
        );
        allOk = allOk && ok;
      }
      return allOk;
    },
    [run, dispatch],
  );

  const importTrades = useCallback<StoreApi['importTrades']>(
    async (trades, onProgress) => {
      let written = 0;
      for (let i = 0; i < trades.length; i += 500) {
        const chunk = trades.slice(i, i + 500);
        const prevs = chunk.map((t) => tradeById(t.id));
        const ok = await run(
          'Import',
          () => dispatch({ type: 'upsert-trades', trades: chunk }),
          () => api.batchTrades(chunk),
          () => {
            const restore = prevs.filter((p): p is Trade => !!p);
            const removeIds = chunk.filter((_, k) => !prevs[k]).map((t) => t.id);
            if (removeIds.length) dispatch({ type: 'remove-trades', ids: removeIds });
            if (restore.length) dispatch({ type: 'upsert-trades', trades: restore });
          },
        );
        if (!ok) return { written, ok: false };
        written += chunk.length;
        onProgress?.(written);
      }
      return { written, ok: true };
    },
    [run, dispatch],
  );

  const combineTrades = useCallback<StoreApi['combineTrades']>(
    (sourceIds, merged) => {
      const prevs = sourceIds.map(tradeById).filter((t): t is Trade => !!t);
      return run(
        'Combine',
        () => {
          dispatch({ type: 'remove-trades', ids: sourceIds });
          dispatch({ type: 'upsert-trades', trades: [merged] });
        },
        () => api.combineTrades(sourceIds, merged),
        () => {
          dispatch({ type: 'remove-trades', ids: [merged.id] });
          dispatch({ type: 'upsert-trades', trades: prevs });
        },
      );
    },
    [run, dispatch],
  );

  const saveDay = useCallback<StoreApi['saveDay']>(
    (d) => {
      const prev = ref.current.data?.days.find((x) => x.date === d.date);
      return run(
        'Day note',
        () => dispatch({ type: 'upsert-day', day: d }),
        () => api.putDay(d),
        () => dispatch(prev ? { type: 'upsert-day', day: prev } : { type: 'remove-day', date: d.date }),
      );
    },
    [run, dispatch],
  );

  const saveAccount = useCallback<StoreApi['saveAccount']>(
    (a) => {
      const prev = ref.current.data?.accounts.find((x) => x.id === a.id);
      return run(
        'Account',
        () => dispatch({ type: 'upsert-account', account: a }),
        () => api.putAccount(a),
        () => dispatch(prev ? { type: 'upsert-account', account: prev } : { type: 'remove-account', id: a.id }),
      );
    },
    [run, dispatch],
  );

  const deleteAccount = useCallback<StoreApi['deleteAccount']>(
    (id) => {
      const prev = ref.current.data?.accounts.find((x) => x.id === id);
      if (!prev) return Promise.resolve(true);
      return run(
        'Delete account',
        () => dispatch({ type: 'remove-account', id }),
        () => api.deleteAccount(id),
        () => dispatch({ type: 'upsert-account', account: prev }),
      );
    },
    [run, dispatch],
  );

  const saveSettings = useCallback<StoreApi['saveSettings']>(
    (s) => {
      const prev = ref.current.data?.settings;
      return run(
        'Settings',
        () => dispatch({ type: 'set-settings', settings: s }),
        () => api.putSettings(s),
        () => prev && dispatch({ type: 'set-settings', settings: prev }),
      );
    },
    [run, dispatch],
  );

  const uploadPhoto = useCallback<StoreApi['uploadPhoto']>(async (tradeId, file) => {
    const type0 = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type0)) {
      throw new ApiError(400, 'Screenshots must be JPEG, PNG or WebP.');
    }
    const blob = await downscale(file);
    const type = blob.type || type0;
    if (blob.size > 8 * 1024 * 1024) throw new ApiError(400, 'Screenshots must be 8 MB or smaller.');
    const { key, url } = await api.photoUploadUrl(tradeId, type, blob.size);
    await putToPresigned(url, blob, type);
    photoCache.set(key, { url: URL.createObjectURL(blob), exp: Date.now() + PHOTO_TTL_MS });
    return key;
  }, []);

  const photoUrls = useCallback<StoreApi['photoUrls']>(async (keys) => {
    const now = Date.now();
    const out: Record<string, string> = {};
    const missing: string[] = [];
    for (const k of keys) {
      const c = photoCache.get(k);
      if (c && c.exp > now) out[k] = c.url;
      else missing.push(k);
    }
    if (missing.length) {
      const { urls } = await api.photoViewUrls(missing);
      for (const [k, u] of Object.entries(urls)) {
        photoCache.set(k, { url: u, exp: now + PHOTO_TTL_MS });
        out[k] = u;
      }
    }
    return out;
  }, []);

  const value = useMemo<StoreApi>(
    () => ({
      status: state.status,
      error: state.error,
      data: state.data,
      save,
      reload: () => void load(),
      saveTrade,
      deleteTrades,
      importTrades,
      combineTrades,
      saveDay,
      saveAccount,
      deleteAccount,
      saveSettings,
      uploadPhoto,
      photoUrls,
    }),
    [state, save, load, saveTrade, deleteTrades, importTrades, combineTrades, saveDay, saveAccount, deleteAccount, saveSettings, uploadPhoto, photoUrls],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}

/** Data, asserted loaded. Use only inside screens rendered after status === 'ready'. */
export function useData(): Bootstrap {
  const { data } = useStore();
  if (!data) throw new Error('useData before bootstrap loaded');
  return data;
}

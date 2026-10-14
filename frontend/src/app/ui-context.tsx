import { createContext, useContext } from 'react';

/** Global sheets the shell owns, openable from any screen. */
export interface AppUi {
  /** Optional date (YYYY-MM-DD) to log into; ignores non-string args so it can be an onClick. */
  openQuickLog: (date?: unknown) => void;
  openTrade: (id: string) => void;
  openDay: (date: string) => void;
  openImport: () => void;
}

export const AppUiContext = createContext<AppUi | null>(null);

export function useAppUi(): AppUi {
  const v = useContext(AppUiContext);
  if (!v) throw new Error('useAppUi outside shell');
  return v;
}

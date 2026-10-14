import { useEffect, useRef, useState } from 'react';
import { loadConfig } from './lib/config';
import { hasSession, onAuthChange } from './lib/auth';
import { StoreProvider } from './lib/store';
import { ToastProvider } from './ui/Toast';
import { ErrorBoundary } from './ui/states';
import { Button, Spinner } from './ui/controls';
import { SignIn } from './screens/SignIn';
import { Shell } from './app/Shell';
import { ThemeContext, useThemePref } from './app/theme';

export function App() {
  const theme = useThemePref();
  const [config, setConfig] = useState<'loading' | 'ok' | { error: string }>('loading');
  const [signedIn, setSignedIn] = useState(false);
  // Bumped on every sign-in so the store (and all user state) is rebuilt from scratch.
  const [session, setSession] = useState(0);
  const signedInRef = useRef(false);

  useEffect(() => {
    loadConfig()
      .then(() => {
        signedInRef.current = hasSession();
        setSignedIn(signedInRef.current);
        setConfig('ok');
      })
      .catch((e: unknown) => setConfig({ error: e instanceof Error ? e.message : String(e) }));
    return onAuthChange((v) => {
      if (v && !signedInRef.current) setSession((s) => s + 1);
      signedInRef.current = v;
      setSignedIn(v);
    });
  }, []);

  let body;
  if (config === 'loading') {
    body = (
      <div className="grid min-h-dvh place-items-center text-ink-3" aria-busy="true">
        <Spinner size={20} />
      </div>
    );
  } else if (typeof config === 'object') {
    body = (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="card max-w-[380px] p-5" role="alert">
          <p className="caption">Can’t start</p>
          <p className="mt-2 font-medium">{config.error}</p>
          <p className="mt-1 text-body text-ink-3">Check your connection, then reload.</p>
          <Button className="mt-4" variant="primary" onClick={() => location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  } else if (!signedIn) {
    body = <SignIn />;
  } else {
    body = (
      <StoreProvider key={session}>
        <Shell />
      </StoreProvider>
    );
  }

  return (
    <ThemeContext.Provider value={theme}>
      <ToastProvider>
        <ErrorBoundary>{body}</ErrorBoundary>
      </ToastProvider>
    </ThemeContext.Provider>
  );
}

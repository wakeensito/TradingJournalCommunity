import { useRef, useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { AuthError, completeNewPassword, confirmForgotPassword, forgotPassword, signIn } from '../lib/auth';
import { Button, Field, TextInput } from '../ui/controls';
import { BrandMark } from '../ui/BrandMark';

type Mode =
  | { kind: 'signin' }
  | { kind: 'new-password'; session: string; username: string }
  | { kind: 'forgot' }
  | { kind: 'reset' };

const msg = (e: unknown) => (e instanceof AuthError || e instanceof Error ? e.message : 'Something went wrong.');

export function SignIn() {
  const [mode, setMode] = useState<Mode>({ kind: 'signin' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const go = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode.kind === 'signin') {
        const r = await signIn(email, password);
        if (r.kind === 'new-password') {
          go({ kind: 'new-password', session: r.session, username: r.username });
          setInfo('First sign-in: choose your own password.');
        }
      } else if (mode.kind === 'new-password') {
        await completeNewPassword(email, mode.username, mode.session, newPassword);
      } else if (mode.kind === 'forgot') {
        await forgotPassword(email);
        go({ kind: 'reset' });
        setInfo(`If ${email.trim()} has an account, a code is on its way.`);
      } else {
        await confirmForgotPassword(email, code, newPassword);
        setPassword('');
        setNewPassword('');
        setCode('');
        go({ kind: 'signin' });
        setInfo('Password updated. Sign in with the new one.');
      }
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }

  const heading =
    mode.kind === 'signin'
      ? 'Sign in'
      : mode.kind === 'new-password'
        ? 'Set your password'
        : mode.kind === 'forgot'
          ? 'Reset password'
          : 'Enter the code';

  const pwToggle = (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      aria-label={show ? 'Hide password' : 'Show password'}
      className="absolute top-0 right-0 grid h-11 w-11 place-items-center text-ink-3 hover:text-ink-1"
    >
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  return (
    <main
      className="grid min-h-dvh place-items-center px-4"
      style={{ paddingTop: 'calc(24px + var(--safe-top))', paddingBottom: 'calc(24px + var(--safe-bottom))' }}
    >
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark size={36} />
          <div>
            <p className="text-[15px] leading-5 font-semibold">Trading Journal</p>
            <p className="text-caption text-ink-3">Log it. See the truth. Close the day.</p>
          </div>
        </div>
        <form ref={formRef} onSubmit={submit} className="card flex flex-col gap-4 p-5" noValidate>
          <h1 className="text-title font-semibold">{heading}</h1>

          {info && (
            <p role="status" className="rounded-control border border-line bg-surface-2 px-3 py-2 text-body text-ink-2">
              {info}
            </p>
          )}

          {(mode.kind === 'signin' || mode.kind === 'forgot') && (
            <Field label="Email" htmlFor="si-email">
              <TextInput
                id="si-email"
                type="email"
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </Field>
          )}

          {mode.kind === 'signin' && (
            <Field
              label="Password"
              htmlFor="si-password"
              aside={
                <button
                  type="button"
                  className="-my-2 min-h-8 text-caption text-brand hover:underline"
                  onClick={() => go({ kind: 'forgot' })}
                >
                  Forgot password?
                </button>
              }
            >
              <div className="relative">
                <TextInput
                  id="si-password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-11"
                />
                {pwToggle}
              </div>
            </Field>
          )}

          {mode.kind === 'reset' && (
            <Field label="Code from email" htmlFor="si-code">
              <TextInput
                id="si-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                mono
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
            </Field>
          )}

          {(mode.kind === 'new-password' || mode.kind === 'reset') && (
            <Field
              label="New password"
              htmlFor="si-new"
              hint="8+ characters with upper, lower, a number and a symbol."
            >
              <div className="relative">
                <TextInput
                  id="si-new"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-11"
                  autoFocus={mode.kind === 'new-password'}
                />
                {pwToggle}
              </div>
            </Field>
          )}

          {error && (
            <p role="alert" className="rounded-control border border-[color-mix(in_oklab,var(--loss)_35%,transparent)] bg-loss-tint px-3 py-2 text-body text-ink-1">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            block
            loading={busy}
            disabled={
              (mode.kind === 'signin' && (!email.trim() || !password)) ||
              (mode.kind === 'forgot' && !email.trim()) ||
              (mode.kind === 'new-password' && newPassword.length < 8) ||
              (mode.kind === 'reset' && (!code.trim() || newPassword.length < 8))
            }
          >
            {mode.kind === 'signin'
              ? 'Sign in'
              : mode.kind === 'new-password'
                ? 'Save password'
                : mode.kind === 'forgot'
                  ? 'Send code'
                  : 'Update password'}
          </Button>

          {mode.kind !== 'signin' && (
            <button type="button" className="min-h-11 text-body text-ink-3 hover:text-ink-1" onClick={() => go({ kind: 'signin' })}>
              Back to sign in
            </button>
          )}
        </form>
        <p className="mt-4 text-center text-caption text-ink-3">Accounts are invite-only.</p>
      </div>
    </main>
  );
}

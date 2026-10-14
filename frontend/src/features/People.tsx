// Settings → "Your account" (password, sign out everywhere) and, for admins, "People" (invite and manage users).
// Every admin check here is cosmetic: the admin API re-checks the `admin` group on each request.

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Check, Copy, Eye, EyeOff, LogOut, Plus, ShieldCheck } from 'lucide-react';
import type { AdminUser } from '../lib/types';
import { api, ApiError } from '../lib/api';
import { AuthError, changePassword, globalSignOut, signOut } from '../lib/auth';
import { Button, Field, TextInput, cx } from '../ui/controls';
import { Sheet } from '../ui/Sheet';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ErrorState, Skeleton } from '../ui/states';
import { useToast } from '../ui/Toast';

const errMsg = (e: unknown) => (e instanceof ApiError || e instanceof AuthError || e instanceof Error ? e.message : 'Something went wrong.');
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
export const PASSWORD_HINT = '8+ characters with upper, lower and a number.';
const EMAIL_RULE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

// ---------- Your account ----------

export function YourAccount({ email, section }: { email: string | null; section: (title: string, children: ReactNode, aside?: ReactNode, hint?: string) => ReactNode }) {
  const toast = useToast();
  const [pwOpen, setPwOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busyAll, setBusyAll] = useState(false);

  return (
    <>
      {section(
        'Your account',
        <div className="card flex flex-col gap-3 p-4">
          <div className="min-w-0">
            <p className="caption">Signed in as</p>
            <p className="truncate text-ink-1" data-testid="account-email">
              {email ?? '—'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setPwOpen(true)}>Change password</Button>
            <Button onClick={() => setConfirmAll(true)}>Sign out of all devices</Button>
            <Button variant="danger" onClick={() => setConfirmOut(true)}>
              <LogOut size={16} /> Sign out
            </Button>
          </div>
        </div>,
      )}
      {pwOpen && <ChangePasswordSheet onClose={() => setPwOpen(false)} onDone={() => toast.show('Password changed.', { tone: 'success' })} />}
      <ConfirmDialog
        open={confirmOut}
        title="Sign out?"
        body="Your journal stays saved in your account. You’ll need your password to sign back in on this device."
        confirmLabel="Sign out"
        onCancel={() => setConfirmOut(false)}
        onConfirm={() => {
          setConfirmOut(false);
          void signOut();
        }}
      />
      <ConfirmDialog
        open={confirmAll}
        title="Sign out of all devices?"
        body="Every phone and computer signed in to your account — including this one — will need your password again. Use this if you lost a device or think someone else has access."
        confirmLabel="Sign out everywhere"
        danger
        busy={busyAll}
        onCancel={() => setConfirmAll(false)}
        onConfirm={async () => {
          setBusyAll(true);
          try {
            await globalSignOut();
          } catch (e) {
            setBusyAll(false);
            setConfirmAll(false);
            toast.show(errMsg(e), { tone: 'error' });
          }
        }}
      />
    </>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, autoFocus }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextInput
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-11"
        data-autofocus={autoFocus || undefined}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute top-0 right-0 grid h-11 w-11 place-items-center text-ink-3 hover:text-ink-1"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function ChangePasswordSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showErr, setShowErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = {
    current: !current ? 'Enter your current password.' : null,
    next: !PASSWORD_RULE.test(next) ? PASSWORD_HINT : next === current ? 'Pick a password you haven’t been using.' : null,
    confirm: confirm !== next ? 'The two new passwords don’t match.' : null,
  };

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setShowErr(true);
    setError(null);
    if (errors.current || errors.next || errors.confirm) return;
    setBusy(true);
    try {
      await changePassword(current, next);
      onClose();
      onDone();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Change password"
      testId="change-password"
      footer={
        <div className="flex gap-2">
          <Button onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void submit()} className="flex-1">
            Save password
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Current password" htmlFor="pw-current" error={showErr ? errors.current : null}>
          <PasswordInput id="pw-current" value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
        </Field>
        <Field label="New password" htmlFor="pw-new" error={showErr ? errors.next : null} hint={PASSWORD_HINT}>
          <PasswordInput id="pw-new" value={next} onChange={setNext} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-confirm" error={showErr ? errors.confirm : null}>
          <PasswordInput id="pw-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <p className="text-caption text-ink-3">Other devices stay signed in. Use “Sign out of all devices” to end those sessions too.</p>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-control border border-[color-mix(in_oklab,var(--loss)_35%,transparent)] bg-loss-tint px-3 py-2 text-body text-ink-1">
      {children}
    </p>
  );
}

// ---------- People (admins only) ----------

type StatusKind = 'active' | 'invited' | 'disabled' | 'reset';

export function userStatus(u: Pick<AdminUser, 'enabled' | 'status'>): { kind: StatusKind; label: string } {
  if (!u.enabled) return { kind: 'disabled', label: 'Disabled' };
  if (u.status === 'FORCE_CHANGE_PASSWORD') return { kind: 'invited', label: 'Invited' };
  if (u.status === 'RESET_REQUIRED') return { kind: 'reset', label: 'Reset needed' };
  return { kind: 'active', label: 'Active' };
}

function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warn' | 'muted' }) {
  return (
    <span
      className={cx(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-control border px-2 text-caption whitespace-nowrap',
        tone === 'warn' ? 'border-[color-mix(in_oklab,var(--warn)_45%,transparent)] bg-warn-tint text-warn' : tone === 'muted' ? 'border-line bg-inset text-ink-3' : 'border-line-strong bg-surface-2 text-ink-2',
      )}
    >
      {children}
    </span>
  );
}

function StatusPill({ u }: { u: AdminUser }) {
  const s = userStatus(u);
  return <Pill tone={s.kind === 'disabled' ? 'muted' : s.kind === 'reset' ? 'warn' : 'neutral'}>{s.label}</Pill>;
}

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; users: AdminUser[] };

export function People({ section, onForbidden }: { section: (title: string, children: ReactNode, aside?: ReactNode, hint?: string) => ReactNode; onForbidden: () => void }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [inviting, setInviting] = useState(false);
  const [openUser, setOpenUser] = useState<string | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const users = await api.admin.listUsers();
      if (alive.current) setLoad({ kind: 'ready', users });
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof ApiError && e.status === 403) onForbidden();
      else setLoad({ kind: 'error', message: errMsg(e) });
    }
  }, [onForbidden]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);

  const upsert = (u: AdminUser) =>
    setLoad((l) => (l.kind === 'ready' ? { kind: 'ready', users: l.users.some((x) => x.username === u.username) ? l.users.map((x) => (x.username === u.username ? u : x)) : [...l.users, u].sort((a, b) => a.email.localeCompare(b.email)) } : l));
  const drop = (username: string) => setLoad((l) => (l.kind === 'ready' ? { kind: 'ready', users: l.users.filter((x) => x.username !== username) } : l));

  const users = load.kind === 'ready' ? load.users : [];
  const selected = users.find((u) => u.username === openUser) ?? null;
  const others = users.filter((u) => !u.isSelf).length;

  return (
    <>
      {section(
        'People',
        load.kind === 'loading' ? (
          <div className="card divide-y divide-line-soft" aria-busy="true" aria-label="Loading people">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        ) : load.kind === 'error' ? (
          <ErrorState
            message={load.message}
            onRetry={() => {
              setLoad({ kind: 'loading' });
              void refresh();
            }}
          />
        ) : (
          <div className="card">
            <ul className="divide-y divide-line-soft" data-testid="people-list">
              {users.map((u) => (
                <li key={u.username}>
                  <button
                    type="button"
                    onClick={() => setOpenUser(u.username)}
                    className={cx('flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-surface-2', !u.enabled && 'opacity-60')}
                    aria-label={`${u.email}${u.isSelf ? ' (you)' : ''}, ${userStatus(u).label}${u.isAdmin ? ', admin' : ''}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ink-1">{u.email || u.username}</span>
                      {u.isSelf && <span className="block text-caption text-ink-3">You</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {u.isAdmin && (
                        <Pill>
                          <ShieldCheck size={12} aria-hidden /> Admin
                        </Pill>
                      )}
                      <StatusPill u={u} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {others === 0 && (
              <p className="border-t border-line px-4 py-4 text-body text-ink-3">
                It’s just you so far. Invite someone and they’ll get an email with a temporary password.
              </p>
            )}
          </div>
        ),
        <Button size="sm" onClick={() => setInviting(true)} disabled={load.kind !== 'ready'}>
          <Plus size={16} /> Invite
        </Button>,
        'Invite people, reset passwords and remove access. Only admins see this.',
      )}
      {inviting && <InviteSheet onClose={() => setInviting(false)} onInvited={upsert} />}
      {selected && <UserSheet user={selected} onClose={() => setOpenUser(null)} onChanged={upsert} onRemoved={drop} />}
    </>
  );
}

/** A temporary password, shown once, with a copy button. */
function OneTimePassword({ password, note }: { password: string; note: ReactNode }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.show('Copied.', { tone: 'success' });
    } catch {
      toast.show('Couldn’t copy. Select the password and copy it by hand.', { tone: 'error' });
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line-strong bg-surface-2 p-4" data-testid="temp-password">
      <p className="caption">Temporary password · shown once</p>
      <div className="flex items-center gap-2">
        <code className="num min-w-0 flex-1 truncate rounded-control bg-inset px-3 py-2.5 text-[17px] text-ink-1 select-all" data-testid="temp-password-value">
          {password}
        </code>
        <Button onClick={() => void copy()} aria-label="Copy temporary password">
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="text-body text-ink-3">{note}</p>
    </div>
  );
}

function InviteSheet({ onClose, onInvited }: { onClose: () => void; onInvited: (u: AdminUser) => void }) {
  const [email, setEmail] = useState('');
  const [admin, setAdmin] = useState(false);
  const [showErr, setShowErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ user: AdminUser; temporaryPassword: string } | null>(null);
  const emailErr = !EMAIL_RULE.test(email.trim()) ? 'Enter a valid email address.' : null;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setShowErr(true);
    setError(null);
    if (emailErr) return;
    setBusy(true);
    try {
      const r = await api.admin.invite(email.trim().toLowerCase(), admin);
      onInvited(r.user);
      setDone(r);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={done ? 'Invite sent' : 'Invite someone'}
      testId="invite-sheet"
      footer={
        done ? (
          <Button variant="primary" block onClick={onClose}>
            Done
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void submit()} className="flex-1">
              Send invite
            </Button>
          </div>
        )
      }
    >
      {done ? (
        <div className="flex flex-col gap-4">
          <p className="text-body text-ink-2">
            <span className="text-ink-1">{done.user.email}</span> can sign in now{done.user.isAdmin ? ' as an admin' : ''}.
          </p>
          <OneTimePassword
            password={done.temporaryPassword}
            note="An invite email was sent with this password and the app link. You can also share it directly. They’ll choose their own password on first sign-in; this one expires in 7 days."
          />
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Email" htmlFor="inv-email" error={showErr ? emailErr : null}>
            <TextInput
              id="inv-email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              value={email}
              maxLength={254}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              data-autofocus
            />
          </Field>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" />
            <span>
              Make admin
              <span className="block text-caption text-ink-3">Admins can invite and remove people.</span>
            </span>
          </label>
          {error && <ErrorNote>{error}</ErrorNote>}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      )}
    </Sheet>
  );
}

type Confirm = 'reset' | 'disable' | 'remove' | 'demote' | null;

function UserSheet({ user, onClose, onChanged, onRemoved }: { user: AdminUser; onClose: () => void; onChanged: (u: AdminUser) => void; onRemoved: (username: string) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [purge, setPurge] = useState(true);
  const [reveal, setReveal] = useState<{ password: string; note: string } | null>(null);
  const status = userStatus(user);
  const invited = status.kind === 'invited';

  async function run<T>(key: string, fn: () => Promise<T>, after: (r: T) => void) {
    setBusy(key);
    try {
      after(await fn());
    } catch (e) {
      toast.show(errMsg(e), { tone: 'error' });
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  const reset = () =>
    run('reset', () => api.admin.resetPassword(user.username), (r) => {
      onChanged(r.user);
      setReveal({ password: r.temporaryPassword, note: 'They’ve been signed out everywhere. Share this password with them; they’ll choose a new one when they sign in. It expires in 7 days.' });
    });
  const resend = () =>
    run('resend', () => api.admin.resendInvite(user.username), (r) => {
      onChanged(r.user);
      setReveal({ password: r.temporaryPassword, note: 'A new invite email was sent with this password. The old one no longer works.' });
    });
  const setAdmin = (admin: boolean) =>
    run('admin', () => api.admin.setAdmin(user.username, admin), (r) => {
      onChanged(r.user);
      toast.show(admin ? `${user.email} is now an admin.` : `${user.email} is no longer an admin.`, { tone: 'success' });
    });
  const toggleEnabled = (enable: boolean) =>
    run(enable ? 'enable' : 'disable', () => (enable ? api.admin.enable(user.username) : api.admin.disable(user.username)), (r) => {
      onChanged(r.user);
      toast.show(enable ? `${user.email} can sign in again.` : `${user.email} is disabled and signed out.`, { tone: 'success' });
    });
  const remove = () =>
    run('remove', () => api.admin.remove(user.username, purge), (r) => {
      onClose();
      onRemoved(user.username);
      toast.show(
        purge ? `${user.email} removed, with ${r.purged.items} journal item${r.purged.items === 1 ? '' : 's'} and ${r.purged.photos} screenshot${r.purged.photos === 1 ? '' : 's'}.` : `${user.email} removed. Their journal data was kept.`,
        { tone: 'success' },
      );
    });

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={user.email || user.username}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5 pt-1">
            <StatusPill u={user} />
            {user.isAdmin && (
              <Pill>
                <ShieldCheck size={12} aria-hidden /> Admin
              </Pill>
            )}
            {user.createdAt && <span className="text-caption text-ink-3">Added {new Date(user.createdAt).toLocaleDateString()}</span>}
          </span>
        }
        testId="user-sheet"
      >
        <div className="flex flex-col gap-4">
          {reveal && <OneTimePassword password={reveal.password} note={reveal.note} />}
          {user.isSelf ? (
            <p className="rounded-control border border-line bg-surface-2 px-3 py-3 text-body text-ink-2">
              This is you. Change your password or sign out under <span className="text-ink-1">Your account</span>. Another admin can change your access.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <ActionRow label="Reset password" hint="Signs them out and gives you a new temporary password to share." onClick={() => setConfirm('reset')} busy={busy === 'reset'} disabled={!!busy || !user.enabled} />
              {invited && <ActionRow label="Resend invite" hint="Emails a fresh temporary password." onClick={() => void resend()} busy={busy === 'resend'} disabled={!!busy || !user.enabled} />}
              {user.isAdmin ? (
                <ActionRow label="Remove admin" hint="They keep their journal but can’t manage people." onClick={() => setConfirm('demote')} busy={busy === 'admin'} disabled={!!busy} />
              ) : (
                <ActionRow label="Make admin" hint="They can invite, disable and remove people." onClick={() => void setAdmin(true)} busy={busy === 'admin'} disabled={!!busy || !user.enabled} />
              )}
              {user.enabled ? (
                <ActionRow label="Disable" hint="Blocks sign-in and signs them out. Their journal is kept." onClick={() => setConfirm('disable')} busy={busy === 'disable'} disabled={!!busy} />
              ) : (
                <ActionRow label="Enable" hint="Lets them sign in again." onClick={() => void toggleEnabled(true)} busy={busy === 'enable'} disabled={!!busy} />
              )}
              <ActionRow label="Remove user" hint="Deletes their account. Optionally deletes their trades and screenshots." onClick={() => setConfirm('remove')} busy={busy === 'remove'} disabled={!!busy} danger />
            </div>
          )}
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirm === 'reset'}
        title="Reset their password?"
        body="Their current password stops working and they’re signed out everywhere. You’ll get a temporary password to share."
        confirmLabel="Reset password"
        busy={busy === 'reset'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void reset()}
      />
      <ConfirmDialog
        open={confirm === 'demote'}
        title="Remove admin access?"
        body={`${user.email} will no longer see People. They keep their journal.`}
        confirmLabel="Remove admin"
        danger
        busy={busy === 'admin'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void setAdmin(false)}
      />
      <ConfirmDialog
        open={confirm === 'disable'}
        title={`Disable ${user.email}?`}
        body="They’re signed out and can’t sign in until you enable them again. Nothing is deleted."
        confirmLabel="Disable"
        danger
        busy={busy === 'disable'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void toggleEnabled(false)}
      />
      <ConfirmDialog
        open={confirm === 'remove'}
        title={`Remove ${user.email}?`}
        body={
          <div className="flex flex-col gap-3">
            <p>Their account is deleted and they can’t sign in. This can’t be undone.</p>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-ink-1">
              <input type="checkbox" checked={purge} onChange={(e) => setPurge(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--loss)]" data-testid="purge-checkbox" />
              <span>Also delete their trades and screenshots</span>
            </label>
          </div>
        }
        confirmLabel="Remove"
        danger
        busy={busy === 'remove'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void remove()}
      />
    </>
  );
}

function ActionRow({ label, hint, onClick, busy, disabled, danger }: { label: string; hint: string; onClick: () => void; busy?: boolean; disabled?: boolean; danger?: boolean }) {
  return (
    <div className="flex min-h-14 items-center gap-3 rounded-control border border-line px-3 py-2">
      <p className="min-w-0 flex-1 text-caption text-ink-3 normal-case">{hint}</p>
      <Button size="sm" variant={danger ? 'danger' : 'secondary'} loading={busy} disabled={disabled} onClick={onClick} className="min-w-[124px]">
        {label}
      </Button>
    </div>
  );
}

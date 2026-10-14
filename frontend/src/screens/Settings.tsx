import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Plus, Star, X } from 'lucide-react';
import type { Account, AccountStatus, AccountType, Settings } from '../lib/types';
import { useData, useStore } from '../lib/store';
import { currentEmail, isAdmin, loadIsAdmin } from '../lib/auth';
import { People, YourAccount } from '../features/People';
import { newId } from '../lib/ids';
import { formatMoney } from '../lib/format';
import { todayLocal } from '../lib/dates';
import { PageHeader } from '../app/Shell';
import { useTheme, type ThemePref } from '../app/theme';
import { accountProgress, accountTypeLabel } from '../app/domain';
import { Button, Chip, DecimalInput, Field, IconButton, SegmentedControl, TextInput, cx, parseDecimal } from '../ui/controls';
import { Money } from '../ui/Money';
import { Sheet } from '../ui/Sheet';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';
import pkg from '../../package.json';

export function SettingsScreen() {
  const { settings, accounts, trades } = useData();
  const [editing, setEditing] = useState<Account | 'new' | null>(null);
  const [theme, setTheme] = useTheme();
  const email = currentEmail();
  const [admin, setAdmin] = useState(isAdmin);
  useEffect(() => {
    let live = true;
    void loadIsAdmin().then((v) => live && setAdmin(v));
    return () => {
      live = false;
    };
  }, []);
  const hideAdmin = useCallback(() => setAdmin(false), []);
  const section = (title: string, children: ReactNode, aside?: ReactNode, hint?: string) => (
    <Section title={title} aside={aside} hint={hint}>
      {children}
    </Section>
  );

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader title="Settings" noSettingsLink />
      <div className="flex flex-col gap-6">
        <Section title="Accounts" aside={<Button size="sm" onClick={() => setEditing('new')}><Plus size={16} /> Add</Button>}>
          {accounts.length === 0 ? (
            <div className="card px-4 py-5 text-body text-ink-3">
              No accounts yet. Optional — add one to track a prop eval’s target and drawdown, or to split personal vs. funded.
            </div>
          ) : (
            <ul className="card divide-y divide-line-soft">
              {accounts.map((a) => (
                <li key={a.id}>
                  <AccountRow a={a} trades={trades} isDefault={settings.defaultAccountId === a.id} onOpen={() => setEditing(a)} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <FeesSection settings={settings} />
        <BandSection settings={settings} />

        <Section title="Setups" hint="One tap when logging. Breakdowns group by these.">
          <ChipListEditor field="setups" settings={settings} placeholder="Add a setup" />
        </Section>
        <Section title="Mistakes" hint="Tag them honestly — Insights shows what each one costs.">
          <ChipListEditor field="mistakes" settings={settings} placeholder="Add a mistake" tone="warn" />
        </Section>

        <Section title="Appearance">
          <div className="card p-4">
            <SegmentedControl<ThemePref>
              label="Theme"
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
                { value: 'system', label: 'System' },
              ]}
            />
          </div>
        </Section>

        <YourAccount email={email} section={section} />
        {admin && <People section={section} onForbidden={hideAdmin} />}

        <p className="num pb-2 text-center text-caption text-ink-3">Trading Journal v{pkg.version}</p>
      </div>

      {editing && <AccountSheet account={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Section({ title, hint, aside, children }: { title: string; hint?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <div className={cx('mb-2 flex min-h-9 justify-between gap-3', hint ? 'items-end' : 'items-center')}>
        <div className="min-w-0">
          <h2 className="text-[15px] leading-6 font-semibold">{title}</h2>
          {hint && <p className="text-body text-ink-3">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

// ---------- accounts ----------

function Meter({ label, pct, tone, right }: { label: string; pct: number; tone: 'gain' | 'loss' | 'warn' | 'brand'; right: ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-caption">
        <span className="text-ink-3">{label}</span>
        <span className="num text-ink-2">{right}</span>
      </div>
      <div className="h-1.5 rounded-full bg-inset" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
        <div className="h-full rounded-full transition-[width] duration-[180ms]" style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct * 100)}%`, background: `var(--${tone})` }} />
      </div>
    </div>
  );
}

function AccountRow({ a, trades, isDefault, onOpen }: { a: Account; trades: ReturnType<typeof useData>['trades']; isDefault: boolean; onOpen: () => void }) {
  const p = useMemo(() => accountProgress(a, trades, todayLocal()), [a, trades]);
  const { saveAccount } = useStore();
  const ddTone = p.drawdown ? (p.drawdown.pct >= 0.75 ? 'loss' : p.drawdown.pct >= 0.5 ? 'warn' : 'brand') : 'brand';
  return (
    <div className={cx('flex flex-col gap-3 p-4', a.status === 'archived' && 'opacity-60')}>
      <button type="button" onClick={onOpen} className="-m-2 flex min-h-11 items-start justify-between gap-3 rounded-control p-2 text-left hover:bg-surface-2">
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{a.name}</span>
            {isDefault && <Star size={12} className="shrink-0 fill-current text-ink-3" aria-label="Default account" />}
          </span>
          <span className="text-caption text-ink-3">
            {accountTypeLabel(a.type)} · {a.status === 'active' ? `${p.daysTraded} day${p.daysTraded === 1 ? '' : 's'} traded` : a.status}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="num text-ink-1">{formatMoney(p.balance)}</span>
          <Money value={p.net} className="text-caption" />
        </span>
      </button>
      {(p.target || p.drawdown) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {p.target && (
            <Meter label="Profit target" pct={p.target.pct} tone="gain" right={`${formatMoney(Math.max(0, p.net))} / ${formatMoney(p.target.value)}`} />
          )}
          {p.drawdown && (
            <Meter
              label={`Drawdown (${a.drawdownType ?? 'trailing'})`}
              pct={p.drawdown.pct}
              tone={ddTone}
              right={`${formatMoney(p.drawdown.used)} / ${formatMoney(p.drawdown.limit)}`}
            />
          )}
        </div>
      )}
      {p.suggestion && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line bg-surface-2 px-3 py-2">
          <span className="text-body">{p.suggestion === 'passed' ? 'Profit target reached.' : 'Max drawdown breached.'}</span>
          <Button size="sm" onClick={() => void saveAccount({ ...a, status: p.suggestion! })}>
            Mark {p.suggestion}
          </Button>
        </div>
      )}
    </div>
  );
}

function AccountSheet({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const { settings } = useData();
  const { saveAccount, deleteAccount, saveSettings } = useStore();
  const toast = useToast();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'personal');
  const [status, setStatus] = useState<AccountStatus>(account?.status ?? 'active');
  const [start, setStart] = useState(account ? String(account.startBalance) : '');
  const [target, setTarget] = useState(account?.profitTarget !== undefined ? String(account.profitTarget) : '');
  const [dd, setDd] = useState(account?.maxDrawdown !== undefined ? String(account.maxDrawdown) : '');
  const [ddType, setDdType] = useState<'trailing' | 'static'>(account?.drawdownType ?? 'trailing');
  const [daily, setDaily] = useState(account?.dailyLossLimit !== undefined ? String(account.dailyLossLimit) : '');
  const [isDefault, setIsDefault] = useState(account ? settings.defaultAccountId === account.id : false);
  const [showErr, setShowErr] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const prop = type !== 'personal';
  const startN = parseDecimal(start);
  const errors = {
    name: !name.trim() ? 'Name it, e.g. “Apex 50K #2”.' : null,
    start: startN === null || startN < 0 ? 'Starting balance is required.' : null,
  };

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setShowErr(true);
    if (errors.name || errors.start) return;
    const a: Account = {
      id: account?.id ?? newId(),
      name: name.trim(),
      type,
      status,
      startBalance: startN ?? 0,
      createdAt: account?.createdAt ?? new Date().toISOString(),
    };
    const pos = (s: string) => {
      const n = parseDecimal(s);
      return n !== null && n > 0 ? n : undefined;
    };
    if (prop) {
      if (type === 'prop-eval' && pos(target)) a.profitTarget = pos(target);
      if (pos(dd)) {
        a.maxDrawdown = pos(dd);
        a.drawdownType = ddType;
      }
      if (pos(daily)) a.dailyLossLimit = pos(daily);
    }
    onClose();
    const ok = await saveAccount(a);
    if (ok) toast.show(account ? 'Account saved.' : 'Account added.', { tone: 'success' });
    const wantDefault = isDefault ? a.id : settings.defaultAccountId === a.id ? null : settings.defaultAccountId;
    if (ok && wantDefault !== settings.defaultAccountId) void saveSettings({ ...settings, defaultAccountId: wantDefault });
  }

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={account ? 'Edit account' : 'Add account'}
        footer={
          <div className="flex gap-2">
            {account && (
              <Button variant="danger" onClick={() => setConfirmDel(true)}>
                Delete
              </Button>
            )}
            <Button onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void submit()} className="flex-1">
              Save
            </Button>
          </div>
        }
      >
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Name" htmlFor="ac-name" error={showErr ? errors.name : null}>
            <TextInput id="ac-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="Apex 50K #2" data-autofocus />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="caption">Type</span>
            <SegmentedControl
              label="Account type"
              value={type}
              onChange={setType}
              options={[
                { value: 'personal', label: 'Personal' },
                { value: 'prop-eval', label: 'Prop eval' },
                { value: 'prop-funded', label: 'Funded' },
              ]}
            />
          </div>
          <Field label="Starting balance" htmlFor="ac-start" error={showErr ? errors.start : null}>
            <DecimalInput id="ac-start" value={start} onChange={setStart} placeholder="50000" />
          </Field>
          {prop && (
            <div className="flex flex-col gap-4 rounded-card border border-line p-4">
              <p className="caption">Prop rules</p>
              {type === 'prop-eval' && (
                <Field label="Profit target ($ above start)" htmlFor="ac-target">
                  <DecimalInput id="ac-target" value={target} onChange={setTarget} placeholder="3000" />
                </Field>
              )}
              <Field label="Max drawdown ($)" htmlFor="ac-dd">
                <DecimalInput id="ac-dd" value={dd} onChange={setDd} placeholder="2500" />
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="caption">Drawdown type</span>
                <SegmentedControl
                  label="Drawdown type"
                  value={ddType}
                  onChange={setDdType}
                  options={[
                    { value: 'trailing', label: 'Trailing' },
                    { value: 'static', label: 'Static' },
                  ]}
                />
              </div>
              <Field label="Daily loss limit ($)" htmlFor="ac-daily" hint="Optional. Today warns you as you approach it.">
                <DecimalInput id="ac-daily" value={daily} onChange={setDaily} placeholder="1000" />
              </Field>
            </div>
          )}
          {account && (
            <div className="flex flex-col gap-1.5">
              <span className="caption">Status</span>
              <SegmentedControl
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'passed', label: 'Passed' },
                  { value: 'failed', label: 'Failed' },
                  { value: 'archived', label: 'Archived' },
                ]}
              />
            </div>
          )}
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" />
            <span>Default account for new trades</span>
          </label>
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </Sheet>
      <ConfirmDialog
        open={confirmDel}
        title={`Delete ${account?.name ?? 'account'}?`}
        body="Its trades stay in your journal and show as Unassigned."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDel(false)}
        onConfirm={() => {
          setConfirmDel(false);
          onClose();
          if (!account) return;
          void deleteAccount(account.id).then((ok) => {
            if (ok && settings.defaultAccountId === account.id) void saveSettings({ ...settings, defaultAccountId: null });
          });
        }}
      />
    </>
  );
}

// ---------- fees ----------

const FIXED_KEYS = ['default', 'option', 'stock'];
const KEY_LABEL: Record<string, string> = { default: 'Other futures', option: 'Options', stock: 'Stocks · per share' };

function FeesSection({ settings }: { settings: Settings }) {
  const { saveSettings } = useStore();
  const toast = useToast();
  const initial = useMemo(() => {
    const e = Object.entries(settings.feesPerContract).map(([k, v]) => [k, String(v)] as [string, string]);
    for (const k of FIXED_KEYS) if (!e.some(([x]) => x === k)) e.push([k, '0']);
    return e;
  }, [settings.feesPerContract]);
  const [rows, setRows] = useState<[string, string][]>(initial);
  const [newRoot, setNewRoot] = useState('');
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);
  const roots = rows.filter(([k]) => !FIXED_KEYS.includes(k));
  const fixed = FIXED_KEYS.map((k) => rows.find(([x]) => x === k)!).filter(Boolean);

  const setVal = (k: string, v: string) => setRows((rs) => rs.map(([x, y]) => (x === k ? [x, v] : [x, y])));
  const add = () => {
    const r = newRoot.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!r || rows.some(([k]) => k.toUpperCase() === r)) return;
    setRows((rs) => [...rs, [r, '']]);
    setNewRoot('');
  };
  const save = async () => {
    const fees: Record<string, number> = {};
    for (const [k, v] of rows) {
      const n = parseDecimal(v);
      if (n !== null && n >= 0) fees[k] = n;
    }
    if (fees.default === undefined) fees.default = 0;
    const ok = await saveSettings({ ...settings, feesPerContract: fees });
    if (ok) toast.show('Fees saved.', { tone: 'success' });
  };

  const row = (k: string, label: ReactNode, removable: boolean) => (
    <li key={k} className="grid grid-cols-[minmax(0,1fr)_120px_44px] items-center gap-2 px-4 py-2">
      <label htmlFor={`fee-${k}`} className="min-w-0 truncate">
        {label}
      </label>
      <div className="relative">
        <span className="num pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3">$</span>
        <DecimalInput id={`fee-${k}`} value={rows.find(([x]) => x === k)?.[1] ?? ''} onChange={(v) => setVal(k, v)} className="pl-6 text-right" data-testid={`fee-${k}`} />
      </div>
      {removable ? (
        <IconButton label={`Remove ${k}`} onClick={() => setRows((rs) => rs.filter(([x]) => x !== k))}>
          <X size={16} />
        </IconButton>
      ) : (
        <span />
      )}
    </li>
  );

  return (
    <Section title="Fees per contract" hint="Round trip (both sides) per contract. Applied automatically when you log or import.">
      <div className="card">
        <ul className="divide-y divide-line-soft">
          {roots.map(([k]) => row(k, <span className="num font-medium">{k}</span>, true))}
          {fixed.map(([k]) => row(k, <span className="text-ink-2">{KEY_LABEL[k]}</span>, false))}
        </ul>
        <div className="flex flex-wrap items-center gap-2 border-t border-line p-4">
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <label htmlFor="fee-new" className="sr-only">
              Contract root
            </label>
            <TextInput id="fee-new" mono value={newRoot} onChange={(e) => setNewRoot(e.target.value.toUpperCase())} placeholder="Add root" className="min-w-0 flex-1" maxLength={6} />
            <Button type="submit" disabled={!newRoot.trim()}>
              Add
            </Button>
          </form>
          <Button variant="primary" disabled={!dirty} onClick={() => void save()} data-testid="fees-save">
            Save fees
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ---------- breakeven band ----------

function BandSection({ settings }: { settings: Settings }) {
  const { saveSettings } = useStore();
  const toast = useToast();
  const [v, setV] = useState(String(settings.breakevenBand));
  const n = parseDecimal(v);
  const dirty = n !== null && n >= 0 && n !== settings.breakevenBand;
  return (
    <Section title="Breakeven band" hint="Trades whose net is within ± this amount count as breakeven, not a win or a loss.">
      <form
        className="card flex items-center gap-2 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!dirty || n === null) return;
          if (await saveSettings({ ...settings, breakevenBand: n })) toast.show('Breakeven band saved.', { tone: 'success' });
        }}
      >
        <label htmlFor="be-band" className="sr-only">
          Breakeven band in dollars
        </label>
        <div className="relative w-[140px]">
          <span className="num pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3">±$</span>
          <DecimalInput id="be-band" value={v} onChange={setV} className="pl-9 text-right" />
        </div>
        <Button type="submit" variant="primary" disabled={!dirty}>
          Save
        </Button>
      </form>
    </Section>
  );
}

// ---------- chip list editor ----------

function ChipListEditor({ field, settings, placeholder, tone }: { field: 'setups' | 'mistakes'; settings: Settings; placeholder: string; tone?: 'warn' }) {
  const { saveSettings } = useStore();
  const [text, setText] = useState('');
  const list = settings[field];
  const add = () => {
    const t = text.trim();
    if (!t || list.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setText('');
      return;
    }
    void saveSettings({ ...settings, [field]: [...list, t.slice(0, 60)] });
    setText('');
  };
  return (
    <div className="card p-4">
      {list.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {list.map((x) => (
            <Chip key={x} onRemove={() => void saveSettings({ ...settings, [field]: list.filter((y) => y !== x) })} className={tone === 'warn' ? 'text-ink-1' : undefined}>
              {x}
            </Chip>
          ))}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label htmlFor={`add-${field}`} className="sr-only">
          {placeholder}
        </label>
        <TextInput id={`add-${field}`} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={60} className="min-w-0 flex-1" />
        <Button type="submit" disabled={!text.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}

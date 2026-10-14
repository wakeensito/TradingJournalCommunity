# Design System — Trading Journal v2

> **Direction: "The close."** A calm trading terminal at 4:00 pm. You just stepped away from the chart and want the
> truth in one glance, then you're done.
> Kept from v1: the colour scheme (navy `#0a0e1a`, the blue→cyan→teal brand, green/red P&L).
> Replaced: glassmorphism, blur, scale-on-press, and icon-left metric cards.

## Intent
- **Who:** a discretionary day trader, phone in hand right after a trade or laptop at the bell. They're tired, and maybe tilted after a loss.
- **Verb:** log it, see the truth, close the day.
- **Feel:** quiet, precise, dense where numbers live, generous where fingers tap. It never nags and never celebrates loudly.

## Domain → choices
- **Domain:** session, tape, fills, the bell (open and close), ledger, ladder, R, drawdown, the close.
- **Colour world:** terminal navy, quote-board cyan, tape green, offer red, amber rule-break warnings, and cool paper-white text.
- **Signature, the Session Tape:** one tick per trade in time order, rising from a midline in green or falling in red, with height
  proportional to |net|. It appears in:
  1. The Today header (large).
  2. Calendar cells (micro).
  3. Trade-list day headers.
  4. The day sheet.
  5. Quick-log success, where a new tick animates in.

  Component: `<SessionTape trades size="lg|sm|xs" />`.
- **Rejected defaults:**
  - Glass cards with blur → solid layered navy surfaces with hairline borders.
  - Icon-left KPI cards → a **ticker strip** of mono numbers with small caps labels.
  - A sidebar of icons → a slim left rail (≥ 768px) and a bottom tab bar (< 768px) with a raised centre **+ Log** button.

## Tokens (`frontend/src/styles/tokens.css`)
Dark is the default; light is also supported (`[data-theme="light"]`). Every token has both values.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#0a0e1a` | `#f0f4f8` | canvas, rail and tab bar (same surface + hairline) |
| `--surface-1` | `#0f1424` | `#ffffff` | cards and sheets |
| `--surface-2` | `#151b2e` | `#f7f9fc` | raised: dropdowns, popovers, hovered rows |
| `--inset` | `#080b15` | `#e9eef5` | inputs (darker = "type here") |
| `--ink-1` | `#e8edf6` | `#0d1324` | primary text |
| `--ink-2` | `#a3adc2` | `#4a5568` | secondary |
| `--ink-3` | `#6b7590` | `#7a8599` | labels and metadata |
| `--ink-4` | `#454e66` | `#aab3c2` | placeholder and disabled |
| `--line` | `rgba(148,163,194,.10)` | `rgba(13,19,36,.08)` | standard hairline |
| `--line-soft` | `rgba(148,163,194,.06)` | `rgba(13,19,36,.05)` | row separators |
| `--line-strong` | `rgba(148,163,194,.18)` | `rgba(13,19,36,.14)` | emphasis and control borders |
| `--brand` | `#3b82f6` | `#2563eb` | primary action, focus ring base |
| `--brand-grad` | `linear-gradient(135deg,#3b82f6,#06b6d4 55%,#14b8a6)` | same | **only** the + Log button and the logo mark |
| `--gain` | `#22c55e` | `#16a34a` | profit, wins |
| `--loss` | `#ef4444` | `#dc2626` | loss |
| `--flat` | `#94a3b8` | `#64748b` | breakeven |
| `--warn` | `#f59e0b` | `#d97706` | rule breaks, drawdown near limit |
| `--focus` | `0 0 0 2px var(--bg), 0 0 0 4px #3b82f6` | | focus ring |

Gain and loss tints for backgrounds use `color-mix(in oklab, var(--gain) 12%, transparent)`.

## Depth
**Borders plus surface shifts only, with no shadows** except a single soft shadow on bottom sheets and modals (`0 -8px 32px rgba(0,0,0,.35)`). There is no backdrop blur.

## Typography
- UI: **IBM Plex Sans** (400/500/600). Its terminal heritage reads as precise and human, unlike Inter.
- Numbers: **IBM Plex Mono** (500), always `tabular-nums`. Every price, P&L figure, % and count is mono.
- Scale: 12 caption (caps, +0.06em, `--ink-3`) · 14 body · 16 input (prevents iOS zoom) · 20 title (600, −0.01em) · 32/44 hero P&L (mono 500, −0.02em).

## Spacing & radius
- Base unit 4px. Scale 4 / 8 / 12 / 16 / 24 / 32.
- Card padding is 16 (mobile) or 20 (desktop). The gap between cards is 12/16.
- Radius: 6 for controls and chips, 10 for cards, 16 for sheet tops, and pill for the segmented control and + Log.
- Touch targets are ≥ 44px; mobile controls are ≥ 44px tall.

## Motion
120–180ms, `cubic-bezier(.2,.8,.2,1)` (deceleration). There's no scale-on-press and no bounce. Sheets slide in 220ms.
Respect `prefers-reduced-motion`.

## Components
- **Ticker strip:** a horizontal row of `label (caption caps) / value (mono)` pairs with hairline separators. It scrolls horizontally on mobile with no wrapping chaos.
- **Segmented control** (Long/Short, W/L filter): an inset track, with the active segment on `--surface-2` and a `--line-strong` border.
  Long-active text uses `--gain` and Short-active text uses `--loss`. The thumb is CSS-grid-aligned, never absolutely positioned (that's how v1's toggle misalignment happened).
- **Chips** (setups and mistakes): 32px tall (mobile 36), radius 6, inset bg. When selected, the border uses the brand colour and the text `--ink-1`. Mistake chips use the warn colour when selected.
- **Sheet:** a bottom sheet on mobile (max-height 92dvh, safe-area padding) and a right drawer (440px) on desktop.
  Primary actions are pinned to the sheet footer so they are always visible.
- **Money:** `<Money value />` is mono, with gain/loss/flat colour and a sign. The format is `+$1,234.50` and `−$80.00` (the minus is U+2212).

## Rules
- Layouts must never overflow horizontally at 360px. Fixed bars respect `env(safe-area-inset-*)`.
- Every interactive element has hover, focus-visible, active and disabled states. Data views have loading, empty and error states.
- Colour means P&L, warning or action. Never decorate with colour.

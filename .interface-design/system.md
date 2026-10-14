# Design System — Trading Journal

> Extracted from existing code (25 app components + shadcn/ui primitives + globals.css).
> Direction: **Glassmorphic trading dashboard** — translucent blurred surfaces, a
> blue→cyan→teal brand gradient, green/red P&L semantics, and playful scale-on-press motion.

## Foundations

### Spacing
Base unit: **4px** (Tailwind `--spacing: .25rem`). Base rhythm is **8px** (`gap-2` / `space-y-2`).

```
Scale: 4, 8, 12, 16, 24, 32   →  1, 2, 3, 4, 6, 8
```

| Use | Default | Notes |
|-----|---------|-------|
| Item gap (icon+label, inline) | `gap-2` (8px) | the dominant gap |
| Stacked content | `space-y-2` / `space-y-4` | 8px tight, 16px grouped |
| Card / panel padding | `p-4` (16px), `sm:p-6` (24px) | responsive bump |
| Compact padding | `p-2` / `p-3` | dense rows, chips |
| Section padding (marketing) | `py-20` / `py-32` | landing only |

### Radius
Token: `--radius: 0.625rem` (10px).

| Class | Size | Use |
|-------|------|-----|
| `rounded-lg` | 10px | **workhorse** — inputs, content blocks, list items |
| `rounded-xl` | 14px | cards / panels |
| `rounded-full` | pill | badges, avatars, icon buttons |
| `rounded-md` | 8px | buttons (shadcn default) |

### Depth — glassmorphic (NOT borders-only)
Surfaces are translucent + blurred, layered with a 1px hairline border and a soft shadow.

- **Surface:** translucent `bg-card` (rgba) — light `rgba(255,255,255,0.5)`, dark `rgba(30,35,50,0.4)`
- **Blur:** `backdrop-blur-xl` on cards, `backdrop-blur-sm`/`-md` on buttons
- **Border:** 1px hairline via `border-border` (`rgba(0,0,0,0.05)` / `rgba(255,255,255,0.05)`)
- **Shadow:** `shadow-xl` on cards; `shadow-md`/`-lg` on controls
- Recipe: `bg-card border backdrop-blur-xl shadow-xl rounded-xl`

### Color

Neutrals — gray scale (primary text/surfaces).

| Role | Value |
|------|-------|
| Background | `#f0f4f8` light / `#0a0e1a` dark (+ fixed gradient wash at 15–20% opacity) |
| Primary | blue `#3b82f6` (`--primary`), brand variant `blue-600` |
| **Signature gradient** | `from-blue-* via-cyan-* to-teal-*` |
| Profit / positive | green |
| Loss / negative | red (`--destructive #d4183d`) |
| Warning | yellow / orange |
| Ring | `--ring` |

Always pair color with both light + dark values; theme transitions are global.

### Typography
- Font: **Inter** (300–800 loaded; use 400 / 500 / 600).
- Headings: `tracking-tight` (-0.02em). `h1` 2xl · `h2` xl · `h3` lg.
- Numbers/tables: `tabular-nums` (`font-variant-numeric: tabular-nums`).
- iOS: inputs forced to 16px to prevent zoom.

### Motion
- Global theme transition: `0.4s cubic-bezier(0.4,0,0.2,1)` on color/bg/border/shadow/blur.
- Utilities: `.hover-lift` (translateY -2px), `.hover-scale` (1.02), `.hover-glow` (blue glow shadow).
- Entrance: `.animate-fade-in-up` (0.5s), `.animate-pulse-soft`, `.animate-shimmer` (loading).
- Easing default: `cubic-bezier(0.4, 0, 0.2, 1)`.

## Component Patterns

### Button (shadcn `Button` + custom `blue` variant)
- **Size:** default `h-9` (36px), `px-4 py-2`, `rounded-md`. `sm` h-8 / `lg` h-10 / `icon` size-9.
- **Always:** `hover:scale-105 active:scale-95`, `backdrop-blur`, shadow, `transition-all duration-200`.
- **Variants:** `default` (primary), `outline`, `secondary`, `ghost`, `link`, `destructive`, **`blue`** (brand: `bg-blue-600 hover:bg-blue-700`, `border-blue-500/40`).
- Touch targets: min 44×44 on iOS.

### Card (shadcn `Card`)
- Shell: `bg-card text-card-foreground flex flex-col gap-6 rounded-xl border backdrop-blur-xl shadow-xl`.
- Header/Content/Footer padding: `px-4 sm:px-6`, `pt-4 sm:pt-6`, `pb-4 sm:pb-6`.
- Header grid gap: `gap-1.5`.

### Badge / pill
- `rounded-full`, compact `px-2`/`px-3`, often a `*-500/20` tinted border + `*-500/10` fill in the semantic color.

### Data emphasis
- Profit/loss values: semantic green/red text + `tabular-nums`.
- Left accent stripe pattern available (`border-l-4`) for status rows.

## Conventions
- Build on shadcn/ui primitives in `src/components/ui/`; don't re-implement.
- Tailwind v4, CSS-first config — tokens live in `src/styles/globals.css` (`:root` + `.dark` + `@theme inline`). `src/index.css` is compiled output; never edit it.
- Every color/surface must define both light and dark values.
- Reach for the spacing scale (1,2,3,4,6,8) and `rounded-lg`/`-xl` before arbitrary values.
- Prefer the glass recipe (translucent + blur + hairline + soft shadow) over opaque solid panels.

# Design System

Visual conventions for Hotel PMS, derived from the **Console** theme of our reference mockups.

The Console direction is intentional: terminal-density, monospace everywhere, neon-on-dark sidebar. It reads as "professional internal tool" rather than consumer SaaS, fits the operational nature of a PMS, and ages well — utilitarian designs don't go out of fashion the way trend-driven ones do.

Reference mockups: `docs/mockups/`. When in doubt, open the mockup.

---

## Core principles

1. **Density over decoration.** This is a screen people stare at all day. Tight rows, small badges, generous information per pixel. No oversized cards, no excessive whitespace, no gradients.
2. **Monospace everywhere.** Every glyph in the app — including buttons, labels, and headings — uses a monospace font. This is the most distinctive choice in the design language; do not break it.
3. **Square corners.** All elements have `border-radius: 0`. No rounded buttons, no rounded cards, no pill badges.
4. **Neon green as accent, deep navy as anchor.** The accent color (`#00d4aa`) appears only on dark surfaces (sidebar, table headers, primary buttons). It never appears on light surfaces as a fill.
5. **Uppercase for navigation, labels, and headers.** Body text and data values stay in normal case.

---

## Color tokens

Define once in `src/app/globals.css`, reference everywhere — including Tailwind's `theme.extend.colors`.

### Slate base

```css
--slate-50:  #f8fafc;
--slate-100: #f1f5f9;
--slate-200: #e2e8f0;
--slate-300: #cbd5e1;
--slate-400: #94a3b8;
--slate-500: #64748b;
--slate-600: #475569;
--slate-700: #334155;
--slate-800: #1e293b;
--slate-900: #0f172a;
--slate-950: #020617;
```

### Console-specific

```css
--console-bg:         #f6f7f8;  /* page background */
--console-surface:    #ffffff;  /* cards, inputs, table body */
--console-ink:        #0a0e1a;  /* primary text + sidebar bg + primary button bg */
--console-accent:     #00d4aa;  /* neon green — accent only */
--console-border:     #d1d5db;  /* card and input borders */
--console-border-soft:#e5e7eb;  /* table row separators */
```

### Status palette

Used for room status (RoomStatus enum), reservation status, payment status, folio status.

| Status         | Background  | Text        | Pip         |
|----------------|-------------|-------------|-------------|
| VC / paid / checked-in     | `#ecfdf5` (emerald-50) | `#047857` (emerald-700) | `#10b981` (emerald-500) |
| OC / open / confirmed      | `#eff6ff` (blue-50)    | `#1d4ed8` (blue-700)    | `#3b82f6` (blue-500)    |
| VD / unpaid                | `#fffbeb` (amber-50)   | `#d97706` (amber-600)   | `#f59e0b` (amber-500)   |
| OD / cancelled             | `#fef2f2` (red-50)     | `#dc2626` (red-600)     | `#ef4444` (red-500)     |
| OOO / closed / checked-out | `#f1f5f9` (slate-100)  | `#475569` (slate-600)   | `#64748b` (slate-500)   |

Add to your CSS variable block:

```css
--emerald-50: #ecfdf5;  --emerald-500: #10b981;  --emerald-700: #047857;
--blue-50:    #eff6ff;  --blue-500:    #3b82f6;  --blue-700:    #1d4ed8;
--amber-50:   #fffbeb;  --amber-500:   #f59e0b;  --amber-600:   #d97706;
--red-50:     #fef2f2;  --red-500:     #ef4444;  --red-600:     #dc2626;
```

---

## Typography

**Font stack:**
```css
font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
```

The whole app is monospace. There is no separate display font.

**Scale:**

| Use                       | Size    | Weight | Notes                                    |
|---------------------------|---------|--------|------------------------------------------|
| Page H1                   | 20px    | 700    | uppercase, tracking-[0.02em], `▸ ` prefix in accent |
| Card / section header     | 11px    | 700    | uppercase, tracking-[0.08em], `// ` prefix |
| KPI value                 | 22px    | 700    | tabular nums                             |
| Body text / table cells   | 12-13px | 400-500| normal case                              |
| Buttons                   | 11px    | 600    | uppercase, tracking-[0.04em]             |
| Form labels               | 10px    | 600    | uppercase, tracking-[0.06em]             |
| Table headers             | 10px    | 600    | uppercase, tracking-[0.08em]             |
| Badges                    | 10px    | 600    | tracking-[0.06em]                        |
| Group / KPI labels        | 9-9.5px | 600    | uppercase, tracking-[0.10em]             |
| Breadcrumbs               | 11px    | 500    | uppercase, tracking-[0.05em]             |

Use tabular numerals on all numeric columns and KPIs:

```css
.num { font-variant-numeric: tabular-nums; }
```

**Tracking rule:** uppercase elements get positive tracking (0.04–0.10em). Body text and data values get 0.

---

## Spacing rhythm

Standard density (matches `data-density="standard"` in mockup):

```
content padding       20px 24px
card padding          14px
card header padding   12px 14px
table row padding     9px 12px
table header padding  8px 12px
button height         32px
button padding        0 12px
page header bottom    16px
form field gap        14-16px
card-to-card gap      12px
```

Apply as actual values. Do not introduce new spacing tokens without updating this list.

---

## Layout chrome

### Sidebar

- Width: 220px desktop, 56px collapsed
- Background: `--console-ink` (`#0a0e1a`)
- Default text: `#6b7280`
- Hover/active text: `--console-accent` (`#00d4aa`)
- Active link: transparent background + left indicator `box-shadow: inset 2px 0 0 #00d4aa`
- Group labels: 9px, uppercase, tracking-[0.12em], color `#4b5563`
- Nav items: 12px, uppercase, tracking-[0.04em]
- **No icons in nav** for desktop console theme — text-only is the convention. (Mobile bottom nav still uses Lucide icons for HK module.)

**Brand mark:** square outlined neon `[Z]` or similar — see mockup. Top-left of sidebar.

### Top bar

- Height ~48px, white background
- Bottom border: `1px solid #d1d5db`
- Breadcrumbs left, business-date pill + user avatar right
- Business-date pill: white, `#d1d5db` border, square corners, 10px uppercase, neon dot indicator

### Page header

- H1 with `▸ ` prefix in accent color
- Subtitle: 11px, slate-500, normal case
- Actions cluster top-right of header row

---

## Component conventions

### Buttons

| State        | Background     | Border         | Text          |
|--------------|----------------|----------------|---------------|
| Default      | white          | `#9ca3af`      | `#0a0e1a`     |
| Default hover| `#f6f7f8`      | `#0a0e1a`      | `#0a0e1a`     |
| Primary      | `#0a0e1a`      | `#0a0e1a`      | `#00d4aa`     |
| Primary hover| `#1f2937`      | `#1f2937`      | `#00d4aa`     |
| Danger       | red-600 fill   | red-600        | white         |

All buttons: 11px, uppercase, tracking-[0.04em], weight 600, border-radius 0, height 32px.

### Cards

- White background, `1px solid #d1d5db`, square corners, no shadow
- Card header (when present): inverted — `background: #0a0e1a; color: #00d4aa;` with `// ` prefix on title
- Card footer: `background: #f6f7f8; border-top: 1px solid #d1d5db; font-size: 11px;`

### Tables

- Border-collapse, full width
- **Header row:** `background: #0a0e1a; color: #00d4aa;` (yes, dark header). 10px uppercase, tracking-[0.08em].
- Body rows: white, with `nth-child(even)` getting `background: #f6f7f8` (zebra)
- Row hover: `background: #ecfdf5` (mint-green tint, signals interactivity)
- Row separator: `1px solid #e5e7eb`
- Cell font: 12-13px, normal case
- Numeric columns get `class="num"` — tabular numerals + right alignment

### Form fields

- Input: white, `1px solid #9ca3af`, square corners, monospace
- Focus: border becomes `--console-ink`, soft ring `box-shadow: 0 0 0 3px rgba(15,23,42,0.08)`
- Label: above input, 10px uppercase, tracking-[0.06em]
- Field gap: 14-18px

### Badges

- Border-radius: 0 (square)
- Padding: `0 5px`, height 20px
- Font: 10px, monospace, tracking-[0.06em]
- Pip dot: 6×6px, square, status-colored

### KPIs

- Label: 9.5px, tracking-[0.1em], slate-600, wrapped in `[ ` `]` — e.g. `[ TOTAL REVENUE ]`
- Value: 22px, weight 700, tabular nums
- Delta: 10px

### Tabs

- Underline-style (no pill background)
- Tab text: 11px, uppercase, tracking-[0.06em]
- Active tab: 2px underline in `--console-ink` (or accent if on dark surface)

---

## Tape Chart specifics (FO-02)

Most visually complex screen in the app. Lock these conventions in for implementation:

- **Grid:** room rows × date columns
- **Sticky first column:** room number + type, white background, right border
- **Sticky header row:** day-of-week (10px uppercase) above date (12px tabular num)
- **Cell height:** 32px
- **Cell content:** small inset div with `margin: 2px`:
  - Status-colored background (e.g. `--emerald-50` for VC)
  - Left border 3px in status accent color (e.g. `--emerald-500` for VC)
  - Border-radius 0
  - Text: 11px, weight 500, status-colored or slate-700
  - Content: guest first name + last initial (e.g. "Andi P.") if occupied, status code if vacant
- **Legend bar above grid:** all 5 status badges + room/day count on the right
- **Container:** card with `padding: 0`, `overflow: hidden`, `max-height: 520px` with internal scroll
- **Scroll behavior:** both horizontal and vertical, sticky cells stay anchored

Reference: open the design canvas in `docs/mockups/`.

---

## Mobile (Housekeeping)

HK module is mobile-first.

- Top bar: white, `1px solid #d1d5db` bottom, hotel name 13px uppercase tracking-[0.04em]
- Bottom nav: white background, top border, icon-and-label cells
- Cards stack vertically with 12px gap
- Tap targets minimum 44×44px
- Status pills slightly larger here (24px tall vs 20px desktop) for thumb readability

---

## Implementation hand-off

### `src/app/globals.css`

Put tokens under `@layer base`:

```css
@layer base {
  :root {
    /* slate */
    --slate-50: #f8fafc;
    --slate-100: #f1f5f9;
    /* ...etc, all slate stops... */

    /* status */
    --emerald-50: #ecfdf5; --emerald-500: #10b981; --emerald-700: #047857;
    --blue-50: #eff6ff;    --blue-500: #3b82f6;    --blue-700: #1d4ed8;
    --amber-50: #fffbeb;   --amber-500: #f59e0b;   --amber-600: #d97706;
    --red-50: #fef2f2;     --red-500: #ef4444;     --red-600: #dc2626;

    /* console theme */
    --console-bg: #f6f7f8;
    --console-surface: #ffffff;
    --console-ink: #0a0e1a;
    --console-accent: #00d4aa;
    --console-border: #d1d5db;
    --console-border-soft: #e5e7eb;
  }

  body {
    font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
    background: var(--console-bg);
    color: var(--console-ink);
  }

  .num { font-variant-numeric: tabular-nums; }
}
```

### `tailwind.config.ts`

Extend so `bg-console-ink`, `text-console-accent`, etc. work:

```ts
theme: {
  extend: {
    colors: {
      console: {
        bg: "var(--console-bg)",
        surface: "var(--console-surface)",
        ink: "var(--console-ink)",
        accent: "var(--console-accent)",
        border: "var(--console-border)",
        "border-soft": "var(--console-border-soft)",
      },
      status: {
        "vc-bg":  "var(--emerald-50)",  "vc-fg":  "var(--emerald-700)",  "vc-pip":  "var(--emerald-500)",
        "oc-bg":  "var(--blue-50)",     "oc-fg":  "var(--blue-700)",     "oc-pip":  "var(--blue-500)",
        "vd-bg":  "var(--amber-50)",    "vd-fg":  "var(--amber-600)",    "vd-pip":  "var(--amber-500)",
        "od-bg":  "var(--red-50)",      "od-fg":  "var(--red-600)",      "od-pip":  "var(--red-500)",
        "ooo-bg": "var(--slate-100)",   "ooo-fg": "var(--slate-600)",    "ooo-pip": "var(--slate-500)",
      },
    },
    fontFamily: {
      sans: ['ui-monospace', '"JetBrains Mono"', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      mono: ['ui-monospace', '"JetBrains Mono"', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
    },
  },
}
```

`sans` and `mono` both pointing at monospace is intentional — every text element gets monospace by default, no exceptions.

### Existing screens

The Admin module (already shipped) will need a styling pass to match this language. **Do not retrofit while mid-FO-module work.** Schedule a dedicated "console-theme migration" session after FO is in flight.

---

## What this doc does NOT cover

- Animation / motion (none for MVP — instant transitions only)
- Dark mode (not in MVP)
- Print styles (handled per-screen for PDF outputs)
- Iconography beyond what mockups show (use Lucide React, sized 14–16px to match the dense layout)

---

## When to update this doc

- A new screen introduces a visual pattern not listed here → document it here, don't reinvent in the next screen
- A token value changes → update here AND in `globals.css`/`tailwind.config.ts` simultaneously
- A teammate proposes a deviation → discuss in team chat, decide once, document the decision
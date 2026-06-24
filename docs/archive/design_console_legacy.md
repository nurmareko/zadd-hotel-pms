ARCHIVED — superseded by docs/design.md (V2). Kept for history.

# Design System

Visual conventions for ZADD Hotel Management, derived from the **Console** theme of our reference mockups.

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

Define once in `src/app/globals.css`, reference everywhere. Tailwind 4 utilities are bridged through the `@theme inline` block in that file.

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
| VCU                        | `#fefce8` (yellow-50)  | `#a16207` (yellow-700)  | `#eab308` (yellow-500)  |
| OD / cancelled             | `#fef2f2` (red-50)     | `#dc2626` (red-600)     | `#ef4444` (red-500)     |
| OOO / closed / checked-out | `#f1f5f9` (slate-100)  | `#475569` (slate-600)   | `#64748b` (slate-500)   |

Add to your CSS variable block:

```css
--emerald-50: #ecfdf5;  --emerald-500: #10b981;  --emerald-700: #047857;
--blue-50:    #eff6ff;  --blue-500:    #3b82f6;  --blue-700:    #1d4ed8;
--amber-50:   #fffbeb;  --amber-500:   #f59e0b;  --amber-600:   #d97706;
--yellow-50:  #fefce8;  --yellow-500:  #eab308;  --yellow-700:  #a16207;
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

- Width: 240px desktop, fixed; not collapsible
- Background: `--console-ink` (`#0a0e1a`)
- Default text: `#6b7280`
- Hover/active text: `--console-accent` (`#00d4aa`)
- Active link: transparent background + left indicator `box-shadow: inset 2px 0 0 #00d4aa`
- Group labels: 9px, uppercase, tracking-[0.12em], color `#4b5563`
- Nav items: 12px, uppercase, tracking-[0.04em]
- Desktop nav items include Lucide icons (14px) before the label.

**Brand mark:** square outlined neon `[Z]` or similar — see mockup. Top-left of sidebar.

### Top bar

- Mobile/coarse-pointer shell only; desktop identity and logout live in the fixed sidebar.
- Sticky white background with `1px solid #d1d5db` bottom border.
- Neon `[Z]` brand mark plus account identity and role on the left; logout icon action on the right.

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

- **Grid skeleton:** room-type-grouped rows × date columns. Each collapsible room-type header shows room count and OOO count, followed by physical-room rows and an `Unallocated` row.
- **Sticky first column:** 192px wide; room rows show room number, floor, and current room status. OOO rows use a grey striped treatment and are not bookable.
- **Sticky header row:** 44px high; day-of-week (or `Today`) above date. Date columns are 80px wide.
- **Row heights:** room rows are 32px; room-type group headers are 36px. The unallocated row uses one 32px lane minimum and grows by 32px for overlapping reservations.
- **Reservation bars:** absolute-positioned overlays spanning arrival to departure boundaries, centered on date columns. Bars are 24px high (`32px` row minus `4px` vertical margin on each side), square-cornered, and show the guest name with ellipsis overflow.
- **Reservation bar palette:** confirmed orange `#f97316`, checked-in emerald `#047857`, checked-out slate `#64748b`, unallocated blue `#2563eb`.
- **Checkout marker:** when the departure boundary is visible in the current window, add a centered inward-facing white notch on the bar's right edge: `border-top: 5px solid transparent`, `border-bottom: 5px solid transparent`, and `border-right: 7px solid rgb(255 255 255 / 0.88)`. Do not show a notch when the bar is clipped because checkout falls outside the visible window.
- **Empty cells:** physical-room and unallocated-lane cells are links to create a reservation with room or room-type and arrival date prefilled. OOO cells remain non-interactive.
- **Legend bar above grid:** four reservation bars (Confirmed, Checked-in, Checked-out, Unallocated), the checkout-notch swatch, `Greyed rows = Out of Order`, and room/day count on the right.
- **Container:** bordered card with `padding: 0`, internal horizontal and vertical scroll, `max-height: 560px` below 768px and `656px` from 768px upward.
- **Scroll behavior:** both horizontal and vertical, sticky cells stay anchored

Reference: open the design canvas in `docs/mockups/`.

---

## F&B floor plan specifics (FB-01 / AD-05)

The F&B floor plan and Admin layout editor use the shared constants in `src/lib/restaurant-table-layout.ts`.

- **Canvas:** 900×560px, dashed console-border outline, `bg-console-bg`, wrapped in an overflow-auto container.
- **Table tile:** 72×72px, absolute-positioned by `RestaurantTable.posX` / `posY`.
- **Layout margin:** 20px.
- **Layout gap:** 28px.
- **Drag grid:** 20px increments in the Admin layout editor.
- **Location tabs:** one tab per `TableLocation` value: INDOOR, OUTDOOR, PRIVATE.
- **Legend:** shown above the floor canvas, one status badge per `TableStatus`.

F&B floor tile colors are verified against `src/app/app/fb/table-card.tsx`:

| TableStatus | Background | Text | Border | Notes |
|---|---|---|---|---|
| AVAILABLE | `#ecfdf5` (emerald-50) | `#022c22` (emerald-950) | `#047857` (emerald-700) | Hover `#d1fae5` (emerald-100) |
| OCCUPIED | `#eff6ff` (blue-50) | `#172554` (blue-950) | `#1d4ed8` (blue-700) | Hover `#dbeafe` (blue-100) |
| RESERVED | `#fffbeb` (amber-50) | `#451a03` (amber-950) | `#b45309` (amber-700) | Opens table-action popover |
| OUT_OF_SERVICE | `#f1f5f9` (slate-100) | `#020617` (slate-950) | `#334155` (slate-700) | `opacity-80`, opens table-action popover |

Status badges elsewhere in F&B use the shared status token palette from `src/app/app/fb/status-badge.tsx`.

---

## Mobile and coarse-pointer navigation

HK screens remain mobile-first, but the responsive navigation applies to every module. The desktop sidebar appears only at `min-width: 768px` with a fine pointer; coarse-pointer tablets keep the mobile UI.

- Top bar: white, `1px solid #d1d5db` bottom, account identity and logout action
- Bottom nav: one role-scoped white tab bar across all modules, with top border and icon-and-label cells
- Overflow: show at most 5 slots; the final slot becomes `Lainnya` when additional destinations need a bottom-sheet menu
- Cards stack vertically with 12px gap
- Tap targets minimum 44×44px
- Status pills slightly larger here (24px tall vs 20px desktop) for thumb readability

---

## Housekeeping surfaces

HK is role-aware:

- `/app/hk` is only a redirect. HK members land on `/app/hk/clean`; HK supervisors and ADMIN land on `/app/hk/supervisor`.
- `/app/hk/clean` (Kamar Saya) stays mobile-first and optimized for thumb use while walking corridors.
- `/app/hk/rooms/[id]` is the shared room detail. It should keep housekeeper controls prominent on mobile and supervisor inspection/history controls clear on wider screens.
- `/app/hk/rooms` is the supervisor rooms worksheet and merged status board. Treat it as a dense operational table with date navigation, inline status override, reservation context, housekeeper, notes, and Daily List print.
- `/app/hk/list` is retired and redirects to `/app/hk/rooms`; do not design a standalone Daily List route.
- `/app/hk/lost-found` is text-only in the MVP. Use compact search/filter/table patterns, not media galleries or photo upload controls.

Keep the room-status palette consistent everywhere: VC emerald, OC blue, VD amber, OD red, VCU yellow-amber, OOO slate.

---

## Implementation hand-off

### `src/app/globals.css`

Define raw tokens under `@layer base`, then expose Tailwind 4 utility aliases through `@theme inline`:

```css
@theme inline {
  --color-console-bg: var(--console-bg);
  --color-console-surface: var(--console-surface);
  --color-console-ink: var(--console-ink);
  --color-console-accent: var(--console-accent);
  --color-console-border: var(--console-border);
  --color-console-border-soft: var(--console-border-soft);
  --color-status-vc-bg: var(--emerald-50);
  --color-status-vc-fg: var(--emerald-700);
  --color-status-vc-pip: var(--emerald-500);
  /* ...etc, all shared status aliases... */
  --font-sans: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
  --font-mono: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
}

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
    --yellow-50: #fefce8;  --yellow-500: #eab308;  --yellow-700: #a16207;
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

Keep the custom `desktop` breakpoint pointer-aware. Color utilities such as `bg-console-ink` and `text-status-vc-fg` are exposed by `@theme inline` in `globals.css`. Existing compatibility extensions remain in this config, but add new Tailwind 4 token aliases to `globals.css` first.

```ts
theme: {
  extend: {
    screens: {
      desktop: { raw: "(min-width: 768px) and (pointer: fine)" },
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

Existing screens consume the shared Console tokens and utility aliases. When adding a visual pattern, extend the shared token set rather than introducing a screen-local palette without documenting it.

---

## What this doc does NOT cover

- Animation / motion (none for MVP — instant transitions only)
- Dark mode (not in MVP)
- Print styles (handled per-screen for PDF outputs)
- Iconography beyond what mockups show (use Lucide React, sized 14–16px to match the dense layout)

---

## When to update this doc

- A new screen introduces a visual pattern not listed here → document it here, don't reinvent in the next screen
- A token value changes → update here AND in `globals.css`; update `tailwind.config.ts` too when the change affects its breakpoint or compatibility extensions
- A teammate proposes a deviation → discuss in team chat, decide once, document the decision

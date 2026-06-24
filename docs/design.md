# ZADD Hotel Management Design System V2

Version: 2.0

This is the single canonical visual and interaction design source for ZADD Hotel Management. It replaces the legacy Console language and merges the prior V2 experiment notes into one system for product design, implementation, and AI-agent generation.

ZADD Hotel Management is a modern hospitality operating platform. It should feel calm, professional, organized, premium, efficient, trustworthy, and modern. It should never feel like a terminal interface, developer console, dark admin template, retro PMS, cyberpunk dashboard, or generic Bootstrap admin screen.

Reference influences: Mews PMS, Cloudbeds, Linear, Stripe Dashboard, and Notion. Use those as directional references for clarity and polish, not as templates to copy.

## Design Principles

### Information First

Visual design exists to improve operational clarity. Decoration never takes priority over information, and color is used to communicate status or action rather than mood.

### Action First

Users open ZADD Hotel Management to complete work. Every page should make the current situation understandable within 3 seconds and the next useful action identifiable within 5 seconds.

### Hospitality First

Interfaces should feel purpose-built for hotel operations. Use workflow-specific layouts for front office, housekeeping, F&B, accounting, and admin instead of generic SaaS screens when a hospitality pattern is clearer.

### Modern Operational Software

The system should be full-width, responsive, efficient, and comfortable for long shifts. It uses soft hierarchy, bright surfaces, rounded cards, subtle shadows, Inter typography, Lucide icons, and consistent status chips.

## Layout System

### Page Width

Pages use the available viewport width. Do not add artificial max-width constraints to operational screens such as dashboards, worksheets, Tape Chart, room boards, and tables.

### Page Padding

Use consistent page padding by breakpoint:

| Viewport | Padding |
|---|---:|
| Desktop | 24px |
| Tablet | 20px |
| Mobile | 16px |

### Gaps And Rhythm

Use generous spacing between sections and compact spacing inside related content.

| Element | Desktop | Mobile |
|---|---:|---:|
| Section gap | 24px | 16px |
| Card gap | 16px | 12px |
| Card padding | 20px | 16px |
| Form field gap | 14-16px | 14px |
| Page header bottom gap | 16px | 14px |
| Table cell padding | 12px 14px | 10px 12px |

Avoid new spacing scales unless the pattern is documented here.

### Dashboard Order

Every dashboard follows this order:

1. KPI summary
2. Priority actions
3. Operational content
4. Supporting data
5. History

Never place history above current tasks or primary actions.

### Detail Page Order

Detail pages follow this order:

1. Header
2. Primary action
3. Status
4. Information blocks
5. History

## Surface System

### App Background

The app background is `#F8FAFC`. Avoid pure white page backgrounds; the slight tint reduces visual fatigue during long shifts.

### Cards

Cards are the primary layout unit for grouped operational information.

| Property | Value |
|---|---|
| Background | `#FFFFFF` |
| Border | `1px solid #E5E7EB` |
| Radius | 16px |
| Shadow | Soft only: `0 1px 2px rgba(0,0,0,0.05)`, optionally `0 4px 8px rgba(0,0,0,0.04)` |
| Padding | 20px desktop, 16px mobile |

Every card has a header, content, and optional actions. Do not use dark inverted card headers. Do not use thick borders or heavy shadows.

### Modals And Popovers

Modals use white backgrounds, 20px radius, and a larger soft shadow. Popovers should feel connected to the triggering control, stay compact, and preserve the same soft border and rounded surface language.

### Empty States

Empty states should explain the situation and point to the next useful action. Do not leave a blank region or only show "No data."

Example: "No rooms assigned today. Enjoy your shift."

## Typography

### Font Family

Use Inter as the primary typeface with a standard sans-serif fallback:

```css
font-family: Inter, ui-sans-serif, system-ui, sans-serif;
```

Avoid monospace typography except for rare technical identifiers where alignment is required. Typography should feel neutral and disappear behind the content.

### Type Scale

| Use | Size | Weight | Notes |
|---|---:|---:|---|
| Page title | 32px | 700 | Clear screen title |
| Section title | 20px | 600 | Major content grouping |
| Card title | 16px | 600 | Card header label |
| Body | 14px | 400 | Default readable content |
| Small text | 12px | 500 | Metadata and helper text |
| Status labels | 12px | 600 | Chips and compact labels |

Use tabular numerals for KPI values, money, dates in aligned columns, room counts, availability counts, and numeric table columns:

```css
.num { font-variant-numeric: tabular-nums; }
```

Letter spacing should usually be 0. Do not rely on uppercase tracking as a dominant style.

## Color System

Color communicates status, action, and hierarchy. It should not be decorative.

### Neutral Tokens

| Token | Hex | Usage |
|---|---|---|
| Background | `#F8FAFC` | App background |
| Surface | `#FFFFFF` | Cards, modals, inputs, tables |
| Border | `#E5E7EB` | Card and table borders |
| Border Strong | `#D1D5DB` | Inputs and stronger separators |
| Text | `#0F172A` | Primary text |
| Muted | `#64748B` | Secondary text and unavailable states |
| Soft Active | `#F1F5F9` | Sidebar active item and light selected states |

### Operational Tokens

| Token | Hex | Meaning |
|---|---|---|
| Green | `#22C55E` | Clean, ready, sellable, success |
| Blue | `#3B82F6` | Occupied, active, informational |
| Amber | `#F59E0B` | Vacant dirty, pending, waiting |
| Orange | `#F97316` | Occupied dirty, distinct warm warning |
| Purple | `#8B5CF6` | Inspection and special process |
| Red | `#EF4444` | Out of order, urgent, failed operation |
| Gray | `#64748B` | Inactive, unavailable, archived |

### Room Status Palette

This table is locked. Use these exact meanings and colors across room boards, Tape Chart room labels, filters, legends, chips, and reports.

| Code | Status | Color | Hex |
|---|---|---|---|
| VC | Vacant Clean | Green | #22C55E |
| OC | Occupied Clean | Blue | #3B82F6 |
| VD | Vacant Dirty | Amber | #F59E0B |
| OD | Occupied Dirty | Orange | #F97316 |
| VCU | Vacant Clean Uninspected | Purple | #8B5CF6 |
| OOO | Out Of Order | Red | #EF4444 |
| OOS | Out Of Service | Gray | #64748B |

Color meanings are:

- Green = clean, ready, sellable
- Blue = occupied, active, informational
- Amber = vacant dirty, pending
- Orange = occupied dirty, distinct from vacant dirty
- Purple = inspection, special process
- Red = out of order, urgent
- Gray = inactive, unavailable

### Status Chip Tints

Status chips should use pastel backgrounds with saturated text and/or a small color dot. Keep chips consistent across modules.

| Color | Background | Text |
|---|---|---|
| Green | `#DCFCE7` | `#166534` |
| Blue | `#DBEAFE` | `#1D4ED8` |
| Amber | `#FEF3C7` | `#B45309` |
| Orange | `#FFEDD5` | `#C2410C` |
| Purple | `#EDE9FE` | `#6D28D9` |
| Red | `#FEE2E2` | `#B91C1C` |
| Gray | `#F1F5F9` | `#475569` |

## Navigation Chrome

### Sidebar

Desktop navigation uses a white sidebar with a subtle right border.

| Property | Value |
|---|---|
| Width | 260px |
| Background | `#FFFFFF` |
| Border | `1px solid #E5E7EB` |
| Icon library | Lucide |
| Icon size | 18px |
| Active item background | `#F1F5F9` |
| Active item text | `#0F172A` |
| Active indicator | Left accent border |

Keep labels concise and role-scoped. Icons support recognition but should not become decoration.

### Mobile And Coarse Pointer Navigation

The desktop sidebar appears only on desktop/fine-pointer layouts. Coarse-pointer tablets keep the mobile UI.

Mobile uses a top bar plus a role-scoped bottom navigation:

- Top bar: white background, subtle bottom border, clear account or role context, and a logout/profile action.
- Bottom nav: white tab bar with a top border and icon-plus-label cells.
- Overflow: show at most 5 slots. If more destinations exist, the final slot becomes "Lainnya" and opens a bottom-sheet menu.
- Tap targets: at least 44px by 44px.
- Cards stack vertically with 12px gaps.
- Critical primary actions remain visible and should not be hidden behind menus.

## Components

### Page Headers

Page headers contain a clear title, an optional concise subtitle, and a right-aligned action cluster on desktop. On mobile, actions may wrap under the title but the primary action must remain visible.

Use plain descriptive titles. Do not use decorative prefixes, dark header strips, or terminal-style labels.

### Buttons

| Variant | Background | Border | Text | Radius | Height |
|---|---|---|---|---:|---:|
| Primary | `#0F172A` | `#0F172A` | `#FFFFFF` | 12px | 40px |
| Secondary | `#FFFFFF` | `#E5E7EB` | `#0F172A` | 12px | 40px |
| Danger | `#EF4444` | `#EF4444` | `#FFFFFF` | 12px | 40px |

Buttons should use clear labels and Lucide icons when the icon improves recognition. Avoid crowded toolbars; prefer contextual action placement.

### Inputs

| Property | Value |
|---|---|
| Height | 40px |
| Radius | 12px |
| Background | `#FFFFFF` |
| Border | `#D1D5DB` |
| Focus | Blue ring with a soft shadow |

Labels sit above fields, are short, and use the normal sans-serif typography. Group related fields and keep form actions close to the form.

### Status Chips

Status chips are compact, highly recognizable, and consistent across modules.

| Property | Value |
|---|---|
| Height | 24px desktop, slightly larger where thumb readability requires it |
| Radius | 999px |
| Font size | 12px |
| Weight | 600 |

Prefer chips over coloring entire cards or table rows. Use the locked room-status palette for room states.

### KPI Cards

KPI cards sit at the top of dashboards and answer the "what is happening now?" question.

Structure:

1. Label
2. Metric
3. Description or context

Example:

- Label: Occupancy
- Metric: 82%
- Description: 131 / 160 rooms

KPI values use tabular numerals. Cards use 16px radius and 20px padding on desktop.

### Tables

Tables are operational tools, not static reports. They should be scannable, comfortable, and interactive when the workflow requires it.

Use:

- Soft separators
- Minimal borders
- Comfortable row heights
- Sticky headers only when useful for long operational tables
- Tabular numerals and right alignment for numeric columns
- Inline chips for statuses
- Clear row actions

Avoid:

- Dark table headers
- Excessive grid lines
- Dense spreadsheet appearance
- Global sticky header styles that affect every table unintentionally

Sticky headers are scoped per table. Tape Chart is the special case where both the header row and first column remain anchored during scrolling.

### Card Pattern

Cards contain a header, content, and optional actions. They are useful for room tasks, dashboard sections, summary groups, and compact workflow units.

Example structure for HK:

- Room 307
- VD chip
- Guest arriving 14:00
- Primary action: Start Cleaning

## Responsive And Mobile Philosophy

Mobile users may be walking, standing, or carrying equipment. Design for quick interactions rather than exploration.

Responsive behavior:

| Viewport | Layout |
|---|---|
| Desktop | Multi-column where it improves comparison |
| Tablet | Two-column where content supports it |
| Mobile | Single-column, natural stacking |

Avoid horizontal scrolling on ordinary content. Reserve horizontal scrolling for purpose-built operational canvases such as Tape Chart and F&B floor plans.

## Role-Specific Design Language

### Housekeeping

Housekeeping is task-oriented, not report-oriented. A housekeeper should always know what room needs attention next.

Priority order:

1. Room number
2. Room status
3. Primary action
4. Guest context
5. Notes
6. History

HK surface guidance:

- `/app/hk` redirects by role and should not be treated as a standalone destination.
- `/app/hk/clean` is "Kamar Saya": mobile-first, thumb-friendly, and optimized for corridor work.
- `/app/hk/rooms/[id]` is the shared room detail. Keep housekeeper controls prominent on mobile; keep supervisor inspection and history controls clear on wider screens.
- `/app/hk/rooms` is the supervisor rooms worksheet and merged status board. Treat it as a dense operational table with date navigation, inline status override, reservation context, housekeeper, notes, and Daily List print.
- `/app/hk/list` is retired and redirects to `/app/hk/rooms`; do not design a standalone Daily List route.
- `/app/hk/lost-found` is text-only in MVP. Use compact search, filter, and table patterns, not galleries or photo upload controls.

### Front Office

Front Office is guest-oriented. Staff should immediately see who is arriving, who is departing, and what rooms are available.

Priority order:

1. Arrivals
2. Departures
3. Availability
4. Guest information
5. Billing
6. Reports

### F&B

F&B screens should prioritize current service state, table availability, active orders, and clear next actions. Use floor plans for spatial decisions and tables/lists for operational follow-through.

### Accounting And Admin

Accounting and admin screens should be calm, dense enough for repeated work, and explicit about state. Prefer tables, filters, status chips, and contextual actions over decorative summary sections.

## Operational Screen Patterns

### Tape Chart

Tape Chart is the most visually complex Front Office screen. Preserve its operational mechanics while expressing it with V2 surfaces, rounded elements, Inter typography, soft borders, and status chips.

Required structure:

- Grid skeleton: room-type-grouped rows by date columns.
- Each collapsible room-type header shows room count and OOO count, followed by physical-room rows and an `Unallocated` row.
- Sticky first column: 192px wide. Room rows show room number, floor, and current room status using the locked status palette.
- Sticky header row: 44px high. Show day-of-week or `Today` above the date.
- Date columns: 80px wide.
- Row heights: physical room rows are 32px; room-type group headers are 36px.
- Unallocated row: one 32px lane minimum and grows by 32px for overlapping reservations.
- Reservation bars: absolute-positioned overlays spanning arrival to departure boundaries, centered on date columns. Bars are 24px high, use rounded corners, and show guest names with ellipsis overflow.
- Checkout marker: when the departure boundary is visible, show a subtle inward-facing notch at the bar's right edge. Do not show a notch when the checkout is clipped outside the visible window.
- Empty cells: physical-room and unallocated-lane cells link to create a reservation with room or room-type and arrival date prefilled.
- OOO cells: non-interactive and visually unavailable using the locked red OOO status and a quiet unavailable treatment.
- Legend: show reservation states, checkout marker, unavailable room treatment, and room/day count above the grid.
- Container: card surface with no dark header, internal horizontal and vertical scroll, max height around 560px below 768px and 656px from 768px upward.
- Scroll behavior: horizontal and vertical scrolling are expected; sticky cells stay anchored.

Reservation bar colors:

| Reservation state | Color |
|---|---|
| Confirmed | Amber `#F59E0B` |
| Checked-in | Green `#22C55E` |
| Checked-out | Gray `#64748B` |
| Unallocated | Blue `#3B82F6` |

### F&B Floor Plan And Table Layout Editor

The F&B floor plan and Admin table-layout editor share the same spatial model. Preserve the positioning behavior while restyling with V2 surfaces.

Required structure:

- Canvas: 900px by 560px logical area, wrapped in an overflow-auto container.
- Table tile: 72px by 72px, absolute-positioned by `RestaurantTable.posX` and `RestaurantTable.posY`.
- Layout margin: 20px.
- Layout gap: 28px.
- Drag grid in Admin layout editor: 20px increments.
- Location tabs: one tab per `TableLocation` value: `INDOOR`, `OUTDOOR`, `PRIVATE`.
- Legend: show one status chip per `TableStatus` above the floor canvas.

Table status colors:

| TableStatus | Color |
|---|---|
| AVAILABLE | Green `#22C55E` |
| OCCUPIED | Blue `#3B82F6` |
| RESERVED | Amber `#F59E0B` |
| OUT_OF_SERVICE | Gray `#64748B` |

Use rounded table tiles, soft borders, clear labels, and status chips. Do not use dashed Console borders or dark/inverted headers.

## Icons

Use Lucide icons. Icons support understanding and should stay simple, line-based, and restrained. Avoid icon overload and decorative icon-only areas without clear affordances.

## Shadows

Shadows are very soft and professional. The interface should feel grounded, not floating dramatically. Avoid heavy shadows, glassmorphism, and gradient-heavy surfaces.

## AI Agent Generation Rules

When generating or retrofitting UI, always prefer:

- Cards over panels
- Soft hierarchy over hard borders
- Whitespace over separators where the relationship stays clear
- Status chips over colored containers
- Contextual actions over crowded toolbars
- Hospitality-specific workflows over generic admin layouts
- Modern SaaS patterns over legacy PMS layouts

Always use:

- Inter typography
- Lucide icons
- Soft shadows
- Rounded cards
- Pastel status chips
- The locked room-status palette

Never use:

- Monospace typography as the app default
- Square corners as a system style
- Terminal aesthetics
- Neon green themes
- Dark admin templates
- Dense spreadsheet styling
- Heavy gradients
- Glassmorphism
- Dark table or card headers

The final result should feel like a premium hotel operating platform built in 2026.

## Needs Confirmation

The following legacy structural details were carried forward because they affect workflow behavior, but they should be confirmed during implementation:

- Tape Chart fixed measurements: keep the 192px first column, 80px date columns, and 32px room rows unless the V2 retrofit proves they need responsive adjustment.
- Tape Chart checkout notch: the behavior is clear, but the exact V2 visual shape should be checked in design review so it remains recognizable without bringing back Console styling.
- F&B floor plan fixed canvas: keep the 900px by 560px logical canvas and 72px tiles unless tablet/mobile testing shows that a scaled canvas is needed.
- Mobile top bar identity: the legacy behavior exposed account identity and logout in the top bar; confirm whether V2 should keep that visible or move identity into a profile action.

## Maintenance

Update this document when a new screen introduces a visual pattern, a token changes, or a teammate proposes a reusable deviation. Archived files under `docs/archive/` are history only and are not active guidance.

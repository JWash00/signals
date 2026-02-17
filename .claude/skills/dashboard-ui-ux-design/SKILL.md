---
name: dashboard-ui-ux-design
description: >
  Comprehensive UI/UX design rules for building dashboards. Use this skill
  whenever designing, building, or modifying any dashboard component, layout,
  color system, typography, or interaction pattern. Reference specific sections
  relevant to the task at hand — you do not need to apply every rule on every task.
---

# Dashboard UI/UX Design Skill

## When to Use This Skill

Load and reference this skill when:
- Building or modifying any dashboard layout, page, or screen
- Creating or updating UI components (cards, tables, modals, nav, forms, charts)
- Making color, typography, or spacing decisions
- Implementing interactive states (hover, loading, empty, error, success)
- Designing animations or micro-interactions
- Reviewing existing UI for quality issues

## How to Apply These Rules

Before writing any UI code:
1. Identify which section(s) below are relevant to the current task
2. Apply the rules from those sections explicitly in your implementation
3. When in doubt, ask: *Does this serve the user's goal? Is this the minimum UI needed? Have I handled all states? Is this consistent with the design system?*

---

## Core Philosophy

Function over form. Dashboards fail due to **disorganization**, not lack of visual flair. A well-structured bland UI outperforms a chaotic beautiful one. You are building a container for the user's content — stay out of the way.

Never design only the "happy path." Every component must handle:
- **Empty state** — clear CTA, helpful message
- **Loading state** — skeleton screen or spinner
- **Success state** — toast notification or checkmark confirmation
- **Error state** — clear message explaining what went wrong and how to fix it

---

## Layout & Grid

### Grid System
- Use strict 2-column, 3-column, or 2x2 grid layouts for dashboards — not freeform
- Maximize screen real estate; dashboards need high information density
- Allow full-width breaks for headers only when it still feels balanced
- Verify alignment visually — all elements should snap to grid columns

### Spacing
- Use a consistent spacing scale throughout (e.g., 4px base unit: 4, 8, 12, 16, 24, 32, 48)
- Dashboards use **tighter spacing** than marketing pages — smaller fonts, denser layouts
- Mobile layouts need **more** vertical spacing than desktop, not less
- Separate list items using one of three methods: space alone, dividers/lines, or background color — do not mix methods within the same component
- Group related items visually through proximity (white space), not excessive borders

### Alignment
- Left-align text content; right-align numbers in tables
- Align interactive controls (buttons, filters) to the top-right of their parent container
- Maintain consistent padding inside cards: 16px minimum, 24px preferred

---

## Color System

Apply the following four-layer model to every color decision.

### Layer 1 — Neutral Foundation (90-95% of the UI)
- **Light mode backgrounds:** Pure white `#FFFFFF` for base; slightly off-white (e.g., `#F9FAFB`) for page background
- **Dark mode backgrounds:** Dark gray (e.g., `#111` or `#0F0F0F`) — never pure black `#000000`
- **Elevated surfaces in dark mode:** Use a lighter gray (e.g., `#1A1A1A`) or a subtle border — do NOT use shadows to elevate in dark mode
- **Text hierarchy (light mode):**
  - Headings: `~#111111` (near black)
  - Body: `~#374151` (medium gray)
  - Captions/metadata: `~#9CA3AF` (light gray)
- **Text hierarchy (dark mode):**
  - Headings: `#F9FAFB`
  - Body: `#D1D5DB`
  - Captions/metadata: `#6B7280`

### Layer 2 — Brand Accent Color
- Choose **one** primary brand color and build a scale from 100-900
- Light mode: Use 500-600 for default, 700 for hover
- Dark mode: Use 300-400 for default, 400-500 for hover
- A neutral-only palette (no brand accent) is valid — do not force color if the brand does not need it

### Layer 3 — Semantic Colors (use universally across the entire app)
- **Green** — success, ready, positive metrics, active status
- **Yellow/Amber** — warnings, in-progress, building states
- **Red** — errors, destructive actions, critical alerts
- **Blue** — informational messages, neutral updates

Apply semantic colors to: chips, badges, toast notifications, alert banners, status indicators, and chart data series. Never use an arbitrary color where a semantic one applies.

### Layer 4 — Theming
- Store all colors as CSS custom properties (`--color-bg`, `--color-text-primary`, `--color-accent`, etc.)
- Theme switching swaps Layer 2 and Layer 3 tokens; Layer 1 neutrals adjust for light/dark but do not fully invert
- Light and dark modes should **feel** different — do not simply invert the light mode palette

### Color Rules
- **Never** use multi-hue gradients (e.g., blue-to-green). If using gradients, use a single color light-to-dark. No gradient is usually cleaner.
- Vibrant colors belong in **charts and data visualizations only** — not in buttons, backgrounds, or text
- Never rely on color alone to convey meaning — pair with an icon or label for accessibility
- Do not use color for decoration; every color must communicate something

---

## Typography

### Scale
- Use a single sans-serif font family throughout (e.g., Inter, Geist, or system-ui)
- Establish a minimal type scale — dashboards pack more information than marketing pages:
  - Heading: 18-20px, weight 600
  - Subheading: 14-16px, weight 600
  - Body: 13-14px, weight 400
  - Caption/metadata: 11-12px, weight 400
- Minimize steps between type sizes — close sizing creates density without losing hierarchy
- Use **font weight** (400 vs 600) to create hierarchy before increasing font size

### Readability
- Minimum contrast ratio: **4.5:1** for body text (WCAG AA)
- Minimum contrast ratio: **3:1** for large text (18px+ or 14px+ bold)
- Line height: 1.4-1.6 for body text; 1.2 for headings
- Avoid ultra-thin (100) or ultra-black (900) weights for any readable text
- Truncate long text with ellipsis (`text-overflow: ellipsis`) and show full text in a tooltip on hover

### Rules
- Never use inconsistent font sizes across the same type of element
- Do not use `font-size` alone to create hierarchy — combine with weight and color
- Interactive focus outlines must be visible — never set `outline: none` without a custom replacement

---

## Components

### Tables & Lists
- Tables are the most common dashboard component — they must always be **interactive**
- Required table features: search, column sort, filter controls, row selection via checkbox
- Support bulk actions on selected rows (e.g., a "Delete selected" button that appears when rows are checked)
- Table columns: favor left-aligned text, right-aligned numbers, icon+label for status
- Separate list items consistently — choose one method per context: spacing only, border/divider, or alternating background
- Show favicon, title, metadata, and timestamps for link/URL lists
- For dense tables, use 12-13px font with 36-40px row height

### Cards
- Use cards to contain charts, KPIs, stats, and summaries
- Card anatomy: header (title + optional action), content area, optional footer
- Use subtle borders (`1px solid var(--color-border)`) or very light shadows — never harsh Figma-style drop shadows
- Two-column card grids work well for KPI dashboards
- Every card must serve a functional purpose — decorative-only cards are not acceptable

### KPI Cards
- Display the primary metric as a large number (24-32px, weight 700)
- Always include context: percentage change, up/down arrow, and a sparkline or micro-chart
- Use semantic color for the delta value (green for positive, red for negative)
- Two-column layout for scannable KPI grids

### Charts
- Stick to: **line charts** (trends over time), **bar charts** (comparisons), **donut charts** (proportions)
- Never use 3D charts, overly decorative graphs, or chart types that obscure the data
- Always include grid lines for reference
- Make charts interactive: hover states reveal exact values; click drills down
- Color-code data series consistently across the dashboard (e.g., revenue is always blue)
- Micro-charts inside KPI cards: sparklines at 40-60px height, no axes, no labels

### Forms & Inputs
- Always show a visible label above every input — never label-only-as-placeholder
- Include helper text below inputs when the expected format is non-obvious
- Validation errors: red border + inline error message below the field
- Group related fields with section headers and 24px vertical spacing between groups
- Form elements: text field, select/dropdown, toggle, button, tag input — build each as a reusable component

### Tabs
- Use tabs to add views without cluttering the sidebar (e.g., Overview / Analytics / Settings)
- Active tab: visually distinct via underline, bold weight, or background color
- Do not use tabs for navigation between unrelated pages — use the sidebar for that

### Navigation — Sidebar
The sidebar is the spine of the product. It must contain:
- Logo or app name at top
- Primary nav links with icon + text label
- Notification badges where applicable
- Grouped items with section headers or collapsible dropdowns
- Settings, profile, and secondary actions at the bottom
- Highlight the current active page visually

### Navigation — Top Bar
Reserve the top bar for:
- Page title or breadcrumbs
- Page-level actions (Create, Export, Filter)
- Search bar (can expand on click to save space)
- View toggles (list vs. grid)

### Modals
- Use for complex, multi-step tasks (e.g., creating a new item with multiple fields)
- Modal anatomy: header with title + close button, content area, footer with Cancel + primary action
- Darken the background with an overlay to focus attention
- Include keyboard shortcut hint on primary action (e.g., `Cmd+Enter to save`)
- Do not use modals for simple confirmations or settings — use a popover instead

### Popovers
- Use for simple settings, pickers, or non-blocking actions
- Anchor to the triggering element
- Auto-dismiss on click-away
- Max width: 320px; use scrolling for overflow content

### Toast Notifications
- Small banners positioned bottom-center or bottom-right
- Apply semantic colors: green (success), yellow (warning), red (error), blue (info)
- Auto-dismiss after 3-5 seconds; include a close button for persistent messages
- Slide-in animation (ease-out, 200ms)

### Empty States
- Every empty state must include: a clear heading, a brief explanatory message, and a prominent CTA button
- Use progressive disclosure: hide filters, sort controls, and bulk action tools until data exists
- An optional illustration or subtle animation softens the experience

---

## Interactive States

Every interactive component must implement all of the following states:

| State | Implementation |
|---|---|
| Default | Base appearance |
| Hover | Darken bg 8-12%, or lift with shadow, or reveal icon |
| Active/Pressed | Scale 0.98, darken bg further |
| Focus | 2px solid outline, high-contrast color — never `outline: none` without replacement |
| Disabled | 40% opacity, `cursor: not-allowed` |
| Loading | Spinner or skeleton; disable interaction |
| Error | Red border + inline message |

Hover state on table rows: light background highlight (`bg-opacity-5` of accent color).
Hover state on cards: increase shadow slightly or shift border color.

---

## Animations & Micro-interactions

### Timing Guidelines
- Standard UI transitions: **200-300ms** (fast enough to feel reactive)
- Entering elements: **ease-out** easing
- Exiting elements: **ease-in** easing
- Celebratory/playful moments: custom spring or bounce easing

### Required Interactions
- **Button click:** Scale to 0.98 on `mousedown`, return to 1.0 on `mouseup`. Color darkens one step.
- **Toast notifications:** Slide in from bottom (ease-out, 250ms). Auto-dismiss with fade-out.
- **Modals:** Fade + scale in from 0.95 to 1.0 (ease-out, 200ms). Backdrop fades in simultaneously.
- **Dropdown/popover:** Fade + translate in from 4px offset (ease-out, 150ms).
- **Skeleton screens:** Shimmer animation (gradient sweep, 1.5s loop) during loading.
- **Tooltip:** Appear after a **1-second hover delay** to prevent visual clutter. Fade in over 150ms.

### Animation Rules
- Do not animate on page load without user interaction — avoid auto-play flourishes
- Every animation must have a purpose (confirm action, indicate state change, guide attention)
- Do not animate more than 2-3 elements simultaneously
- Respect `prefers-reduced-motion` — wrap all animations in a media query check

---

## Accessibility

- **4.5:1** minimum contrast ratio for all body text
- **3:1** minimum contrast ratio for large text and UI components
- All interactive elements must be reachable and operable via keyboard
- Visible focus states on every focusable element — never `outline: none` without a styled replacement
- Provide text alternatives for icon-only buttons (tooltip + `aria-label`)
- Do not rely on color alone to convey state — always pair with icon or text label
- Logical tab order that follows visual reading order
- Form inputs must have associated `<label>` elements (not just placeholder text)

---

## Dashboard-Specific Rules

### Information Density
- Dashboards display more information per screen than any other UI type — embrace density
- Smaller fonts (12-14px), tighter line heights (1.3-1.4), reduced padding compared to marketing UI
- Use all or most of screen width — do not center content in a narrow column

### Scanning Patterns
- Design for **F-shaped scanning**: top-left is highest attention, bottom-right is lowest
- Place the most critical KPIs top-left
- Group related data together (all revenue metrics in one section, all engagement in another)
- Use visual separators (borders, spacing, background color) to chunk sections

### Real-Time & Async Data
- Use **optimistic UI**: update the UI immediately on user action; roll back only if the server returns an error
- Show skeleton screens (not blank states) during initial data load
- Show inline spinners for actions that update a specific component, not full-page loaders
- Provide meaningful progress feedback for operations over 1 second

---

## Do's and Don'ts Quick Reference

### DO
- Use strict grid layouts for all dashboard pages
- Design all four states for every component: empty, loading, success, error
- Use semantic colors universally (green=success, red=error, yellow=warning, blue=info)
- Build a reusable component library with consistent spacing, color tokens, and states
- Make tables interactive: search, sort, filter, bulk select
- Use breadcrumbs or back buttons when navigating to detail pages
- Add 1-second delay to tooltips
- Implement optimistic UI for instant user feedback
- Maintain 4.5:1 contrast ratio minimum for body text
- Use `prefers-reduced-motion` for all animations
- Store colors as CSS custom properties for theme switching
- Design light and dark modes in parallel, not sequentially

### DON'T
- Don't design only the happy path
- Don't use multi-hue gradients
- Don't let AI choose colors — pick intentional palettes manually
- Don't directly invert light mode to create dark mode — design each intentionally
- Don't use vibrant/saturated colors for backgrounds or buttons — reserve for charts
- Don't rely on color alone to communicate state
- Don't use 3D charts or overly decorative graphs
- Don't create non-functional, decorative-only cards
- Don't mix icon styles (outline vs. filled) — use one icon family throughout
- Don't use inconsistent corner radii — standardize on 1-2 values (e.g., 6px and 12px)
- Don't set `outline: none` without a visible focus replacement
- Don't show tooltips instantly — add a 1-second delay
- Don't design with placeholder text — use real or realistic content
- Don't use excessive white space in dashboards — utilize screen real estate efficiently
- Don't use modals for simple tasks — use popovers instead
- Don't animate excessively — every animation must serve a purpose

---

## Reference Examples

When making design decisions, benchmark against these real-world products:
- **Linear** — consistent design system, excellent micro-interactions, tight spacing
- **Vercel** — neutral palette done right, semantic status colors, informative loading states
- **Dub.co** — thoughtful empty states, clear CTAs
- **Notion** — tabs for related views, flexible layouts, clean modals

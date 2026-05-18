---
name: design-quality
description: >-
  Reference library per design professionale. Tipografia, spacing, color system
  (Itten harmony + HSB variations + OKLCH tokens), componenti, responsive,
  accessibilita. Leggere PRIMA di produrre qualsiasi output di design o
  implementare UI. Usare per: design system, prototipi, palette colori,
  dark/light theme, implementazione frontend, code review UX/UI. Trigger anche
  per: color scheme, palette, theme colors, brand colors, color tokens, color
  harmony, complementary colors, color contrast, colori che sembrano sbiaditi
  o che stonano.
license: MIT
metadata:
  author: agentflow
  version: "1.0"
  recommended_for: [designer, prototyper, frontend, code-reviewer]
---

# Skill: design-quality

Professional design reference library. Concrete values, not vague suggestions.
Read BEFORE producing any design output or implementing UI.

AgentFlow pipeline: Designer produces design system --> Prototyper builds HTML/CSS prototypes --> Frontend implements in framework --> Code Reviewer verifies compliance.

Every agent in the chain uses this skill as the shared quality standard.

---

## 1. Typographic Systems

### Type Scale Ratios

| Ratio | Name | Use Case |
|-------|------|----------|
| 1.200 | Minor Third | Dense apps, dashboards, admin panels |
| 1.250 | Major Third | Standard web apps, SaaS products |
| 1.333 | Perfect Fourth | Editorial, landing pages, marketing sites |

### Calculating Sizes

Formula: `size = base * ratio^step` where step ranges from -2 to +6.

Example — base 16px, ratio 1.250 (Major Third):

| Step | Size | Rounded | Tailwind | Usage |
|------|------|---------|----------|-------|
| -2 | 10.24 | 10px | text-[10px] | Fine print, captions |
| -1 | 12.80 | 13px | text-xs | Labels, metadata |
| 0 | 16.00 | 16px | text-base | Body text |
| +1 | 20.00 | 20px | text-xl | Large body, subheadings |
| +2 | 25.00 | 25px | text-2xl | Section headings (h3) |
| +3 | 31.25 | 31px | text-3xl | Page headings (h2) |
| +4 | 39.06 | 39px | text-4xl | Hero headings (h1) |
| +5 | 48.83 | 49px | text-5xl | Display text |

### Tailwind Size Reference

text-xs=12px, text-sm=14px, text-base=16px, text-lg=18px, text-xl=20px, text-2xl=24px, text-3xl=30px, text-4xl=36px, text-5xl=48px.

### Typography Rules

- **Max 2 font families**: one heading + one body, or a single family for both.
- **Line height**: 1.5 for body text, 1.2-1.3 for headings, 1.0-1.1 for display/hero.
- **Letter spacing**: -0.02em for large headings (>=30px), 0 for body, +0.05em for uppercase/small caps.
- **Font weight**: 400 body, 500 medium emphasis (labels, nav), 600-700 headings.
- **Max 3 weights per page** — more creates visual noise.
- Use `font-variant-numeric: tabular-nums` for number columns and data tables.
- Use `text-wrap: balance` on headings, `text-wrap: pretty` on body paragraphs.
- Use proper typographic characters: curly quotes, ellipsis character, en/em dashes.

---

## 2. Spacing System

### Base Unit: 4px

EVERY spacing value must be a multiple of 4px. No exceptions.

### Scale

| Token | px | rem | Tailwind | Common Use |
|-------|-----|------|----------|------------|
| 0 | 0 | 0 | p-0 | Reset |
| 1 | 4 | 0.25 | p-1 | Inline icon gap |
| 2 | 8 | 0.5 | p-2 | Tight padding, tag padding |
| 3 | 12 | 0.75 | p-3 | Compact component padding |
| 4 | 16 | 1.0 | p-4 | Standard component padding |
| 5 | 20 | 1.25 | p-5 | Medium padding |
| 6 | 24 | 1.5 | p-6 | Spacious component padding |
| 8 | 32 | 2.0 | p-8 | Card/section padding |
| 10 | 40 | 2.5 | p-10 | Large section gap |
| 12 | 48 | 3.0 | p-12 | Section divider |
| 16 | 64 | 4.0 | p-16 | Major section gap |
| 20 | 80 | 5.0 | p-20 | Hero/page vertical padding |
| 24 | 96 | 6.0 | p-24 | Full section vertical spacing |

### Usage Rules

| Context | Spacing |
|---------|---------|
| Component internal padding (compact) | 12-16px (p-3 to p-4) |
| Component internal padding (standard) | 16-24px (p-4 to p-6) |
| Component internal padding (spacious) | 24-32px (p-6 to p-8) |
| Gap between sibling components | 16-24px (gap-4 to gap-6) |
| Gap between page sections | 48-64px (gap-12 to gap-16) |
| Page side margin — mobile | 16px (px-4) |
| Page side margin — tablet | 24-32px (px-6 to px-8) |
| Page side margin — desktop | 32-64px (px-8 to px-16) |

---

## 3. Color System

### MANDATORY: Gather Context First

You cannot pick good colors without understanding the project. Before choosing any color, establish:

1. **Brand identity**: existing brand colors? Logo colors? Design tokens?
2. **Target audience**: Enterprise B2B? Consumer app? Kids? Luxury?
3. **Emotional tone**: Trust (blue), energy (orange/red), growth (green), creativity (purple), warmth (coral/amber)?
4. **Domain conventions**: Finance → blue/green, Health → teal/white, Food → warm tones, Tech → blue/purple.
5. **Light/dark mode requirements**: Both? Just one?

If context is not available, STOP and ask. Guessing produces generic, forgettable palettes.

### Phase 1: Choose Hues — Itten's Color Harmony

Itten's color circle: 3 primaries (yellow, red, blue), 3 secondaries (orange, green, violet), 6 tertiaries. Colors are harmonious when their pigment mix produces neutral gray — meaning all three primaries are present in balanced proportions.

**Harmony Schemes** (select one to define your palette hues):

| Scheme | Definition | Best for |
|--------|-----------|----------|
| Monochromatic | One hue, varied S and B | Clean, focused interfaces. Most common in UI |
| Analogous | 2-3 hues within ~30° | Warm, cohesive feels. Content-heavy UIs |
| Complementary | Two hues ~180° apart | Strong accent vs dominant. High energy. Use complement sparingly (10-20%) |
| Split-complementary | 1 hue + 2 adjacent to its complement (~150° and ~210°) | Vibrant but less tense. Dashboards, data-rich UIs |
| Triadic | 3 hues ~120° apart | Playful, colorful. One dominant, two subordinate |
| Tetradic | 4 hues forming a rectangle | Complex UIs with many categories. One color must dominate |

**60-30-10 rule**: ONE primary hue (60% — sets the mood), supporting hues (30%), accent (10%). This prevents visual chaos.

### Phase 2: Generate Variations — HSB Framework

The core principle for producing darker and lighter shades from a single base color:

**Darker variation** = brightness DOWN + saturation UP + hue shifts toward nearest luminosity minimum
**Lighter variation** = brightness UP + saturation DOWN + hue shifts toward nearest luminosity maximum

This mirrors physical light/shadow. Shadows are richer and more saturated, not just "color + black". Highlights are washed out and desaturated, not just "color + white".

**Why NOT opacity overlays**: adding semi-transparent black only reduces brightness without increasing saturation — result looks muddy and flat. Always modify saturation and brightness together.

**Hue shifting for natural variations**: the color wheel has 3 luminosity minima (red ~0°, green ~120°, blue ~240°) and 3 luminosity maxima (yellow ~60°, cyan ~180°, magenta ~300°). When making a darker shade, nudge hue 5-15° toward nearest minimum. When making a lighter tint, nudge toward nearest maximum. This makes scales feel alive rather than mechanical.

### Phase 3: Build the Palette with OKLCH

Use **OKLCH** (`oklch(L C H)`) — perceptually uniform, equal numeric steps produce equal visual steps. More predictable than HSL or hex.

- **L** (Lightness, 0-1): brightness adjustments
- **C** (Chroma, 0-0.4): saturation adjustments
- **H** (Hue, 0-360): hue angle

**Primary palette** (replace `H` with your chosen hue angle):

| Token | OKLCH | Usage |
|-------|-------|-------|
| 50 | `oklch(97% 0.01 H)` | Subtle background tints |
| 100 | `oklch(93% 0.03 H)` | Hover backgrounds, badges |
| 200 | `oklch(87% 0.06 H)` | Active backgrounds, borders |
| 300 | `oklch(78% 0.09 H)` | Decorative elements |
| 400 | `oklch(68% 0.12 H)` | Secondary text on light bg |
| 500 | `oklch(58% 0.15 H)` | **Base** — primary buttons, links, accents |
| 600 | `oklch(50% 0.16 H)` | Hover states on primary |
| 700 | `oklch(42% 0.14 H)` | Active/pressed states |
| 800 | `oklch(34% 0.12 H)` | Bold headings, strong emphasis |
| 900 | `oklch(25% 0.08 H)` | Near-black tinted text |

Note: chroma rises through mid-tones and falls at extremes — this is the HSB saturation curve translated to OKLCH. Exact values depend on the hue's natural luminosity: yellow needs wider brightness swings; blue and purple need narrower ones.

**Neutral palette — NEVER use pure gray**. Tint neutrals with a hint of the primary hue:

| Token | OKLCH | Usage |
|-------|-------|-------|
| 50 | `oklch(97% 0.005 H)` | Page background (light mode) |
| 100 | `oklch(93% 0.005 H)` | Card background (light mode) |
| 200 | `oklch(87% 0.008 H)` | Borders, dividers |
| 300 | `oklch(75% 0.008 H)` | Disabled state, placeholder |
| 400 | `oklch(60% 0.01 H)` | Secondary text |
| 500 | `oklch(45% 0.01 H)` | Body text |
| 600 | `oklch(35% 0.01 H)` | Headings |
| 700 | `oklch(27% 0.01 H)` | Strong emphasis |
| 800 | `oklch(20% 0.008 H)` | Card background (dark mode) |
| 900 | `oklch(13% 0.005 H)` | Page background (dark mode) |

### Semantic Colors

Success, error, warning, info are semantic — they communicate universal meaning and intentionally break the harmony scheme. Do NOT force them into your palette's hue range.

| Role | OKLCH | Hue | Usage |
|------|-------|-----|-------|
| Success | `oklch(65% 0.19 145)` | Green | Confirmations, positive states |
| Error | `oklch(58% 0.22 25)` | Red | Errors, destructive actions |
| Warning | `oklch(78% 0.16 75)` | Amber | Cautions, pending states |
| Info | `oklch(62% 0.15 250)` | Blue | Informational notices |

### Applying Color to the Interface

**Hierarchy of color application**:

| Layer | Proportion | Palette | Light mode | Dark mode |
|-------|-----------|---------|------------|-----------|
| Backgrounds & surfaces | 60% | Neutral | 50-100 | 900-800 |
| Supporting elements (borders, secondary buttons, icons, badges) | 30% | Primary | 100-300 | 700-600 |
| Accents & CTAs (primary buttons, links, active states, focus rings) | 10% | Primary | 500-700 | 400-500 |

**State variations** using the HSB framework:

| State | Token | Principle |
|-------|-------|-----------|
| Default | primary-500 | Base |
| Hover | primary-600 | Darker = lower brightness + higher saturation |
| Active/Pressed | primary-700 | Even darker |
| Focus ring | primary-300 with spread | Lighter, visible ring |
| Disabled | neutral-300 | Desaturated, lower contrast |

### Dark Mode

Invert the lightness scale, keep the same hue and similar chroma:

- Background surfaces: `900`/`800` values
- Text: `100`/`50` values
- Primary accent stays at `400`-`500` range (lighter than light mode to maintain contrast)
- Set `color-scheme: dark` on `<html>` (fixes native scrollbars, inputs)

### WCAG AA Contrast Minimums

| Element | Minimum Ratio |
|---------|---------------|
| Normal text (<18px bold, <24px regular) | 4.5:1 |
| Large text (>=18px bold or >=24px) | 3:1 |
| Interactive borders, icons, focus indicators | 3:1 |
| Decorative elements | No requirement |

Always test your palette with a contrast checker before shipping.

### Color Psychology Quick Reference

| Hue Range | Associations | Common UI Use |
|-----------|-------------|---------------|
| Red (0-15°) | Urgency, passion, danger | Errors, destructive actions, CTAs |
| Orange (15-45°) | Energy, warmth, friendliness | Notifications, highlights |
| Yellow (45-65°) | Optimism, attention, caution | Warnings, badges, accents |
| Green (65-170°) | Growth, success, nature | Success states, confirmations |
| Cyan (170-200°) | Clarity, freshness, tech | Links, info states |
| Blue (200-260°) | Trust, stability, calm | Primary brand, navigation |
| Purple (260-310°) | Creativity, luxury, mystery | Premium features, branding |
| Pink (310-350°) | Playfulness, warmth, care | Social, lifestyle, accent |

### Color Rules — Hard NOs

- **Never use pure black** (`#000`) for text or backgrounds — use tinted near-blacks from neutral-900.
- **Never use pure white** (`#fff`) for large areas — use neutral-50 with a subtle tint.
- **Never use pure gray** — always tint neutrals with a touch of your primary hue.
- **Never put saturated complementary colors side by side at equal size** — creates optical vibration.
- **Never rely on color alone** for meaning — always pair with icons, labels, or patterns.
- **Never use generic purple-blue gradients** — hallmark of AI-generated design.
- **Never put gray text on colored backgrounds** — use a darker shade of the background color instead.
- Max palette: 1 primary + 1 accent + 1 neutral family + 4 semantic colors. More than 5 non-neutral colors = too many.

### Verification Checklist

Before finalizing any color system, verify:

1. **Harmony**: hues relate through an identifiable scheme (complementary, analogous, etc.)?
2. **Variation integrity**: darker shades feel rich (not muddy)? Lighter tints feel airy (not washed out)?
3. **Hierarchy**: color guides attention? Primary CTA is the most prominent colored element?
4. **Consistency**: same color = same meaning everywhere?
5. **Accessibility**: all text/background combinations pass WCAG AA minimum?
6. **Dark mode**: palette works inverted? Accent still pops?

---

## 4. Layout Patterns

### Content Width

| Type | Max Width | Tailwind | Rationale |
|------|-----------|----------|-----------|
| Reading text | 65ch (~640px) | max-w-prose | Optimal line length |
| Web app / dashboard | 1280px | max-w-screen-xl | Standard app container |
| Landing page | Full width | w-full | Sections self-contain |
| Form | 480-560px | max-w-lg / max-w-xl | Comfortable input width |

### Responsive Breakpoints

| Breakpoint | Width | Columns | Side Padding | Gap |
|------------|-------|---------|--------------|-----|
| Mobile | <640px | 1 | 16px (px-4) | 16px |
| Tablet | 640-1023px | 2 | 24px (px-6) | 16-24px |
| Desktop | >=1024px | 3-4 or sidebar+content | 32px (px-8) | 24px |
| Wide | >=1280px | Same as desktop | 32-64px | 24-32px |

### Common Layouts

- **Sidebar + content**: sidebar 240-280px fixed width, content area fluid.
- **Card grid**: `grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))]`.
- **Holy grail**: fixed header (h-16) + sidebar (w-64) + main content + footer.
- **Stack**: single-column centered content — forms, auth pages, settings.

### Responsive Rules

- Change LAYOUT between breakpoints, not just padding. Mobile=vertical stack, Desktop=multi-column.
- Mobile: bottom navigation, hamburger menu, full-width cards.
- Desktop: sidebar navigation, top nav, multi-column grids.
- Use `env(safe-area-inset-*)` for full-bleed layouts on notched devices.
- Prevent horizontal scroll: `overflow-x-hidden` on body or main container.
- Prefer CSS Grid/Flexbox over JS-based layout measurement.

---

## 5. Interactive Components

### Buttons

| Variant | Style | When |
|---------|-------|------|
| Primary (filled) | bg-primary-500 text-white | Main action per section |
| Secondary (outlined) | border border-primary-500 text-primary-500 | Alternative actions |
| Ghost (text) | text-primary-500, no border/bg | Tertiary, cancel, "learn more" |

| Size | Height | Text | Horizontal Padding |
|------|--------|------|-------------------|
| sm | 32px (h-8) | text-sm (14px) | px-3 (12px) |
| md | 40px (h-10) | text-base (16px) | px-4 (16px) |
| lg | 48px (h-12) | text-lg (18px) | px-6 (24px) |

Rule: horizontal padding = 3x vertical padding for visual balance.
Rule: button height = input height (form row consistency).

### Inputs

- Height: 40px default (h-10), matching button md.
- Label: ABOVE input, always visible. Never use placeholder as the only label.
- Placeholder: example pattern ending with ellipsis (e.g., "Enter email...").
- Border: 1px neutral-300 default. Focus: 2px primary-500 ring.
- Error: message below input in error color, with optional icon prefix.
- Use semantic `type` (email, tel, url, number) and `inputmode` attributes.
- Use `autocomplete` with meaningful values. Never block paste.
- Validate on blur, not on every keystroke.

### Cards

- Border radius: 8px (rounded-lg) modern, 4px (rounded) corporate, 12-16px (rounded-xl/2xl) playful. Pick ONE and use consistently.
- Shadow: shadow-sm or shadow for subtle elevation. Do not mix shadow levels arbitrarily.
- Internal padding: 16-24px (p-4 to p-6).

### Required States for ALL Interactive Elements

| State | Visual Change | CSS |
|-------|---------------|-----|
| :hover | Color shift, shadow lift, or subtle translate | `hover:bg-primary-600`, `hover:shadow-md` |
| :focus-visible | Ring indicator for keyboard nav | `focus-visible:ring-2 ring-offset-2 ring-primary-500` |
| :active | Immediate press feedback | `active:scale-[0.98]` or `active:bg-primary-700` |
| :disabled | Dimmed, non-interactive | `disabled:opacity-50 disabled:cursor-not-allowed` |

- Transition: `transition-colors duration-150` or `transition-all duration-200`.
- NEVER use `transition: all` — explicitly list properties.
- Use `<button>` for actions, `<a>` for navigation. Never `<div onClick>`.
- Submit button stays enabled until request fires — show spinner during loading.

---

## 6. Micro-interactions and Transitions

### Timing

| Action | Duration | Easing |
|--------|----------|--------|
| Hover/focus state change | 150ms | ease-out |
| Color/opacity transition | 200ms | ease-out |
| Dropdown/menu open | 200ms | ease-out |
| Dropdown/menu close | 150ms | ease-in |
| Modal/drawer open | 300ms | ease-out (or spring) |
| Modal/drawer close | 200ms | ease-in |
| Page transition | 300ms | ease-in-out |
| Tooltip appear | 100ms delay + 150ms fade | ease-out |

### Rules

- Honor `prefers-reduced-motion`: disable or simplify all animations.
- Animate only `transform` and `opacity` (GPU-composited). Avoid animating width, height, top, left.
- Set `transform-origin` correctly for scale/rotate animations.
- All animations must be interruptible — user action cancels in-progress animation.
- No animation should exceed 500ms — it feels sluggish.

### Loading States

| Pattern | When |
|---------|------|
| Skeleton (animate-pulse, bg-neutral-200) | Page load, content areas, cards |
| Spinner | User-triggered actions (submit, save, delete) |
| Progress bar | Operations with known duration (upload, export) |
| Inline loading text with ellipsis | Background processes |

Never use a spinner for initial page load — use skeletons instead.

### Feedback Patterns

- **Toast/notification**: completed actions, non-blocking confirmations. Auto-dismiss 3-5s.
- **Inline validation**: form errors shown below field on blur. First error focused on submit.
- **Optimistic UI**: update interface before server confirms, roll back on failure.
- **Destructive actions**: require confirmation modal OR provide undo window (5-10s).
- Handle empty states explicitly — never show broken/blank UI for empty data.

---

## 7. Accessibility (A11y)

### ARIA

- Every `<input>` has a visible `<label>` (via `htmlFor`) or `aria-label`.
- Every icon-only button has `aria-label` describing the action.
- Decorative icons: `aria-hidden="true"`.
- Dynamic content updates: `aria-live="polite"` on the container.
- Custom components use correct roles: `role="button"`, `role="dialog"`, `role="tablist"`, etc.
- Prefer semantic HTML (`<nav>`, `<main>`, `<aside>`, `<section>`) before adding ARIA roles.
- Headings are hierarchical (h1-h6), never skip levels. Add skip-link to main content.

### Keyboard Navigation

- Logical tab order via DOM order. Never use `tabindex` > 0.
- `Escape` closes modal, dropdown, popover.
- `Enter` / `Space` activates buttons.
- Arrow keys navigate within menus, lists, tabs, radio groups.
- Focus trap in modals — tab cycles within the dialog until dismissed.
- All interactive elements have visible `:focus-visible` styles. Never `outline: none` without replacement.
- Use `:focus-within` for compound control groups.

### Touch

- Minimum touch target: 44x44px on mobile.
- Apply `touch-action: manipulation` to prevent double-tap zoom delay.
- Use `overscroll-behavior: contain` inside modals and drawers.

### Images and Media

- All `<img>` require `alt` text (or `alt=""` if purely decorative).
- All `<img>` require explicit `width` and `height` to prevent layout shift.
- Below-fold images: `loading="lazy"`. Hero images: `fetchpriority="high"`.

### Performance and Accessibility Intersection

- Lists >50 items: virtualize (react-window, @tanstack/virtual).
- Preconnect to CDN/font domains: `<link rel="preconnect">`.
- Critical fonts: `<link rel="preload" as="font">` with `font-display: swap`.

---

## 8. Anti-patterns Checklist

Use this checklist during design review and code review. Every item is a hard NO.

### Visual
- [ ] Light gray text on white background (contrast < 4.5:1)
- [ ] More than 3 font weights on the same page
- [ ] Random colors not derived from the design system
- [ ] Pure gray (#808080) instead of tinted neutral
- [ ] Inconsistent border-radius across components
- [ ] More than 5 non-neutral colors in the palette

### Interaction
- [ ] Button without :hover state
- [ ] Interactive element without :focus-visible style
- [ ] Form input with placeholder as only label
- [ ] Form without inline validation feedback
- [ ] Menu/dropdown without keyboard navigation
- [ ] Modal without focus trap
- [ ] Destructive action without confirmation or undo
- [ ] `<div>` or `<span>` with onClick instead of `<button>`

### Layout
- [ ] Horizontal scroll on mobile (except explicit carousels)
- [ ] Identical layout on mobile and desktop (responsive != fluid-only)
- [ ] Content wider than viewport causing overflow
- [ ] Images without explicit width/height (causes layout shift)
- [ ] Empty state not handled (blank screen for empty data)

### Performance
- [ ] Animation lasting >500ms
- [ ] `transition: all` instead of explicit property list
- [ ] Animating layout properties (width, height, top, left)
- [ ] Large list rendered without virtualization (>50 items)
- [ ] `prefers-reduced-motion` not honored

### Accessibility
- [ ] Color as the only indicator of state or meaning
- [ ] Missing `aria-label` on icon-only buttons
- [ ] Missing `alt` text on images
- [ ] `tabindex` > 0 used anywhere
- [ ] `outline: none` without focus-visible replacement
- [ ] `user-scalable=no` or `maximum-scale=1` blocking zoom
- [ ] Touch targets smaller than 44x44px
- [ ] `onPaste` with `preventDefault` blocking paste

### Copy
- [ ] Vague button labels ("Click here", "Submit")
- [ ] Error messages without actionable next step
- [ ] Loading states without ellipsis or indicator
- [ ] Hardcoded date/number formats instead of `Intl` APIs

# Design

## Visual Direction

Paraggi is a restrained mobile product UI: civic, local, calm, and fast to read outdoors. The interface should feel like a trustworthy local instrument, not a social network stage.

## Color Tokens

Use OKLCH color values.

```css
:root {
  --color-bg: oklch(1 0 0);
  --color-surface: oklch(0.972 0.006 188);
  --color-surface-raised: oklch(0.995 0 0);
  --color-ink: oklch(0.205 0.018 210);
  --color-muted: oklch(0.475 0.025 210);
  --color-border: oklch(0.895 0.012 200);
  --color-primary: oklch(0.58 0.118 188);
  --color-primary-strong: oklch(0.44 0.105 188);
  --color-primary-soft: oklch(0.93 0.04 188);
  --color-accent: oklch(0.57 0.15 31);
  --color-danger: oklch(0.55 0.17 24);
  --color-warning: oklch(0.73 0.15 78);
  --color-success: oklch(0.56 0.13 154);
  --color-info: oklch(0.58 0.12 242);
}

.dark {
  --color-bg: oklch(0.105 0 0);
  --color-surface: oklch(0.16 0.012 210);
  --color-surface-raised: oklch(0.205 0.014 210);
  --color-ink: oklch(0.945 0.004 210);
  --color-muted: oklch(0.72 0.018 210);
  --color-border: oklch(0.285 0.014 210);
  --color-primary: oklch(0.72 0.1 188);
  --color-primary-strong: oklch(0.8 0.09 188);
  --color-primary-soft: oklch(0.24 0.045 188);
  --color-accent: oklch(0.68 0.14 31);
  --color-danger: oklch(0.68 0.15 24);
  --color-warning: oklch(0.78 0.13 78);
  --color-success: oklch(0.72 0.11 154);
  --color-info: oklch(0.72 0.1 242);
}
```

## Typography

- Family: system UI stack, matching native platform expectations.
- Product scale: compact, fixed rem sizes.
- Body copy: 16px default, 20-24px section headings, 28px onboarding title.
- Avoid decorative display type in controls.

## Components

- Buttons: consistent 8px radius, clear loading/disabled states.
- Cards/list items: radius max 8px, no nested cards.
- Feed items: dense, scannable, with category, area, approximate distance and expiry.
- Chat state banner: always visible when frozen.
- Permission prompts: inline product states, not blocking modals by default.
- Heatmap: aggregate zones only, no precise user markers.

## Motion

- 150-220 ms transitions.
- Motion communicates state changes: chat frozen/reactivated, sync complete, request accepted.
- Respect reduced motion.

## Accessibility

- WCAG 2.2 AA minimum.
- Do not rely on color alone for status.
- Use labels for icon buttons.
- Ensure all primary touch targets are at least 44x44 logical pixels.

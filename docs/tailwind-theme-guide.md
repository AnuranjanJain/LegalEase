# Tailwind CSS Theme Extensions Guide

This document describes the custom Tailwind CSS theme values defined in `tailwind.config.js`. These extensions provide semantic color tokens, custom fonts, animations, and layout utilities specific to LegalEase.

## Table of Contents

- [Colors](#colors)
  - [Primary (Blue)](#primary-blue)
  - [Success (Green)](#success-green)
  - [Warning (Yellow)](#warning-yellow)
  - [Error (Red)](#error-red)
  - [Info (Sky Blue)](#info-sky-blue)
  - [Background](#background)
- [Typography](#typography)
- [Animations](#animations)
- [Container](#container)
- [Dark Mode](#dark-mode)
- [Safelist](#safelist)
- [Usage Examples](#usage-examples)

---

## Colors

LegalEase defines five semantic color palettes plus a background palette. Each palette includes a `DEFAULT` shade and 10 tonal variants (50–950) following Tailwind's standard scale.

### Primary (Blue)

The primary brand color used for buttons, links, and key interactive elements.

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#2563EB` | Default primary actions, links |
| `primary-50` | `#eff6ff` | Light backgrounds, hover states |
| `primary-100` | `#dbeafe` | Subtle backgrounds |
| `primary-200` | `#bfdbfe` | Borders, dividers |
| `primary-300` | `#93c5fd` | Icons, secondary text |
| `primary-400` | `#60a5fa` | Hover states |
| `primary-500` | `#3b82f6` | Active states |
| `primary-600` | `#2563eb` | Primary buttons, CTAs |
| `primary-700` | `#1d4ed8` | Button hover states |
| `primary-800` | `#1e40af` | Dark accents |
| `primary-900` | `#1e3a8a` | Headings, emphasis |
| `primary-950` | `#172554` | Deep dark accents |

```jsx
// Example usage
<button className="bg-primary hover:bg-primary-700 text-white">
  Analyze Document
</button>
<a className="text-primary-600 hover:text-primary-800">Learn more</a>
```

### Success (Green)

Used for positive states, confirmations, and successful operations.

| Token | Hex | Usage |
|-------|-----|-------|
| `success` | `#16A34A` | Default success indicators |
| `success-50` | `#f0fdf4` | Success message backgrounds |
| `success-100` | `#dcfce7` | Subtle success backgrounds |
| `success-500` | `#22c55e` | Success icons, checkmarks |
| `success-600` | `#16a34a` | Success buttons |
| `success-700` | `#15803d` | Success button hover |

```jsx
<div className="bg-success-50 border-success-200 text-success-700">
  Document analyzed successfully
</div>
```

### Warning (Yellow)

Used for caution states, pending actions, and attention-required indicators.

| Token | Hex | Usage |
|-------|-----|-------|
| `warning` | `#CA8A04` | Default warning indicators |
| `warning-50` | `#fefce8` | Warning message backgrounds |
| `warning-100` | `#fef9c3` | Subtle warning backgrounds |
| `warning-500` | `#eab308` | Warning icons |
| `warning-600` | `#ca8a04` | Warning buttons |

```jsx
<div className="bg-warning-50 border-warning-200 text-warning-700">
  Review recommended — some clauses may need attention
</div>
```

### Error (Red)

Used for error states, destructive actions, and critical alerts.

| Token | Hex | Usage |
|-------|-----|-------|
| `error` | `#DC2626` | Default error indicators |
| `error-50` | `#fef2f2` | Error message backgrounds |
| `error-100` | `#fee2e2` | Subtle error backgrounds |
| `error-500` | `#ef4444` | Error icons, validation |
| `error-600` | `#dc2626` | Error buttons |

```jsx
<div className="bg-error-50 border-error-200 text-error-700">
  Analysis failed — please try again
</div>
<button className="bg-error hover:bg-error-700 text-white">
  Delete Document
</button>
```

### Info (Sky Blue)

Used for informational states, tips, and neutral alerts.

| Token | Hex | Usage |
|-------|-----|-------|
| `info` | `#0EA5E9` | Default info indicators |
| `info-50` | `#f0f9ff` | Info message backgrounds |
| `info-100` | `#e0f2fe` | Subtle info backgrounds |
| `info-500` | `#0ea5e9` | Info icons |
| `info-600` | `#0284c7` | Info buttons |

```jsx
<div className="bg-info-50 border-info-200 text-info-700">
  Tip: Upload PDF or DOCX files for best results
</div>
```

### Background

Custom background colors for light and dark themes.

| Token | Hex | Usage |
|-------|-----|-------|
| `background-light` | `#F3F4F6` | Light mode page background |
| `background-dark` | `#111827` | Dark mode page background |

```jsx
<div className="bg-background-light dark:bg-background-dark">
  Page content
</div>
```

---

## Typography

### Display Font

The `font-display` utility uses Inter as the primary typeface.

| Token | Font Stack | Usage |
|-------|-----------|-------|
| `font-display` | `['Inter', 'sans-serif']` | Headings, hero text, feature titles |

```jsx
<h1 className="font-display text-4xl font-bold">
  AI-Powered Legal Analysis
</h1>
```

---

## Animations

### Custom Animations

| Token | Duration | Effect | Usage |
|-------|----------|--------|-------|
| `animate-slide-up` | `0.2s` | Slide up + fade in | Toast notifications, modals, cards |
| `animate-spin-slow` | `3s` | Slow rotation | Loading spinners, decorative elements |

### Keyframes

#### `slideUp`

Animates elements from 10px below their final position with 0 opacity to their final position with full opacity.

```
0%   → translateY(10px), opacity: 0
100% → translateY(0), opacity: 1
```

```jsx
// Toast notification
<div className="animate-slide-up">
  Analysis complete!
</div>

// Slow spinner for loading states
<Loader2 className="animate-spin-slow h-6 w-6" />
```

---

## Container

The container is centered with responsive padding and custom breakpoints.

### Padding

| Breakpoint | Padding |
|------------|---------|
| Default | `1rem` |
| `sm` (640px) | `1.5rem` |
| `lg` (1024px) | `2rem` |
| `xl` (1280px) | `2.5rem` |
| `2xl` (1400px) | `3rem` |

### Screens

| Token | Width |
|-------|-------|
| `sm` | `640px` |
| `md` | `768px` |
| `lg` | `1024px` |
| `xl` | `1280px` |
| `2xl` | `1400px` |

Note: The `2xl` breakpoint is set to `1400px` (Tailwind default is `1536px`).

```jsx
<div className="container mx-auto">
  {/* Content is automatically centered with responsive padding */}
</div>
```

---

## Dark Mode

Dark mode is enabled via the `class` strategy. Toggle by adding/removing the `dark` class on the `<html>` element.

```jsx
// Toggle dark mode
<html class="dark">
  {/* Dark mode styles active */}
</html>

// Usage in components
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Themed content
</div>

// Using custom background tokens
<main className="bg-background-light dark:bg-background-dark">
  Page content
</main>
```

### Implementation

The dark mode toggle in LegalEase reads from `localStorage` and applies the class before first paint to prevent flash of incorrect theme (FICT).

---

## Safelist

The safelist ensures that dynamically constructed class names are included in the build. The pattern matches background, text, and border utilities for common colors:

```
/(bg|text|border)-(red|green|blue|yellow|gray|purple|indigo)-(100|200|300|400|500|600|700)/
```

This is needed because some classes are constructed at runtime (e.g., for dynamic severity indicators) and would otherwise be purged by Tailwind's tree-shaking.

---

## Usage Examples

### Alert Component

```jsx
function Alert({ type = 'info', children }) {
  const styles = {
    info: 'bg-info-50 border-info-200 text-info-700',
    success: 'bg-success-50 border-success-200 text-success-700',
    warning: 'bg-warning-50 border-warning-200 text-warning-700',
    error: 'bg-error-50 border-error-200 text-error-700',
  };

  return (
    <div className={`border rounded-lg p-4 animate-slide-up ${styles[type]}`}>
      {children}
    </div>
  );
}

// Usage
<Alert type="success">Document analyzed successfully</Alert>
<Alert type="warning">Some clauses may need review</Alert>
```

### Primary Button

```jsx
function Button({ variant = 'primary', children, ...props }) {
  const variants = {
    primary: 'bg-primary hover:bg-primary-700 focus:ring-primary-300',
    success: 'bg-success hover:bg-success-700 focus:ring-success-300',
    error: 'bg-error hover:bg-error-700 focus:ring-error-300',
  };

  return (
    <button
      className={`px-4 py-2 text-white rounded-lg focus:ring-2 transition-colors ${variants[variant]}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

### Themed Card

```jsx
<div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
  <h3 className="font-display text-lg font-semibold text-gray-900 dark:text-white">
    Analysis Results
  </h3>
  <p className="mt-2 text-gray-600 dark:text-gray-300">
    Your document has been analyzed...
  </p>
</div>
```

---

## Quick Reference

| Category | Classes |
|----------|---------|
| Primary actions | `bg-primary`, `text-primary-600`, `border-primary-200` |
| Success states | `bg-success-50`, `text-success-700`, `border-success-200` |
| Warning states | `bg-warning-50`, `text-warning-700`, `border-warning-200` |
| Error states | `bg-error-50`, `text-error-700`, `border-error-200` |
| Info states | `bg-info-50`, `text-info-700`, `border-info-200` |
| Dark backgrounds | `bg-background-dark` |
| Light backgrounds | `bg-background-light` |
| Display font | `font-display` |
| Slide up animation | `animate-slide-up` |
| Slow spin | `animate-spin-slow` |

# Template Creation Guide

This guide shows developers how to create new custom templates for the Baci e-commerce platform.

## Table of Contents
1. [Quick Start](#quick-start)
2. [Template Anatomy](#template-anatomy)
3. [Step-by-Step Tutorial](#step-by-step-tutorial)
4. [Using Themed Components](#using-themed-components)
5. [Advanced Techniques](#advanced-techniques)
6. [Best Practices](#best-practices)

---

## Quick Start

Creating a new template takes **5 minutes**:

1. Create template component in `/src/templates/`
2. Register in `/src/config/business-types.ts`
3. Add custom styles in `/src/app/globals.css` (optional)
4. Test with different business types

---

## Template Anatomy

A template is a React component that wraps storefront content with custom layouts and styling.

### Minimal Template

```tsx
// /src/templates/my-template.tsx
export function MyTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="template-my-custom">
      {children}
    </div>
  );
}
```

### Template with Layout

```tsx
// /src/templates/my-template.tsx
export function MyTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="template-my-custom">
      {/* Custom header decoration */}
      <div className="bg-gradient-to-b from-[var(--store-primary)] to-transparent h-32 -mb-32" />

      {/* Main content */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Custom footer decoration */}
      <div className="mt-8 border-t-2 border-[var(--store-accent)]" />
    </div>
  );
}
```

---

## Step-by-Step Tutorial

### Step 1: Create Template File

Create a new file in `/src/templates/`:

```tsx
// /src/templates/luxury.tsx
export function LuxuryTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="template-luxury">
      {/* Gold accent bar at top */}
      <div className="h-1 bg-gradient-to-r from-transparent via-[var(--store-accent)] to-transparent" />

      {/* Content with elegant spacing */}
      <div className="px-8 max-w-7xl mx-auto">
        {children}
      </div>

      {/* Elegant footer spacing */}
      <div className="h-16" />
    </div>
  );
}
```

### Step 2: Add Custom Styles (Optional)

In `/src/app/globals.css`, add template-specific styles:

```css
/* Luxury template styles */
.template-luxury {
  font-family: 'Playfair Display', serif; /* Elegant serif font */
}

.template-luxury h1,
.template-luxury h2 {
  letter-spacing: 0.05em; /* Wider letter spacing */
  font-weight: 300; /* Lighter weight */
}

.template-luxury .card {
  backdrop-filter: blur(10px); /* Frosted glass effect */
}
```

### Step 3: Register Template

In `/src/config/business-types.ts`, import and assign to a business type:

```tsx
import { LuxuryTemplate } from '@/templates/luxury';

export const BUSINESS_TYPES = {
  // ... existing types ...

  JEWELRY: {
    id: 'jewelry',
    label: 'Jewelry & Accessories',
    description: 'Fine jewelry and luxury accessories',
    aiPromptContext: 'luxury jewelry and high-end accessories',
    template: LuxuryTemplate, // 👈 Assign your template here
    icon: Sparkles,
    journey: {
      onboarding: {
        logoStyle: 'elegant, luxurious, sophisticated',
        colorScheme: 'gold, silver, rich jewel tones',
      },
      productCreation: {
        aiDescriptionStyle: 'luxury-focused, emphasizes craftsmanship and exclusivity',
        imageRequirements: 'High-quality shots with elegant backgrounds',
      },
    },
  },
};
```

### Step 4: Test Your Template

1. Start dev server: `npm run dev`
2. Go to onboarding: `http://localhost:3000/onboarding`
3. Select your business type (e.g., "Jewelry & Accessories")
4. Complete onboarding
5. View your storefront with the new template!

---

## Using Themed Components

Your template automatically has access to merchant brand colors via CSS variables. Use themed components for consistent branding:

### Available Themed Components

```tsx
import {
  ThemedButton,
  ThemedCard,
  ThemedBadge,
  ThemedLink
} from '@/components/themed';

export function MyTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {/* Header with themed elements */}
      <header className="p-4 border-b-4 border-b-[var(--store-primary)]">
        <ThemedLink href="/about" colorRole="primary">
          About Us
        </ThemedLink>
      </header>

      {/* Main content */}
      {children}

      {/* Footer with CTA */}
      <footer className="p-8 text-center">
        <ThemedButton colorRole="accent" size="lg">
          Shop Now
        </ThemedButton>
      </footer>
    </div>
  );
}
```

### CSS Custom Properties

Access brand colors directly in styles:

```tsx
<div
  style={{
    backgroundColor: 'var(--store-primary)',
    borderColor: 'var(--store-accent)',
  }}
>
  {/* Branded content */}
</div>
```

Or in Tailwind classes:

```tsx
<div className="bg-[var(--store-primary)] border-[var(--store-accent)]">
  {/* Branded content */}
</div>
```

### Available Color Variables

- `--store-primary` - Main brand color (for headers, branding)
- `--store-secondary` - Supporting color (for text, backgrounds)
- `--store-accent` - Attention color (for CTAs, highlights)

---

## Advanced Techniques

### 1. Conditional Layouts

Different layouts based on content or state:

```tsx
export function AdaptiveTemplate({ children }: { children: React.ReactNode }) {
  const isFeatured = useFeaturedCheck(); // Custom hook

  return (
    <div className={isFeatured ? 'template-featured' : 'template-standard'}>
      {isFeatured && (
        <div className="banner bg-[var(--store-accent)]">
          Featured Collection
        </div>
      )}
      {children}
    </div>
  );
}
```

### 2. Template-Specific Animations

```css
/* In globals.css */
.template-dynamic {
  --animation-speed: 0.3s;
}

.template-dynamic .card {
  transition: transform var(--animation-speed) ease;
}

.template-dynamic .card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(var(--store-primary-rgb), 0.2);
}
```

### 3. Responsive Layouts

```tsx
export function ResponsiveTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="template-responsive">
      {/* Mobile: Stack layout */}
      <div className="md:hidden">
        {children}
      </div>

      {/* Desktop: Grid layout with sidebar */}
      <div className="hidden md:grid md:grid-cols-[250px_1fr] gap-8">
        <aside className="border-r-2 border-[var(--store-primary)]">
          {/* Sidebar content */}
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
```

### 4. Template Context

Share data between template and children:

```tsx
import { createContext, useContext } from 'react';

const TemplateContext = createContext({ theme: 'default' });

export function ContextTemplate({ children }: { children: React.ReactNode }) {
  return (
    <TemplateContext.Provider value={{ theme: 'modern' }}>
      <div className="template-context">
        {children}
      </div>
    </TemplateContext.Provider>
  );
}

export function useTemplateTheme() {
  return useContext(TemplateContext);
}
```

---

## Best Practices

### ✅ DO

1. **Keep templates simple** - Focus on layout and spacing
2. **Use CSS variables** - Let merchant colors drive the design
3. **Make it responsive** - Test on mobile, tablet, desktop
4. **Use themed components** - Leverage existing component library
5. **Add subtle branding** - Accents, borders, gradients using brand colors
6. **Document your template** - Add comments explaining special features
7. **Test with different colors** - Try with various brand color combinations

### ❌ DON'T

1. **Don't hardcode colors** - Always use CSS variables or themed components
2. **Don't override content structure** - Template wraps, doesn't replace
3. **Don't add heavy JavaScript** - Keep templates lightweight
4. **Don't break accessibility** - Maintain proper contrast and semantics
5. **Don't forget mobile** - Always test responsive behavior
6. **Don't use fixed dimensions** - Use flexible layouts
7. **Don't add business logic** - Templates are for presentation only

---

## Testing Checklist

Before publishing your template:

- [ ] Test with all 6 default business types
- [ ] Test with different logo colors (light, dark, vibrant, muted)
- [ ] Test on mobile (320px, 375px, 768px)
- [ ] Test on tablet (768px, 1024px)
- [ ] Test on desktop (1280px, 1920px)
- [ ] Verify color contrast meets WCAG AA standards
- [ ] Check loading performance (LCP < 2.5s)
- [ ] Verify no console errors or warnings
- [ ] Test with long product names
- [ ] Test with many products (20+)
- [ ] Test with few products (1-3)

---

## Example Templates

### Minimalist Template

```tsx
// /src/templates/minimalist.tsx
export function MinimalistTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="template-minimalist max-w-6xl mx-auto">
      {/* Subtle top border */}
      <div className="h-px bg-[var(--store-primary)]" />

      {/* Clean spacing */}
      <div className="py-8">
        {children}
      </div>

      {/* Bottom accent */}
      <div className="mt-16 h-px bg-gradient-to-r from-transparent via-[var(--store-secondary)] to-transparent" />
    </div>
  );
}
```

### Bold Template

```tsx
// /src/templates/bold.tsx
export function BoldTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="template-bold">
      {/* Bold header bar */}
      <div className="h-8 bg-[var(--store-primary)] shadow-lg" />

      {/* High contrast content */}
      <div className="bg-black text-white">
        {children}
      </div>

      {/* Bold footer */}
      <div className="h-16 bg-[var(--store-accent)]" />
    </div>
  );
}
```

### Organic Template

```tsx
// /src/templates/organic.tsx
export function OrganicTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="template-organic">
      {/* Wavy top decoration */}
      <svg className="w-full h-24" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path
          d="M0,60 Q300,0 600,60 T1200,60 L1200,120 L0,120 Z"
          fill="var(--store-primary)"
          opacity="0.1"
        />
      </svg>

      {/* Content with organic shapes */}
      <div className="px-4">
        {children}
      </div>

      {/* Wavy bottom decoration */}
      <svg className="w-full h-24" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path
          d="M0,60 Q300,120 600,60 T1200,60 L1200,0 L0,0 Z"
          fill="var(--store-secondary)"
          opacity="0.1"
        />
      </svg>
    </div>
  );
}
```

---

## Troubleshooting

### Template not showing

1. Check template is imported in `/src/config/business-types.ts`
2. Verify business type assignment is correct
3. Clear browser cache and restart dev server

### Colors not applying

1. Ensure CSS variables are set at parent level (`<main>` in `page.tsx`)
2. Check merchant has completed onboarding with logo/colors
3. Verify using `var(--store-primary)` syntax, not just `--store-primary`

### Layout breaking on mobile

1. Add responsive classes: `sm:`, `md:`, `lg:` prefixes
2. Test with Chrome DevTools mobile emulation
3. Use `max-w-` classes to prevent overflow

### Performance issues

1. Remove heavy animations or complex SVGs
2. Use `loading="lazy"` on images
3. Minimize JavaScript in template

---

## Resources

- [Theming Architecture](./THEMING_ARCHITECTURE.md) - Deep dive into color system
- [Business Types Config](../src/config/business-types.ts) - All business type definitions
- [Themed Components](../src/components/themed/) - Component library
- [Tailwind CSS Docs](https://tailwindcss.com/docs) - Utility classes
- [shadcn/ui](https://ui.shadcn.com/) - Base component library

---

## Get Help

Questions? Issues? Improvements?

1. Check existing templates in `/src/templates/` for examples
2. Read the [Theming Architecture](./THEMING_ARCHITECTURE.md) guide
3. Review [business-types.ts](../src/config/business-types.ts) for configuration
4. Open an issue with the `template` label

---

**Happy templating! 🎨**

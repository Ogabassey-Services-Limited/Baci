
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

1. Create a new template component in `/src/templates/`.
2. Register it in `/src/config/business-types.ts`.
3. Add any optional, template-specific styles to `/src/app/globals.css`.
4. Test with different business types and brand colors.

---

## Template Anatomy

A template is a React component that wraps the main storefront content (`children`) with custom layouts, styles, and decorative elements.

### Minimal Template

```tsx
// /src/templates/my-template.tsx
export function MyTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="template-my-custom">
      {/* The main content of the storefront will be rendered here */}
      {children}
    </div>
  );
}
```

### Template with Custom Layout

```tsx
// /src/templates/my-template.tsx
export function MyTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="template-my-custom">
      {/* Custom header decoration using the merchant's primary color */}
      <div className="bg-gradient-to-b from-[var(--store-primary)] to-transparent h-32 -mb-32" />

      {/* Main content with relative positioning to appear above decoration */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Custom footer decoration using the merchant's accent color */}
      <div className="mt-8 border-t-2 border-[var(--store-accent)]" />
    </div>
  );
}
```

---

## Step-by-Step Tutorial

### Step 1: Create Template File

Create a new file in `/src/templates/`, for example `luxury.tsx`.

```tsx
// /src/templates/luxury.tsx
export function LuxuryTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="template-luxury">
      {/* A gold-like accent bar at the top */}
      <div className="h-1 bg-gradient-to-r from-transparent via-[var(--store-accent)] to-transparent" />

      {/* Content with elegant horizontal spacing */}
      <div className="px-8 max-w-7xl mx-auto">
        {children}
      </div>

      {/* Add some elegant spacing at the bottom */}
      <div className="h-16" />
    </div>
  );
}
```

### Step 2: Add Custom Styles (Optional)

In `/src/app/globals.css`, you can add styles that are specific to your new template.

```css
/* In: src/app/globals.css */

/* Luxury template styles */
.template-luxury {
  font-family: 'Playfair Display', serif; /* Use an elegant serif font */
}

.template-luxury h1,
.template-luxury h2 {
  letter-spacing: 0.05em; /* Add wider letter spacing for headings */
  font-weight: 300; /* Use a lighter font weight */
}

.template-luxury .card {
  backdrop-filter: blur(10px); /* Add a frosted glass effect to cards */
}
```

### Step 3: Register Your Template

In `/src/config/business-types.ts`, import your new template and assign it to a business type.

```tsx
// In: /src/config/business-types.ts
import { LuxuryTemplate } from '@/templates/luxury';
import { Sparkles } from 'lucide-react'; // Assuming you add a Jewelry icon

export const BUSINESS_TYPES = {
  // ... other existing types ...

  JEWELRY: {
    id: 'jewelry',
    label: 'Jewelry & Accessories',
    description: 'Fine jewelry and luxury accessories',
    aiPromptContext: 'luxury jewelry and high-end accessories',
    template: LuxuryTemplate, // 👈 Assign your new template here
    icon: Sparkles,
    journey: {
      onboarding: {
        logoStyle: 'elegant, luxurious, sophisticated, minimalist',
        colorScheme: 'gold, silver, rich jewel tones, deep blues',
      },
      productCreation: {
        aiDescriptionStyle: 'luxury-focused, emphasizing craftsmanship, exclusivity, and materials',
        imageRequirements: 'High-quality, professional shots with elegant, minimalist backgrounds',
      },
    },
  },
};
```

### Step 4: Test Your Template

1.  Start the development server: `pnpm turbo dev`.
2.  Navigate to the onboarding page: `http://localhost:3000/onboarding`.
3.  Select the business type you assigned the template to (e.g., "Jewelry & Accessories").
4.  Complete the onboarding process.
5.  You will be redirected to your storefront, which will now be rendered using your new `LuxuryTemplate`!

---

## Using Themed Components

Your template automatically has access to the merchant's brand colors via CSS variables. You should use our pre-built themed components to ensure brand consistency.

### Available Themed Components

Import any themed component from `@/components/themed`.

```tsx
import {
  ThemedButton,
  ThemedCard,
  ThemedBadge,
  ThemedLink,
  ThemedInput
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

      {/* Footer with a strong call-to-action */}
      <footer className="p-8 text-center">
        <ThemedButton colorRole="accent" size="lg">
          Shop The Collection
        </ThemedButton>
      </footer>
    </div>
  );
}
```

### Available CSS Color Variables

You can access the brand colors directly in your styles or Tailwind classes.

-   `--store-primary`: The main brand color (for headers, branding).
-   `--store-secondary`: A supporting brand color.
-   `--store-accent`: The call-to-action or highlight color.
-   `--store-primary-text`: A contrast-safe text color for use on primary backgrounds.
-   `--store-secondary-text`: A contrast-safe text color for use on secondary backgrounds.
-   `--store-accent-text`: A contrast-safe text color for use on accent backgrounds.

```tsx
<div
  style={{
    backgroundColor: 'var(--store-primary)',
    color: 'var(--store-primary-text)',
    borderColor: 'var(--store-accent)',
  }}
>
  Branded Content
</div>

{/* Or in Tailwind CSS */}
<div className="bg-[var(--store-primary)] text-[var(--store-primary-text)] border-[var(--store-accent)]">
  Branded Content
</div>
```

---

## Advanced Techniques

### 1. Conditional Layouts

Change the layout based on content or other factors.

```tsx
export function AdaptiveTemplate({ children }: { children: React.ReactNode }) {
  const hasFeaturedProduct = useHasFeaturedProduct(); // Example custom hook

  return (
    <div className={hasFeaturedProduct ? 'template-featured' : 'template-standard'}>
      {hasFeaturedProduct && (
        <div className="banner bg-[var(--store-accent)] text-[var(--store-accent-text)] p-4 text-center">
          Check out our Featured Collection!
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
.template-dynamic .card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.template-dynamic .card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px var(--store-primary);
}
```

### 3. Responsive Layouts

```tsx
export function ResponsiveTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="template-responsive">
      {/* Mobile: Simple stacked layout */}
      <div className="md:hidden">
        {children}
      </div>

      {/* Desktop: Grid layout with a branded sidebar */}
      <div className="hidden md:grid md:grid-cols-[250px_1fr] gap-8">
        <aside className="border-r-2 border-[var(--store-primary)] p-4">
          {/* Sidebar content, e.g., category list */}
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
```

---

## Best Practices

### ✅ DO

1.  **Keep templates simple:** Focus on layout, spacing, and overall feel.
2.  **Use CSS variables:** Let the merchant's colors drive the design.
3.  **Make it responsive:** Test on mobile, tablet, and desktop.
4.  **Use themed components:** Leverage the existing, brand-aware component library.
5.  **Add subtle branding:** Use accents, borders, and gradients with brand colors.
6.  **Test with different colors:** Ensure your design works with various brand color combinations (light, dark, vibrant, muted).

### ❌ DON'T

1.  **Don't hardcode colors:** Always use CSS variables (`var(--store-primary)`) or themed components.
2.  **Don't override content structure:** Your template should wrap, not replace, the `children`.
3.  **Don't add heavy JavaScript:** Keep templates lightweight and focused on presentation.
4.  **Don't break accessibility:** Maintain proper contrast and use semantic HTML.
5.  **Don't forget mobile:** Always design for mobile-first.
6.  **Don't add business logic:** Templates are for presentation only.

---

## Testing Checklist

Before you finalize your template, run through this checklist:

-   [ ] Test with at least 3 different business types.
-   [ ] Test with different logo colors (light, dark, vibrant).
-   [ ] Test on mobile (iPhone SE), tablet (iPad), and desktop viewports.
-   [ ] Verify that all text is readable and meets contrast standards with various color schemes.
-   [ ] Check for performance issues (e.g., slow animations).
-   [ ] Verify there are no console errors or warnings.
-   [ ] Test with both many products (20+) and few products (1-3).

---

## Get Help

Questions or issues?

1.  Check existing templates in `/src/templates/` for examples.
2.  Read the `THEMING_ARCHITECTURE.md` guide for a deep dive into the color system.
3.  Review `business-types.ts` for configuration examples.
4.  Ask for help if you're stuck!

---

**Happy templating! 🎨**

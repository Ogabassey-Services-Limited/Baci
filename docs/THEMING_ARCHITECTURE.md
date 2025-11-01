# Theming Architecture (2025 Best Practices)

## Overview

This document describes our scalable theming system that allows each merchant to have a fully branded storefront with their logo colors.

## Architecture

### 1. Color Extraction Layer
- **Location**: `/public/color-worker.js`
- **Technology**: Web Worker + Median Cut Algorithm
- **Purpose**: Extract 3 brand colors (primary, secondary, accent) from uploaded logos
- **Algorithm**: HSL-based scoring system that intelligently assigns colors to roles based on:
  - Primary: High saturation, medium lightness (brand-defining color)
  - Secondary: Neutral or very dark/light (text, backgrounds)
  - Accent: Bright, vibrant (CTAs, highlights)

### 2. CSS Custom Properties (CSS Variables)
- **Location**: Set at `<main>` level in `/src/app/page.tsx`
- **Variables**:
  ```css
  --store-primary: #hexcolor
  --store-secondary: #hexcolor
  --store-accent: #hexcolor
  ```
- **Scope**: Available to all child components
- **Fallbacks**: Default colors if merchant hasn't set up branding

### 3. Themed Component System
- **Location**: `/src/components/themed-button.tsx` (example)
- **Pattern**: Wrap shadcn/ui components with themed versions
- **Usage**:
  ```tsx
  <ThemedButton colorRole="primary">Shop Now</ThemedButton>
  <ThemedButton colorRole="accent">Add to Cart</ThemedButton>
  ```

### 4. Template System
- **Location**: `/src/templates/`
- **Purpose**: Business-type-specific layouts and styling
- **Current Templates**:
  - `ModernTemplate` - Fashion, Health & Beauty
  - `TechTemplate` - Electronics
  - `ArtisanTemplate` - Handmade, Food & Beverage, Home Goods
- **Future Enhancement**: Add template-specific color usage patterns

## Scalability Plan

### Phase 1: Core Theming ✅ (Current)
- [x] Color extraction from logos
- [x] Intelligent color role assignment
- [x] CSS custom properties
- [x] ThemedButton component
- [x] Product cards with brand colors

### Phase 2: Expanded Component Library
- [ ] ThemedCard - Cards with branded borders/accents
- [ ] ThemedBadge - Status badges in brand colors
- [ ] ThemedInput - Form inputs with branded focus states
- [ ] ThemedLink - Links in brand colors
- [ ] ThemedHeading - Typography with brand colors

### Phase 3: Template Enhancement
- [ ] Template-specific color usage (e.g., Tech uses more secondary, Artisan uses more primary)
- [ ] Template-specific typography scales
- [ ] Template-specific spacing/layout rules
- [ ] Animation preferences per template

### Phase 4: Advanced Theming
- [ ] Dark mode support (auto-generate dark variants)
- [ ] Accessibility checker (ensure WCAG contrast ratios)
- [ ] Color harmony suggestions (suggest complementary accent colors)
- [ ] Brand consistency checker

## Component Development Guidelines

### Creating New Themed Components

1. **Extend existing shadcn/ui components**
   ```tsx
   import { Button, ButtonProps } from '@/components/ui/button';

   interface ThemedButtonProps extends ButtonProps {
     colorRole?: 'primary' | 'secondary' | 'accent';
   }
   ```

2. **Use CSS custom properties with fallbacks**
   ```tsx
   className="bg-[var(--store-primary,#3F51B5)]"
   ```

3. **Support all shadcn variants**
   ```tsx
   if (variant === 'default') {
     // Apply theming
   } else {
     // Use default behavior
   }
   ```

4. **Export from themed namespace**
   ```tsx
   // Future: /src/components/themed/index.ts
   export { ThemedButton } from './button';
   export { ThemedCard } from './card';
   ```

## Template Development Guidelines

### Creating New Templates

1. **Extend React.ComponentType**
   ```tsx
   export function MyTemplate({ children }: { children: React.ReactNode }) {
     return (
       <div className="template-my-style">
         {children}
       </div>
     );
   }
   ```

2. **Register in business-types.ts**
   ```tsx
   import { MyTemplate } from '@/templates/my-template';

   BUSINESS_TYPES.MY_TYPE = {
     // ...
     template: MyTemplate,
   };
   ```

3. **Add template-specific styles**
   ```css
   /* /src/app/globals.css */
   .template-my-style {
     /* Custom layout, spacing, etc */
   }
   ```

## Why This Architecture?

### ✅ Scalable
- Add new themed components without touching existing ones
- Templates are modular and independent
- Color system works for any number of business types

### ✅ Performant
- CSS custom properties are native and fast
- Web Worker keeps UI responsive during color extraction
- No runtime CSS-in-JS overhead

### ✅ Maintainable
- Single source of truth for colors (extracted from logo)
- Standard pattern for all themed components
- Clear separation: extraction → storage → application

### ✅ Flexible
- Easy to add new color roles (e.g., error, success)
- Templates can override theming behavior
- Works with any design system (currently shadcn/ui)

### ✅ Modern (2025 Best Practices)
- Uses latest CSS features (custom properties)
- Web Workers for background processing
- TypeScript for type safety
- Component composition over inheritance

## Alternative Architectures Considered

### ❌ Styled Components / Emotion
- **Pros**: Dynamic theming, TypeScript support
- **Cons**: Runtime overhead, larger bundle size, need provider wrapper
- **Verdict**: Overkill for our use case

### ❌ Tailwind Plugins
- **Pros**: Native Tailwind integration
- **Cons**: Requires rebuild for color changes, complex config
- **Verdict**: Not dynamic enough for per-merchant theming

### ❌ CSS Modules
- **Pros**: Scoped styles, good performance
- **Cons**: Can't access merchant colors dynamically
- **Verdict**: Not flexible enough

### ✅ CSS Custom Properties (Chosen)
- **Pros**: Native, fast, dynamic, no build step, scoped via cascade
- **Cons**: Limited IE11 support (not a concern in 2025)
- **Verdict**: Perfect balance of performance and flexibility

## Migration Path for Existing Components

1. Identify components using colors (buttons, links, badges, etc.)
2. Create themed wrapper component
3. Replace imports gradually
4. Add to themed component library

## Testing Strategy

- **Visual Regression**: Screenshot tests with different color schemes
- **Accessibility**: Automated contrast ratio checks
- **Color Extraction**: Unit tests for RGB → Role assignment
- **Template Rendering**: Ensure all templates work with all business types

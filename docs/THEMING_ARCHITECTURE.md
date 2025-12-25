
# Theming Architecture (2025 Best Practices)

## Overview

This document describes our scalable theming system that allows each merchant to have a fully branded storefront with their logo colors.

## Architecture

### 1. Color Extraction Layer
- **Location**: `/public/color-worker.js` (Web Worker)
- **Technology**: `color-thief-web-worker` for efficient, non-blocking color extraction in the browser.
- **Purpose**: Extract 3 brand colors (primary, secondary, accent) from uploaded logos.
- **Algorithm**: Intelligently assigns colors to roles based on saturation and lightness:
  - **Primary**: The most dominant color, defining the brand.
  - **Secondary**: A complementary or supporting color.
  - **Accent**: A vibrant color for calls-to-action (CTAs) and highlights.

### 2. CSS Custom Properties (CSS Variables)
- **Base Theme:** Defined in `/src/app/globals.css` using standard `shadcn/ui` variable names (e.g., `--primary`, `--secondary`).
- **Dynamic Overrides:** The extracted brand colors are injected at the root of the app by `src/components/app-body.tsx` as `--store-*` variables.
- **Variables**:
  ```css
  /* Dynamically Injected Merchant-Specific Variables */
  --store-primary: #hexcolor;
  --store-secondary: #hexcolor;
  --store-accent: #hexcolor;
  --store-primary-text: #000000; /* Contrast-aware text color */
  --store-secondary-text: #FFFFFF;
  --store-accent-text: #000000;
  ```
- **Scope**: These variables are used by the `ThemedComponents` to apply the merchant's branding, overriding the base theme.
- **Fallbacks**: Default Baci brand colors (from the base theme) are used if a merchant has not completed onboarding.

### 3. Themed Component System
- **Location**: `/src/components/themed/`
- **Pattern**: Wraps standard `shadcn/ui` components with themed versions that automatically use the CSS variables.
- **Usage**:
  ```tsx
  import { ThemedButton, ThemedCard, ThemedBadge } from '@/components/themed';

  <ThemedCard accentPosition="top">
    <ThemedBadge colorRole="accent">New</ThemedBadge>
    <ThemedButton colorRole="primary">Shop Now</ThemedButton>
  </ThemedCard>
  ```

### 4. Template System
- **Location**: `/src/templates/`
- **Purpose**: Defines business-type-specific layouts and styling. Each template is a React component that wraps the main page content.
- **Current Templates**:
  - `ModernTemplate` (for Fashion, Health & Beauty)
  - `TechTemplate` (for Electronics)
  - `ArtisanTemplate` (for Handmade, Food & Beverage, Home Goods)
- **Developer Guide**: See `/docs/CREATE_TEMPLATE_GUIDE.md` for instructions on creating new templates.

## Scalability Plan

### Phase 1: Core Theming ✅ (Current)
- [x] Color extraction from logos via Web Worker.
- [x] Intelligent color role assignment.
- [x] CSS custom properties for brand colors and contrasting text.
- [x] `ThemedButton` component.

### Phase 2: Expanded Component Library ✅ (Current)
- [x] `ThemedCard` - Cards with branded borders/accents.
- [x] `ThemedBadge` - Status badges in brand colors.
- [x] `ThemedLink` - Links in brand colors.
- [x] `ThemedInput` - Form inputs with branded focus states.
- [x] `ThemedSheet` - Side sheets with branded headers/footers.
- [x] Centralized barrel file for easy imports (`@/components/themed`).
- [x/ `CREATE_TEMPLATE_GUIDE.md` for developers.

### Phase 2.5: Checkout & Cart Theming ✅ (Current - December 2025)
- [x] Refactored `checkout-page.tsx` to use CSS variables (`--store-primary`)
- [x] Refactored `cart-page.tsx` to use CSS variables
- [x] Refactored `cart-page-wrapper.tsx` to use CSS variables  
- [x] Refactored `order-success-page.tsx` to use CSS variables
- [x] Created `/components/storefront/shared/checkout-theme.ts` utility
- [x] Validation error states kept as semantic red-500 for UX clarity

### Phase 3: Template Enhancement (Next)
- [ ] Template-specific color usage patterns (e.g., Tech template uses more secondary, Artisan uses more primary).
- [ ] Template-specific typography scales and spacing rules.
- [ ] Animation preferences per template.

### Phase 4: Advanced Theming (Future)
- [ ] Dark mode support for merchant storefronts (auto-generate dark variants).
- [ ] Accessibility checker to ensure color contrast ratios meet WCAG standards.
- [ ] Color harmony suggestions (e.g., suggest complementary accent colors).
- [ ] Visual theme editor for merchants.

## Component Development Guidelines

### Creating New Themed Components

1.  **Create Wrapper**: In `/src/components/`, create a new file (e.g., `themed-alert.tsx`).
2.  **Extend `shadcn/ui`**: Import the base `shadcn/ui` component and its props.
    ```tsx
    import { Alert, AlertProps } from '@/components/ui/alert';
    ```
3.  **Define `colorRole` prop**: Add an optional `colorRole` prop.
    ```tsx
    interface ThemedAlertProps extends AlertProps {
      colorRole?: 'primary' | 'secondary' | 'accent';
    }
    ```
4.  **Apply CSS Variables**: Use Tailwind's arbitrary property syntax to apply the theme colors.
    ```tsx
    className={cn(
      'border-[var(--store-primary)] text-[var(--store-primary)]',
      className
    )}
    ```
5.  **Handle Variants**: Apply colors conditionally based on the component's `variant` prop.
6.  **Export from Barrel File**: Add the new component to `/src/components/themed/index.ts`.

## Why This Architecture?

-   ✅ **Performant**: Uses native CSS Custom Properties with zero runtime JavaScript overhead for styling.
-   ✅ **Developer Friendly**: Simple, declarative API (`colorRole="primary"`). Works with TypeScript and autocompletion.
-   ✅ **Scalable**: Easy to add new themed components or entire templates without affecting existing ones.
-   ✅ **Maintainable**: Single source of truth for theming logic. Clear separation of concerns.
-   ✅ **Flexible**: Templates can override theming behavior, and components have sensible fallbacks.
-   ✅ **Modern (2025 Best Practices)**: Aligns with modern web standards and component-based architecture.

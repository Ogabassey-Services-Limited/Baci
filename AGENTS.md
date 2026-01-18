# AGENTS.md - Baci Ecosystem Context

This file provides context and instructions for AI agents (like Google's Jules) to understand the Baci codebase and maintain our high standards for performance, SEO, and security.

## Project Overview
**Baci** is an AI-powered e-commerce builder for African merchants. It enables merchants to create professional storefronts, manage inventory, and process payments across multiple channels (Web, Mobile, WhatsApp).

### Core Philosophy
- **Holistic Performance:** Every change must prioritize Core Web Vitals (LCP < 2.5s, CLS < 0.1).
- **Merchant Sovereignty:** Code should respect the multi-tenant architecture where each merchant has their own branding and domain context.
- **Security First:** Strict CSP, rate limiting, and secure authentication are non-negotiable.

## Technical Stack
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5.5+
- **Styling:** Tailwind CSS + Vanilla CSS (Variables for theming)
- **Database/Auth:** Supabase (PostgreSQL)
- **Component Library:** Headless UI / Shadcn (Themed)
- **AI Integration:** Google Gemini & Imagen

## Development Setup
```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Run tests
pnpm test

# Lint & Format
pnpm lint
pnpm format
```

## Key Architectures
### 1. Proxy Middleware (`apps/web/src/proxy.ts`)
Handles multi-tenant routing, security headers, and authentication mapping. It rewrites subdomain requests to the appropriate merchant storefront routes.

### 2. Themed Components (`src/components/themed/`)
Components must use CSS variables (`var(--theme-primary)`, etc.) to adapt to merchant brand colors. Never hardcode colors.

### 3. Business Context (`src/config/business-types.ts`)
Determines the AI-driven experience based on the merchant's business category.

## Contribution Guidelines for AI Agents
- **SEO:** Always include JSON-LD structured data on public pages.
- **Accessibility:** Maintain WCAG 2.1 AA compliance (ARIA labels, keyboard navigation).
- **Performance:** Use `next/image` for images and optimize fonts. Avoid heavy client-side libraries.
- **Validation:** Use Zod for all API boundary validations.
- **Types:** Strictly avoid `any`. Use `unknown` or explicit interfaces.

## Testing Requirements
Before submitting a PR, ensure:
1. `pnpm check` passes (Types + Lint).
2. `pnpm test` passes (Vitest).
3. The "CI Quality Gate" workflow passes on GitHub Actions.

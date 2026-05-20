

<!-- Source: AGENTS.md -->

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

<!-- Source: .ruler/AGENTS.md -->

# Baci — AI-Native E-commerce Builder

**Baci** enables merchants to create complete e-commerce stores in minutes using Google Gemini for logo analysis, product descriptions, and store auto-configuration.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16.0.7 (App Router) |
| Language | TypeScript 5.5.4 (strict mode) |
| UI | React 19 + shadcn/ui + Radix UI |
| Styling | Tailwind CSS 3.4.18 |
| Database | Supabase (PostgreSQL with RLS) |
| Auth | Supabase Auth |
| State | React Context + Zustand |
| Forms | React Hook Form + Zod |
| AI | Google Gemini (2.0 Flash, 2.5 Flash Image, Imagen 3) |
| Payments | Korapay, Paystack, Kuda, Credit Direct |
| Email | ZeptoMail + React Email |
| Shipping | GIGL, Topship, Shiip |
| Linting | Biome (NOT ESLint) |
| Monorepo | pnpm + Turborepo |

## Monorepo Structure

```
Baci-app/
├── apps/
│   ├── web/                    # Next.js 16 (builder + storefronts)
│   │   └── src/
│   │       ├── app/            # App Router (pages + API routes, 40+ endpoints)
│   │       ├── ai/             # Google Gemini AI flows
│   │       ├── components/     # React components (ui/, themed/, storefront/, builder/, dashboard/)
│   │       ├── contexts/       # React Context providers
│   │       ├── hooks/          # Custom hooks
│   │       ├── lib/            # Utilities (supabase/, shipping/, sanitize*)
│   │       ├── store/          # Zustand stores
│   │       ├── types/          # TypeScript types
│   │       ├── schemas/        # Zod validation schemas
│   │       └── config/         # App configuration
│   ├── mobile-admin/           # Expo admin app
│   └── mobile-storefront/      # Expo customer storefront app
├── packages/
│   └── shared/                 # Shared schemas, types, utilities
└── supabase/
    └── migrations/             # Database migrations (90+ files, append-only)
```

## Commands

```bash
pnpm turbo dev        # Start dev server
pnpm turbo build      # Production build
pnpm turbo lint       # Biome linting
pnpm format           # Code formatting
pnpm turbo typecheck  # TypeScript check
pnpm turbo test       # Run tests (Vitest)
```

## Deployment

- Hosted on **Vercel** with auto-deploys from Git
- Cron jobs in `vercel.json`
- Database on Supabase (always-on PostgreSQL)



<!-- Source: .ruler/01-critical-rules.md -->

# Critical Rules (MUST READ FIRST)

## NEVER Do

- **NEVER** use the admin/service-role Supabase client for user-facing operations. Use `@/lib/supabase/server` for SSR and `@/lib/supabase/client` for browser.
- **NEVER** modify `proxy.ts` without explicit approval — it handles auth, CSRF, rate limiting, and custom domains. A bug here breaks everything.
- **NEVER** use `dangerouslySetInnerHTML`. Use the sanitization utilities in `lib/sanitize*.ts`.
- **NEVER** edit existing migration files in `supabase/migrations/`. Migrations are append-only.
- **NEVER** add manual `React.memo`, `useCallback`, or `useMemo` — React Compiler handles memoization.
- **NEVER** add ESLint config files or plugins — we use Biome exclusively.
- **NEVER** use npm or yarn — this is a pnpm monorepo. Use `pnpm turbo <command>`.
- **NEVER** use `select('*')` — always select specific columns.

## ALWAYS Do

- **ALWAYS** validate API inputs with Zod before any database operation.
- **ALWAYS** check auth (`supabase.auth.getUser()`) as the first operation in protected API routes.
- **ALWAYS** add RLS policies when creating new database tables.
- **ALWAYS** run `pnpm turbo lint && pnpm turbo typecheck` after writing or modifying code.

## High-Risk Areas

- The `payments/webhook` routes process real money. Triple-check any changes.
- The `src/ai/` directory has per-user rate limits. Respect them in any modifications.
- `proxy.ts` is the middleware — auth, CSRF, rate limiting, custom domains all flow through it.



<!-- Source: .ruler/02-code-standards.md -->

# Code Standards

## Modularization

- One component, hook, or utility per file. Max 300 lines per file.
- Extract shared logic into `packages/shared/src/`.
- Move inline Zod schemas to the `schemas/` directory.
- Consolidate duplicated patterns into shared utilities in `lib/`.
- App-specific code stays in its app (`apps/web/`, `apps/mobile-admin/`, `apps/mobile-storefront/`).

## TypeScript

- Strict mode enabled. No `any` types — use `unknown` or explicit interfaces.
- Path alias: `@/*` maps to `./src/*`.
- Use `import type { X }` for type-only imports.
- Proper generics and type narrowing over type assertions.

## React & Next.js

- Server Components by default. Add `'use client'` only when needed (hooks, interactivity). Justify every directive.
- React Compiler is enabled — automatic memoization. Never add `React.memo`, `useCallback`, or `useMemo`.
- Use `next/image` with explicit `width`/`height` or `sizes` prop.
- Include loading and error states for data-fetching components.

## Theming

- Storefront components use CSS variables (`var(--store-primary)`, etc.). Never hardcode colors.
- Color definitions in `apps/web/src/app/globals.css`.
- Use themed components from `src/components/themed/`.

## Testing

- Vitest + React Testing Library.
- Test files colocated with source: `MyComponent.test.tsx`.
- Test both success AND error paths.
- Use `screen.getByRole()` over `getByTestId()`.

## Quality Gate

Before submitting any changes, ALL must pass:
```bash
pnpm turbo lint        # Zero Biome errors
pnpm turbo typecheck   # Zero TypeScript errors
pnpm turbo test        # All tests pass
```

## Code Review (CodeRabbit)

Before shipping or committing, run CodeRabbit AI review:
```bash
coderabbit review --prompt-only -t uncommitted
```
- Fix all critical and high severity issues before committing.
- CodeRabbit reads your project rules automatically (CLAUDE.md, AGENTS.md).
- Use `--prompt-only` flag so output is concise and machine-readable.



<!-- Source: .ruler/03-supabase.md -->

# Supabase Patterns

## Client Factories

Always use the correct client for the context:

```typescript
// Server-side (API routes, Server Components)
import { createClient } from '@/lib/supabase/server';
const supabase = await createClient();

// Client-side (Client Components)
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

// Admin operations (service role — server-only, NEVER in client bundles)
import { createClient } from '@/lib/supabase/admin';
const supabase = createClient();
```

## Query Patterns

```typescript
// BAD: select('*') fetches unnecessary data
const { data } = await supabase.from('products').select('*');

// GOOD: Select only needed columns
const { data } = await supabase.from('products').select('id, name, price, image_url');
```

- Always handle `.error` on every Supabase response.
- Use `.single()` vs `.maybeSingle()` correctly.
- Scope queries to authenticated user: `.eq('merchant_id', user.id)`.

## RLS Policies

Every new table must have Row-Level Security enabled:

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Merchants see only their own data
CREATE POLICY "merchants_own_data" ON table_name
  FOR ALL USING (auth.uid() = merchant_id);

-- Public storefront data (anonymous read)
CREATE POLICY "public_read" ON products
  FOR SELECT USING (true);
```

## Migrations

- Path: `supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql`
- Use `IF NOT EXISTS` / `IF EXISTS` for safety.
- Append-only — NEVER edit existing migration files.
- Always add indexes on foreign keys.



<!-- Source: .ruler/04-api-routes.md -->

# API Route Patterns

## Standard Pattern

Every protected API route follows this structure:

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  // 1. Auth check FIRST
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Validate input with Zod
  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid input', details: result.error.flatten() }, { status: 400 });
  }

  // 3. Process request with scoped query
  const { data, error } = await supabase
    .from('table')
    .select('id, name')
    .eq('merchant_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

## Anti-Pattern

```typescript
// BAD: No auth check, no validation, unscoped query
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.from('orders').select('*');
  return NextResponse.json(data);
}
```

## Requirements

- Auth check as first operation in all protected routes.
- Zod validation on all request bodies.
- CSRF token validation on POST/PUT/DELETE/PATCH.
- Consistent error shape: `{ error: string, code?: string }`.
- Response data scoped to authenticated user.



<!-- Source: .ruler/05-security.md -->

# Security

## Input & Output

- Sanitize user-generated content with `lib/sanitize*.ts`. Never use `dangerouslySetInnerHTML`.
- Validate all API inputs with Zod schemas before any database operation.
- CSRF tokens required for non-GET API requests.

## Secrets

- Service role key NEVER in client bundles — check `NEXT_PUBLIC_` variables.
- No API keys, passwords, or tokens in source code.
- Do not commit `.env*` files.

## Payments

- Webhook signature verification (HMAC-SHA256) for Korapay/Paystack/Kuda.
- Fail-closed pattern: reject if webhook secret is missing.
- Idempotent payment processing.
- Amount validated server-side — never trust client.

## Middleware (proxy.ts)

- Rate limiting on API routes.
- CSRF protection (token validation).
- Auth session refresh.
- Custom domain routing.
- Do NOT modify without explicit approval.

## Protected Files

Do not modify without explicit approval:
- `proxy.ts` — middleware
- `src/config/business-types.ts` — business type source of truth
- `supabase/migrations/*` — existing migration files
- `.env*` files



<!-- Source: .ruler/06-architecture.md -->

# Architectural Decisions

## ADR-001: Supabase over Firebase
We use Supabase for PostgreSQL, RLS, and open source. Do NOT suggest migrating to Firebase or adding Firebase SDK.

## ADR-002: Biome over ESLint
We migrated from ESLint to Biome. Do NOT add `.eslintrc` files or suggest ESLint plugins.

## ADR-003: Server Components by Default
All new components should be Server Components unless they need interactivity. Justify every `'use client'` directive.

## ADR-004: React Compiler for Memoization
React Compiler is enabled. Do NOT add manual `React.memo`, `useCallback`, or `useMemo`.

## ADR-005: pnpm + Turborepo
This is a pnpm monorepo. Do NOT use npm or yarn. Use `pnpm turbo <command>` for build/lint/test.

## ADR-006: Theming via CSS Variables
Merchant brand colors use CSS variables (`var(--store-primary)`, etc.). Never hardcode colors in storefront components.

## Key Contexts

- `AuthContext` — User authentication state
- `ProductContext` — Product catalog management
- `StorefrontContext` — Storefront data
- `CustomerAuthContext` — Customer auth (separate from merchant)

## Key Hooks

- `useMerchant()` — Merchant data, permissions, staff
- `useCart()` — Shopping cart state
- `useAuth()` — Authentication state
- `useLoyalty()` — Loyalty program
- `useMerchantFeatures()` — Feature flags

## Important Files

- `proxy.ts` — Request middleware (auth, rate limiting, domains)
- `src/env.ts` — Environment variable management
- `src/config/business-types.ts` — Business type configuration (single source of truth)
- `next.config.ts` — Next.js configuration
- `biome.json` — Linter/formatter config



<!-- Source: .ruler/07-testing.md -->

# Testing & Modularity Enforcement

## Mandatory Test Coverage

Every new or significantly modified file MUST have a colocated test file:

| Source File | Test File |
|-------------|-----------|
| `MyComponent.tsx` | `MyComponent.test.tsx` |
| `useMyHook.ts` | `useMyHook.test.ts` |
| `my-util.ts` | `my-util.test.ts` |
| `route.ts` (API) | `route.test.ts` |
| `my-schema.ts` (Zod) | `my-schema.test.ts` |

### What Requires Tests

- **New components** — render, interactions, loading/error states
- **New hooks** — state transitions, error handling, context integration
- **New utilities/helpers** — all input variations, edge cases
- **New API routes** — auth (401), validation (400), success (200), errors (500)
- **New Zod schemas** — valid parsing, each validation rule, boundary values
- **Bug fixes** — a regression test proving the fix works

### What Does NOT Require Tests

- Pure type files (`types/*.ts`) with no runtime logic
- Configuration files (`config/*.ts`) that only export constants
- Re-export barrel files (`index.ts`)
- CSS/style-only changes
- Documentation-only changes

## Test Quality Standards

- **AAA pattern**: Arrange, Act, Assert — in that order, clearly separated
- **Descriptive names**: `it('returns 401 when user is not authenticated')` not `it('works')`
- **Both paths**: Every test suite covers success AND error/edge cases
- **No implementation details**: Test behavior, not internal state or method calls
- **No flaky tests**: No `setTimeout`, no random data, no network calls without mocks
- **Prefer role queries**: `screen.getByRole('button', { name: 'Submit' })` over `getByTestId`

## Modularity Rules

These rules apply to ALL code written by ANY agent:

- **One export per file**: Each file has a single primary export (component, hook, utility, schema)
- **Max 300 lines**: If a file exceeds 300 lines, split it. Extract sub-components, helpers, or constants
- **No God components**: A component doing 3+ unrelated things must be split
- **Shared logic → packages/shared/**: If 2+ apps use the same logic, extract it
- **Schemas → schemas/ directory**: No inline Zod schemas in components or API routes
- **Constants → dedicated files**: No magic strings/numbers. Extract to `config/` or `constants/`
- **Hooks for side effects**: Complex `useEffect` logic should be extracted into custom hooks

## Pre-Completion Checklist

Before marking any task as complete, verify:

1. New source files have colocated test files
2. Tests pass: `pnpm turbo test`
3. No files exceed 300 lines
4. No duplicated logic across files (extract to shared)
5. All exports are typed (no implicit `any`)

## Android Emulator QA

For `apps/mobile-admin`, Android emulator QA must start from:

```bash
pnpm --filter baci-mobile-admin android:emulator
```

This is the only supported emulator launch path for agents and automation. Do not launch the emulator directly or with `-gpu swiftshader_indirect`; the repo launcher owns GPU mode, Quick Boot, ADB reset, boot waiting, Android settle checks, the Metro ADB reverse, and ADB shell stability checks.
The default launcher AVD is `Baci_Pixel_9_Pro_XL_API_36_Google`, an Android 16 API 36 Google APIs Pixel 9 Pro XL profile with `auto` GPU, 2 CPU cores, and 4096 MB RAM. Use `BACI_ANDROID_AVD_NAME` only for explicit emulator-infrastructure fallback triage.
Build with `./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain`, then install with `pnpm --filter baci-mobile-admin android:install`; do not use Gradle `installDebug` for emulator QA on this host.
Run Metro for Android with `pnpm --filter baci-mobile-admin android:metro`; do not use a localhost-only Metro host for emulator QA because the dev client connects through `10.0.2.2`.
Launch the Android dev client with `pnpm --filter baci-mobile-admin android:launch`; do not use raw `adb shell am start` commands because the repo launcher owns the Metro reverse, settled-load check, package force-stop, and Expo dev-client URL.

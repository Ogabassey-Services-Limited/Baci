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
pnpm turbo test       # Run tests (Vitest for web/mobile-admin, Jest for mobile-storefront)
```

## Deployment

- Hosted on **Vercel** with auto-deploys from Git
- Cron jobs in `vercel.json`
- Database on Supabase (always-on PostgreSQL)

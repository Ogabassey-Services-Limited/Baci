# ⚠️ DEPRECATED DOCUMENT
> **NOTE:** This blueprint is outdated. Please refer to:
> - **`GEMINI.md`** for the current Monorepo architecture and project context.
> - **`docs/FUTURE_DEVELOPMENT_PROJECT.md`** for the latest roadmap and feature plans.

# Project Blueprint: Baci - AI E-commerce Builder


## Core Features:

- Intelligent Business Onboarding: Guide new users through a 3-question setup to define their business type and branding preferences. This process will either involve a logo upload with AI color extraction, or AI-driven logo creation from scratch.
- AI-Powered Product Description Generation: Enable merchants to effortlessly generate product descriptions with Gemini 2.0, leveraging predefined templates that capture the nuances of each business category. The LLM should function as a tool which is designed to incorporate relevant business-type considerations.
- AI Product Photo Enhancement: Provide automatic image enhancements for uploaded product photos. This includes background removal, lighting adjustments, and optimal cropping. User can toggle between original and enhanced versions. Will be powered by Imagen 3 editing tool.
- One-Click Store Creation: Generate a fully functional e-commerce website within seconds based on user inputs and selected templates.
- Integrated Paystack Payment Gateway: Enable seamless transaction via bank transfer, cards, and USSD.
- Mobile Responsive Design: The entire store is accessible from multiple device sizes. All of the templates look elegant and scale nicely.
- At-a-Glance Business Dashboard: Key business performance data is clearly visible. Easily keep up to date with recent performance, sales figures and customer base. Quick actions are immediately available.
- Firestore: Data for the app (such as users, stores, products and orders) will be saved to a Firestore database.

## Style Guidelines:

- Primary color: Deep Indigo (#3F51B5). Evokes feelings of trust, security, and professionalism. Dark Indigo will stand out from the background and call attention to important parts of the layout.
- Background color: Light Gray (#F5F5F5), providing a clean, neutral backdrop that won't distract from the products on display.
- Accent color: Amber (#FFC107), creating visual interest while staying analogous to the Indigo hue. Useful for highlighting key UI elements.
- Body and headline font: 'Inter', a sans-serif typeface that brings modernity to both headlines and body copy. The machine-made quality and neutral style match the values of the platform, giving an objective feel. The legibility of 'Inter' makes it an excellent choice for on-screen reading.
- Consistent use of Material Design icons, aligning with the clean and modern aesthetic.
- Clean and spacious layout that avoids clutter. Prioritize showcasing products with ample negative space. Consistent grid-based structure for predictable visual rhythm. Utilize distinct sections that group similar concepts together.
- Subtle transitions and loading animations to enhance user experience without being intrusive.

---

## AI Navigation Guide

**For AI Assistants Working on This Codebase**

This section provides quick navigation and critical information for AI assistants to understand the codebase structure and avoid breaking changes.

### 🚀 Quick Start

**Before Making Changes:**
1. Read `/AI_CONTEXT.md` - Critical rules and project overview
2. Check `/docs/adr/` - Architecture decisions and rationale
3. Review component-level `_AI_README.md` files in relevant directories

**Essential Documentation:**
- **Project Overview:** `/AI_CONTEXT.md` - Start here!
- **Business Types:** `/src/config/business-types.ts` - Single source of truth
- **Onboarding Flow:** `/src/app/onboarding/_AI_README.md`
- **AI Flows:** `/src/ai/flows/_AI_README.md`
- **Schemas:** `/src/schemas/README.md`
- **ADRs:** `/docs/adr/` - Architecture Decision Records

---

### 📁 Project Structure

```
/home/user/studio/
├── docs/
│   ├── blueprint.md                    # This file - project vision
│   └── adr/                            # Architecture Decision Records
│       ├── README.md
│       └── 001-business-type-journey-architecture.md
│
├── src/
│   ├── app/                            # Next.js App Router
│   │   ├── onboarding/                 # 3-step merchant onboarding
│   │   │   ├── page.tsx
│   │   │   ├── onboarding-form.tsx    # Main form with business logic
│   │   │   └── _AI_README.md          # Onboarding context for AI
│   │   │
│   │   └── dashboard/                  # Merchant dashboard
│   │       ├── layout.tsx              # Dashboard layout with sidebar
│   │       ├── page.tsx                # Analytics dashboard
│   │       └── products/add/
│   │           ├── page.tsx
│   │           └── add-product-form.tsx # Product creation form
│   │
│   ├── ai/                             # Vercel AI SDK flows
│   │   └── flows/
│   │       ├── _AI_README.md           # AI flows context
│   │       ├── guide-business-onboarding.ts
│   │       ├── generate-product-descriptions.ts
│   │       └── enhance-product-images.ts
│   │
│   ├── components/
│   │   └── ui/                         # Radix UI components (pure presentation)
│   │
│   ├── config/
│   │   └── business-types.ts           # Business type configuration (see ADR 001)
│   │
│   ├── schemas/
│   │   └── README.md                   # Zod schema documentation
│   │
│   └── lib/                            # Utilities
│       ├── utils.ts
│       └── logger.ts
│
├── AI_CONTEXT.md                       # ⭐ START HERE - Critical AI context
└── package.json                        # Dependencies and scripts
```

---

### 🎯 Common Tasks - Quick Reference

#### Task: Add a New Business Type

**✅ Phase 2 Complete - Now Configuration-Driven!**

| Step | File | Action |
|------|------|--------|
| 1 | `/src/config/business-types.ts` | Add new entry to `BUSINESS_TYPES` object |
| 2 | Test | Run onboarding flow with new type - dropdown automatically updated! |
| 3 | Test | Test AI flows (logo gen, product descriptions) |
| 4 | Done! | No other code changes needed in onboarding form |

**✅ Phase 3 Complete:**
- AI prompts automatically read business type config
- `generate-product-descriptions.ts` uses aiDescriptionStyle and aiPromptContext
- `guide-business-onboarding.ts` uses logoStyle and colorScheme
- No manual prompt updates needed!

#### Task: Modify an AI Flow

| Step | Action |
|------|--------|
| 1 | Read `/src/ai/flows/_AI_README.md` for flow details |
| 2 | Locate flow file in `/src/ai/flows/` |
| 3 | Search for callers: `grep -r "flowName" src/` |
| 4 | Update callers if schema changed |
| 5 | Test with all business types |

#### Task: Add a New Form Field

| Step | File | Action |
|------|------|--------|
| 1 | Component file | Add to Zod schema |
| 2 | Component file | Add `<FormField>` to UI |
| 3 | Component file | Update submit handler |
| 4 | (If onboarding) | Update AI flow input if needed |
| 5 | Test | Validate edge cases |

#### Task: Change Design System

| File | What to Change |
|------|----------------|
| `/src/app/globals.css` | CSS variables (colors, fonts) |
| `/tailwind.config.ts` | Tailwind configuration |
| ⚠️ **Warning** | Changing CSS variable names breaks all components |

---

### 🔥 Critical Rules - Breaking Changes to Avoid

#### 1. Business Types (Highest Priority)

**✅ Phase 2 Complete - Now Configuration-Driven!**

**Location:** `/src/config/business-types.ts` (single source of truth)
**Implementation:** `/src/app/onboarding/onboarding-form.tsx:167-172` (dynamically loaded)

**Current Business Types:**
- `fashion` - Fashion & Apparel
- `electronics` - Electronics & Gadgets
- `home-goods` - Home Goods & Decor
- `health-beauty` - Health & Beauty
- `handmade` - Handmade & Crafts
- `food-beverage` - Food & Beverage
- `other` - Custom (requires `otherBusinessType` field)

**Dependencies:**
- Onboarding form dropdown
- AI logo generation prompts
- AI product description prompts
- Future: Template selection
- Future: User profile storage

**⚠️ When changing business types:**
- ✅ Onboarding form dropdown - automatically updated (reads from config)
- ✅ AI flow prompts - automatically updated (read from config)
- Test all AI generations with new type
- DO NOT remove types if users have already selected them
- **Just edit `/src/config/business-types.ts` - that's it!**

#### 2. AI Flow Signatures

**Flows:**
- `guideBusinessOnboarding` → `/src/ai/flows/guide-business-onboarding.ts:99`
- `generateProductDescription` → `/src/ai/flows/generate-product-descriptions.ts:87`
- `enhanceProductImage` → `/src/ai/flows/enhance-product-images.ts:98`

**⚠️ When changing AI flows:**
- DO NOT change input/output schemas without updating ALL callers
- Use `grep -r "flowName" src/` to find callers
- Update TypeScript types if schema changes
- Test error handling paths

#### 3. CSS Variables (Design System)

**Location:** `/src/app/globals.css:6-40` (light mode), `:41-70` (dark mode)

**Variables Used Throughout:**
- `--primary` (#3F51B5 - Deep Indigo)
- `--background` (#F5F5F5 - Light Gray)
- `--accent` (#FFC107 - Amber)
- `--foreground`, `--card`, `--border`, etc.

**⚠️ Changing CSS variable names:**
- Breaks ALL components that use them
- Use search/replace carefully: `grep -r "hsl(var(--primary))" src/`
- Test all pages after changes
- Consider adding new variables instead of renaming

#### 4. Form Schemas

**Onboarding:** `/src/app/onboarding/onboarding-form.tsx:86-111`
**Product:** `/src/app/dashboard/products/add/add-product-form.tsx:42-49`

**⚠️ When changing schemas:**
- Update Zod schema definition
- Update form UI (`<FormField>` components)
- Update submit handler
- Update TypeScript types (`z.infer<typeof schema>`)
- Test validation edge cases

---

### ✅ Phase 4 Complete - Firestore Integration

**Feature:** All onboarding data is now saved to a `merchants` collection in Firestore, and the product form dynamically uses this data.

| Step | File | Action |
|------|------|--------|
| 1 | `/src/lib/firebase.ts` | Initializes Firebase services (Auth, Firestore) |
| 2 | `/src/services/merchantService.ts` | Provides `saveMerchantData` to write to Firestore |
| 3 | `/src/app/onboarding/onboarding-form.tsx` | Creates user via `createUserWithEmailAndPassword` and saves data on submit |
| 4 | `/src/hooks/use-merchant.tsx` | New hook to fetch logged-in merchant's data |
| 5 | `/src/app/dashboard/products/add/add-product-form.tsx` | Uses `useMerchant` hook to get business type for AI description generation |

**New Data Flow:**
- Onboarding form → `createUserWithEmailAndPassword` → `saveMerchantData` → Firestore
- Product form → `useMerchant` hook → Reads from Firestore

---

### 🐛 Known Issues & Workarounds

#### Issue 3: Duplicate Color Extraction

**Locations:**
- `/src/app/onboarding/onboarding-form.tsx:172` (on logo upload)
- `/src/app/onboarding/onboarding-form.tsx:340` (on form submit)

**Problem:** Color extraction AI called twice for uploaded logos

**Impact:** Higher costs, slower submission, potential inconsistencies

**Workaround:** Cache results in form state

**Fix:** Skip second AI call if colors already extracted

#### Issue 4: Large Data URIs

**Problem:** Base64 encoded images are memory-intensive (several MB)

**Impact:** Slow form state updates, potential performance issues

**Workaround:** None currently

**Fix:** Upload images to Firebase Storage first, use URLs instead of data URIs

---

### 📊 Data Flow Diagrams

#### Onboarding Flow

```
User Lands on /onboarding
         │
         ▼
┌─────────────────────┐
│ Step 1: Name        │  → Validates (min 2 chars)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Step 2: Type        │  → Validates (select required)
│ - Dropdown select   │  → If "other": show custom field
│ - Conditional field │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Step 3: Logo                    │
│                                  │
│ Option A:        Option B:       │
│ Upload Logo      Generate Logo   │
│    ↓                ↓            │
│ AI extracts      AI generates    │
│ 5 colors         logo + colors   │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────┐
│ Submit Form         │
│ ⚠️ Data NOT saved  │
└──────────┬──────────┘
           │
           ▼
    Redirect to /dashboard
```

#### Product Creation Flow

```
User Navigates to /dashboard/products/add
         │
         ▼
┌─────────────────────────────────┐
│ 1. Enter Product Name           │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 2. Generate Description (AI)    │
│    ⚠️ Uses hardcoded type      │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 3. Upload Product Image         │
│    → Auto-enhances with AI      │
│    → Shows original vs enhanced │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 4. Set Price, Stock, Status     │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Submit Form                     │
│ ⚠️ Mock submission (2s delay)  │
└──────────┬──────────────────────┘
           │
           ▼
    Redirect to /dashboard/products
```

---

### 🧪 Testing Strategy

#### Before Making Changes

```bash
# Type check
npm run typecheck

# Dev server
npm run dev  # http://localhost:9002

```

#### What to Test

**After Onboarding Changes:**
- ✅ All 6 business types + "Other"
- ✅ Logo upload → color extraction works
- ✅ Logo generation → colors returned
- ✅ Form validation at each step
- ✅ Redirect to dashboard

**After Product Form Changes:**
- ✅ AI description generation
- ✅ Image upload → auto-enhancement
- ✅ Toggle between original/enhanced
- ✅ Form validation
- ✅ Submit works

**After AI Flow Changes:**
- ✅ Test in Genkit Dev UI with sample data
- ✅ Test with all business types
- ✅ Test error handling (network issues)
- ✅ Verify output schema matches TypeScript types

---

### 🔗 Quick Links

#### Documentation
- [AI Context](/AI_CONTEXT.md) - Start here
- [Onboarding Context](/src/app/onboarding/_AI_README.md)
- [AI Flows Context](/src/ai/flows/_AI_README.md)
- [Schema Docs](/src/schemas/README.md)
- [ADR 001](/docs/adr/001-business-type-journey-architecture.md)

#### Key Files
- [Business Types Config](/src/config/business-types.ts)
- [Onboarding Form](/src/app/onboarding/onboarding-form.tsx)
- [Product Form](/src/app/dashboard/products/add/add-product-form.tsx)
- [Logo Flow](/src/ai/flows/guide-business-onboarding.ts)
- [Description Flow](/src/ai/flows/generate-product-descriptions.ts)
- [Enhancement Flow](/src/ai/flows/enhance-product-images.ts)

#### External Resources
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Radix UI](https://www.radix-ui.com/primitives/docs/overview/introduction)
- [Zod Validation](https://zod.dev/)

---

### 💬 Need Help?

**For AI Assistants:**

1. **Check documentation first:**
   - `/AI_CONTEXT.md` - Project-wide rules
   - Component `_AI_README.md` files - Specific areas
   - `/docs/adr/` - Why decisions were made

2. **Search the codebase:**
   ```bash
   grep -r "searchTerm" src/
   ```

3. **Test your changes:**
   - Use Genkit Dev UI for AI flows
   - Run `npm run typecheck` for type errors
   - Test in browser: `npm run dev`

4. **Ask the user:**
   - If documentation is unclear
   - If multiple approaches are valid
   - If uncertain about breaking changes

---

**Last Updated:** 2025-10-31
**Maintained By:** System Architecture
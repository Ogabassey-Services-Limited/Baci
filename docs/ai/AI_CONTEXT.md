# Baci AI E-commerce Builder - AI Context

**Last Updated:** 2025-10-31
**Project Type:** Next.js 15 Web Application
**Primary Purpose:** Merchant dashboard for AI-powered e-commerce store builder

---

## Quick Reference

### Tech Stack
- **Framework:** Next.js 15.0.0 (App Router)
- **Language:** TypeScript 5.5.4 (strict mode)
- **Styling:** Tailwind CSS 3.4.7 + shadcn/ui
- **AI Engine:** Vercel AI SDK with Gemini 2.5 Flash models
- **Forms:** React Hook Form 7.54.2 + Zod 3.24.2 validation
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Payment Processing:** Paystack (planned, not yet implemented)

### Project Status
- ✅ Landing page with feature showcase
- ✅ 3-step onboarding flow with AI logo generation
- ✅ Merchant dashboard layout with sidebar navigation
- ✅ Product management forms with AI assistance
- ✅ Supabase integration for auth and merchant data
- ✅ Design system with CSS variable-based theming
- ❌ Customer storefronts/templates
- ❌ Mobile app (React Native - planned)

---

## Critical Rules - READ THIS FIRST

### 🚨 Breaking Changes to Avoid

1. **NEVER modify AI flow signatures** in `/src/ai/flows/*` without updating all calling components
   - Logo generation: `guideBusinessOnboarding` in `guide-business-onboarding.ts:39`
   - Product descriptions: `generateProductDescription` in `generate-product-descriptions.ts:26`
   - Image enhancement: `enhanceProductImage` in `enhance-product-images.ts`

2. **Business types are the SINGLE SOURCE OF TRUTH**
   - Location: `/src/config/business-types.ts`
   - When adding/removing types, update:
     - Onboarding form dropdown (auto-updated)
     - AI prompt contexts in all flows (auto-updated from config)
     - Product description generation logic

3. **Design system uses CSS variables**
   - All colors defined in: `/src/app/globals.css:6-40` (light mode) and `:41-70` (dark mode)
   - DO NOT hardcode colors - always use Tailwind utilities
   - Merchant brand colors will override CSS variables

4. **Component Structure**
   - Base UI components are in `/src/components/ui/*`. These should be pure presentation components.
   - Themed, brand-aware components are in `/src/components/themed/`. These wrap `shadcn/ui` components and apply brand colors via CSS variables.

5. **All forms use React Hook Form + Zod pattern**
   - Define Zod schema first
   - Use `zodResolver` for validation
   - Wrap in `<FormProvider>` for multi-step forms
   - Use `FormField` components from `/src/components/ui/form.tsx`

---

## Business Type Architecture

### Supported Business Types (6 predefined + 1 custom)

**✅ Phase 2 Complete:** Now dynamically loaded from `/src/config/business-types.ts`
**Implementation:** `/src/app/onboarding/onboarding-form.tsx:167-172`

| Value | Label | Use Case |
|-------|-------|----------|
| `fashion` | Fashion & Apparel | Clothing, accessories, and fashion items |
| `electronics` | Electronics & Gadgets | Tech products and electronic devices |
| `home-goods` | Home Goods & Decor | Furniture, home accessories, and decor items |
| `health-beauty` | Health & Beauty | Cosmetics, wellness, and personal care products |
| `handmade` | Handmade & Crafts | Artisan products, handcrafted items, and unique creations |
| `food-beverage` | Food & Beverage | Consumable goods, beverages, and culinary products |
| `hair-extensions` | Hair & Extensions | Wigs, weaves, bundles, and hair care products |

### How Business Types Flow Through the App

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Onboarding Form (Step 2)                                      │
│    User selects business type                                    │
│    Location: /src/app/onboarding/onboarding-form.tsx:167-172    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Logo Generation (Step 3)                                      │
│    Business type passed to AI for context                        │
│    Flow: guideBusinessOnboarding({businessType: "fashion"})      │
│    Location: /src/ai/flows/guide-business-onboarding.ts:39      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Dashboard Creation                                            │
│    Business type stored in Supabase 'merchants' table            │
│    Used to personalize dashboard experience                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Product Creation                                              │
│    Business type influences AI product descriptions              │
│    Flow: generateProductDescription({businessType: "fashion"})   │
│    Location: /src/ai/flows/generate-product-descriptions.ts:26  │
└─────────────────────────────────────────────────────────────────┘
```

### Future: Business Type Templates & Journeys

See `/docs/adr/001-business-type-journey-architecture.md` for the planned architecture:
- Each type will have its own onboarding journey
- Custom product form fields per type (e.g., "Size" for fashion, "Specs" for electronics)
- AI prompts tailored to business category
- Template selection based on business type
- Recommended features per category

---

## Key File Locations

### Core Application Files

| File | Purpose | Lines | Dependencies |
|------|---------|-------|--------------|
| `/src/app/onboarding/onboarding-form.tsx` | 3-step onboarding wizard | 456 | `guideBusinessOnboarding` AI flow, Supabase auth |
| `/src/app/dashboard/products/add/add-product-form.tsx` | Product creation form | 325 | `generateProductDescription`, `enhanceProductImage` |
| `/src/app/dashboard/layout.tsx` | Dashboard layout with sidebar | - | Sidebar component |
| `/src/app/page.tsx` | Landing page | - | UI components |

### AI Flows (Vercel AI SDK)

| File | Purpose | Input | Output |
|------|---------|-------|--------|
| `/src/ai/flows/guide-business-onboarding.ts` | Logo generation + color extraction | `businessName`, `businessType`, `brandPreferences`, optional `logoDataUri` | `logoDataUri`, `brandColors` (5 hex codes) |
| `/src/ai/flows/generate-product-descriptions.ts` | AI-powered product descriptions | `productName`, `businessType`, `productDetails` | `description` (string) |
| `/src/ai/flows/enhance-product-images.ts` | Background removal + image enhancement | `photoDataUri` | `enhancedPhotoDataUri` |

### Configuration Files

| File | Purpose |
|------|---------|
| `/tailwind.config.ts` | Tailwind CSS configuration (colors, fonts, plugins) |
| `/src/app/globals.css` | CSS variables for theming (lines 6-70) |
| `/docs/blueprint.md` | 2100+ line comprehensive architecture documentation |
| `/docs/adr/001-business-type-journey-architecture.md` | Architecture decision record for business type system |

### Schema Definitions

| File | Schema Name | Location | Purpose |
|------|-------------|----------|---------|
| `/src/schemas/onboarding.ts` | `onboardingSchema` | - | Onboarding form validation (client and server) |
| `/src/app/dashboard/products/add/add-product-form.tsx` | `addProductSchema` | - | Product form validation |
| `/src/ai/flows/guide-business-onboarding.ts` | `GuideBusinessOnboardingInputSchema` | - | AI flow input validation |

---

## Data Flow & Dependencies

### Onboarding Flow (3 Steps)

```
Step 1: Business Details
├─ Input: businessName, businessType
├─ Validation: step1Schema
└─ Next: Enabled after validation passes

Step 2: Logo & Branding
├─ Option A: Upload existing logo → AI extracts 3 brand colors
├─ Option B: Generate new logo (Future)
└─ Validation: step2Schema (requires logo and colors)

Step 3: Account Creation
├─ Input: email, password
├─ Validation: step3Schema
└─ Submit: Create user & merchant record in Supabase → Redirect to /dashboard
```

### Product Creation Flow

```
1. User enters product name
2. [Optional] Click "Generate with AI" for description
   ├─ Calls: generateProductDescription(productName, businessType, details)
   └─ AI returns compelling product description
3. User uploads product image
   ├─ Auto-enhances image on upload
   ├─ Calls: enhanceProductImage(photoDataUri)
   └─ Shows enhanced version with toggle switch
4. User sets price, stock, status
5. Submit → Save product (currently mock data)
```

---

## Common Tasks - Quick Guide

### Adding a New Business Type

**✅ Phase 2 Complete - Now Configuration-Driven!**

1. **Update config file** `/src/config/business-types.ts`
   ```typescript
   NEW_TYPE: {
     id: 'new-type',
     label: 'New Type Label',
     description: 'Description of business category',
     aiPromptContext: 'AI context for prompts',
     icon: LucideIconName,
     journey: {
       onboarding: { /* ... */ },
       productCreation: { /* ... */ }
     }
   }
   ```

2. **Test onboarding flow**
   - Dropdown automatically includes new type
   - No code changes needed in onboarding form!

3. **✅ AI prompts automatically read from config** (Phase 3 - COMPLETE)
   - Logo generation: `guide-business-onboarding.ts` uses logoStyle and colorScheme from config
   - Product descriptions: `generate-product-descriptions.ts` uses aiDescriptionStyle and aiPromptContext
   - No manual prompt updates needed when adding new types!

4. **Test all flows**
   - Onboarding with new type
   - Logo generation
   - Product description generation

### Modifying an AI Flow

1. **Read the flow file** to understand input/output schemas
2. **Check all callers** using grep:
   ```bash
   grep -r "guideBusinessOnboarding" src/
   grep -r "generateProductDescription" src/
   ```
3. **Update schema definitions** if changing inputs/outputs
4. **Update all calling components** to match new signature
5. **Test with all business types**

### Adding a New UI Component

1. **Create in** `/src/components/ui/[component-name].tsx`
2. **Keep it pure** - no business logic, no API calls
3. **Use Tailwind + CSS variables** for styling
4. **Export as named export**
5. **Document props with TypeScript**

### Modifying the Design System

1. **Colors:** Edit CSS variables in `/src/app/globals.css:6-70`
2. **Fonts:** Edit Tailwind config in `/tailwind.config.ts:12-16`
3. **Spacing/Radius:** Edit CSS variables in `/src/app/globals.css:31`
4. **Dark mode:** Edit `.dark` class in `/src/app/globals.css:41-70`

**⚠️ Warning:** Changing CSS variable names will break all components. Use search/replace carefully.

---

## Known Issues & Gotchas


### 1. Duplicate AI Calls in Onboarding
**Location:** `/src/ai/flows/guide-business-onboarding.ts:81-86`
**Issue:** When logo is uploaded, color extraction happens in onboarding and again on submit
**Optimization:** Cache color extraction results in form state

### 2. No Error Boundaries
**Issue:** AI flow failures crash the entire form
**Fix:** Add React Error Boundaries around AI-powered components

### 3. Image Data URIs Are Large
**Issue:** Base64 encoded images in form state and AI calls are memory-intensive
**Fix:** Upload images to Supabase Storage first, pass URLs instead

---

## Testing Guidelines

### Testing Onboarding Flow
1. Test all 6 predefined business types
2. Test "Other" custom type with various inputs
3. Test logo upload with different image formats
4. Test AI logo generation with different color preferences
5. Verify color extraction returns exactly 5 hex codes
6. Test form validation at each step

### Testing Product Creation
1. Test AI description generation with empty product details
2. Test image enhancement with various image sizes
3. Test form submission with missing required fields
4. Verify toggle between original and enhanced images
5. Test with very long product names (edge case)

### Testing AI Flows
1. Test each flow individually with sample inputs
2. Verify output schemas match TypeScript types
3. Test error handling with invalid inputs

---

## Architecture Patterns

### Form Pattern
All forms follow this pattern:
```typescript
// 1. Define Zod schema
const schema = z.object({ /* fields */ });
type FormValues = z.infer<typeof schema>;

// 2. Initialize form with zodResolver
const form = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: { /* defaults */ }
});

// 3. Wrap in FormProvider for context
<FormProvider {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    {/* FormField components */}
  </form>
</FormProvider>
```

### AI Flow Pattern
All Vercel AI SDK flows follow this pattern:
```typescript
import { google } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { z } from 'zod';

// 1. Define input/output schemas
const InputSchema = z.object({ /* input fields */ });
const OutputSchema = z.object({ /* output fields */ });
type FlowInput = z.infer<typeof InputSchema>;
type FlowOutput = z.infer<typeof OutputSchema>;

// 2. Create flow function
export async function flowName(input: FlowInput): Promise<FlowOutput> {
  // Validate input if needed
  const validatedInput = InputSchema.parse(input);

  // 3. Use AI SDK 6 structured output
  const { output } = await generateText({
    model: google('gemini-2.5-flash'),
    output: Output.object({ schema: OutputSchema }),
    prompt: `Generated prompt based on ${JSON.stringify(validatedInput)}`,
  });

  return output;
}
```

### Component Pattern
UI components follow this pattern:
```typescript
interface ComponentProps {
  // Props with TypeScript types
}

export function Component({ prop1, prop2 }: ComponentProps) {
  // Pure presentation logic
  return <div>...</div>;
}
```

---

## AI-Specific Guidelines

### When Working with AI Flows

1. **Always validate schemas** - Zod ensures type safety between AI and app
2. **Handle failures gracefully** - AI can fail, timeout, or return unexpected data
3. **Use structured output** - Prefer Zod schemas over free-form text parsing
4. **Test with real data** - AI responses vary, test edge cases
5. **Monitor token usage** - Large images in prompts are expensive
6. **Cache when possible** - Don't regenerate the same content twice

### AI Models in Use

| Model | Use Case | Token Limit | Cost |
|-------|----------|-------------|------|
| `gemini-2.5-flash` | Text generation (descriptions) | 1M input, 8K output | Low |
| `gemini-2.5-flash-image-preview` | Image generation & analysis | 1M input, 8K output | Medium |

### Prompt Engineering Tips

- **Be specific** - "Generate a simple, modern logo" vs "Generate a logo"
- **Include context** - Always pass business type and name to AI
- **Use examples** - Show the AI the format you want
- **Constrain output** - "Return exactly 5 hex color codes"
- **Handle failures** - Always have a fallback or default

---

## Resources

### Documentation
- **Project Blueprint:** `/docs/blueprint.md` (2100+ lines - READ THIS FIRST)
- **Architecture Decisions:** `/docs/adr/`
- **Component Docs:** `/src/app/onboarding/_AI_README.md`, `/src/ai/flows/_AI_README.md`
- **Schema Docs:** `/src/schemas/README.md`

### External Docs
- **Next.js 15:** https://nextjs.org/docs
- **Vercel AI SDK:** https://ai-sdk.dev/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Radix UI:** https://www.radix-ui.com/primitives/docs/overview/introduction
- **React Hook Form:** https://react-hook-form.com/get-started
- **Zod:** https://zod.dev/

### Commands
```bash
pnpm turbo dev           # Start Next.js dev server on port 9002
pnpm turbo build         # Production build
pnpm turbo typecheck     # TypeScript type checking
pnpm turbo lint          # Biome linting
```

---

## Questions?

If you're an AI assistant and you're unsure about something:

1. **Check this file first** for quick answers
2. **Read `/docs/blueprint.md`** for comprehensive architecture
3. **Check ADRs in `/docs/adr/`** for context on decisions
4. **Read component-level `_AI_README.md` files** for specific areas
5. **Search the codebase** using grep/Glob tools
6. **Ask the user** if documentation is unclear or outdated

---

**Remember:** This is a living document. Update it when you make significant architectural changes.

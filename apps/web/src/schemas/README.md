# Zod Schema Documentation

This directory contains the centralized, production-grade Zod validation schemas used throughout the Baci e-commerce platform. 

**Target Architecture**: All schemas should be defined in dedicated `.ts` files here and imported where needed across the Next.js and mobile workspaces, keeping our codebase modular, testable, and type-safe. Currently, some legacy or context-specific schemas are still defined inline or in their respective folders (such as `onboarding-form.tsx`, `add-product-form.tsx`, and `src/ai/flows/*`), as detailed in the index below.

---

## Why Document Schemas?

Zod schemas define:
- **Data contracts** between components and APIs
- **Validation rules** for forms
- **Type safety** through TypeScript inference
- **AI flow input/output** structures

Understanding schemas is critical for:
- Adding new fields
- Modifying validation rules
- Integrating with APIs
- Preventing runtime errors

---

## Schema Index

### Frontend Schemas

| Schema | Location | Purpose | Fields |
|--------|----------|---------|--------|
| `baseFormSchema` | `/src/app/onboarding/onboarding-form.tsx:86` | Onboarding form validation | businessName, businessType, otherBusinessType, brandPreferences, logo |
| `refinedFormSchema` | `/src/app/onboarding/onboarding-form.tsx:103` | Adds conditional "other" validation | Extends baseFormSchema |
| `addProductSchema` | `/src/app/dashboard/products/add/add-product-form.tsx:42` | Product creation validation | name, description, price, stock, status, image |

### AI Flow Schemas (Vercel AI SDK)

| Schema | Location | Purpose | Fields |
|--------|----------|---------|--------|
| `GuideBusinessOnboardingInputSchema` | `/src/ai/flows/guide-business-onboarding.ts:15` | Logo generation/color extraction input | businessName, businessType, brandPreferences, logoDataUri |
| `GuideBusinessOnboardingOutputSchema` | `/src/ai/flows/guide-business-onboarding.ts:28` | Logo generation/color extraction output | logoDataUri, brandColors |
| `GenerateProductDescriptionInputSchema` | `/src/ai/flows/generate-product-descriptions.ts:14` | Product description generation input | productName, businessType, productDetails |
| `GenerateProductDescriptionOutputSchema` | `/src/ai/flows/generate-product-descriptions.ts:21` | Product description generation output | description |
| `EnhanceProductImageInputSchema` | `/src/ai/flows/enhance-product-images.ts` | Image enhancement input | photoDataUri |
| `EnhanceProductImageOutputSchema` | `/src/ai/flows/enhance-product-images.ts` | Image enhancement output | enhancedPhotoDataUri |

---

## Onboarding Schemas

### baseFormSchema

**Location:** `/src/app/onboarding/onboarding-form.tsx:86-92`

```typescript
const baseFormSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters.'),
  businessType: z.string().min(1, 'Please select a business type.'),
  otherBusinessType: z.string().optional(),
  brandPreferences: z.string().optional(),
  logo: z.unknown().optional(),
});
```

**Fields:**

| Field | Type | Required | Validation | Purpose |
|-------|------|----------|------------|---------|
| `businessName` | string | Yes | Min 2 chars | Merchant's business name |
| `businessType` | string | Yes | Min 1 char, should be one of: fashion, electronics, home-goods, health-beauty, handmade, food-beverage, other | Selected business category |
| `otherBusinessType` | string | Conditional | Required if businessType === "other" (enforced by refinedFormSchema) | Custom business type name |
| `brandPreferences` | string | No | None | User's favorite color for logo generation (e.g., "deep ocean blue") |
| `logo` | any | No | None | File object or data URI of uploaded/generated logo |

**TypeScript Type:**
```typescript
type OnboardingFormValues = z.infer<typeof baseFormSchema>;
```

**Used By:**
- Onboarding form (step-by-step validation)
- AI flow: `guideBusinessOnboarding` (partial subset)

---

### refinedFormSchema

**Location:** `/src/app/onboarding/onboarding-form.tsx:103-111`

```typescript
const refinedFormSchema = baseFormSchema.refine(data => {
    if (data.businessType === 'other' && (!data.otherBusinessType || data.otherBusinessType.length < 2)) {
        return false;
    }
    return true;
}, {
    message: "Please specify your business type with at least 2 characters.",
    path: ["otherBusinessType"],
});
```

**Purpose:** Adds conditional validation for custom business type

**Validation Logic:**
- If `businessType === "other"`:
  - `otherBusinessType` must be present
  - `otherBusinessType` must be at least 2 characters
- Otherwise: No additional validation

**Error Display:** Shows error message on `otherBusinessType` field

**Used By:**
- Onboarding form (Step 2 and Step 3 validation)

---

## Product Schemas

### addProductSchema

**Location:** `/src/app/dashboard/products/add/add-product-form.tsx:42-49`

```typescript
const addProductSchema = z.object({
  name: z.string().min(3, 'Product name must be at least 3 characters.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  stock: z.coerce.number().int('Stock must be a whole number.'),
  status: z.enum(['draft', 'active']),
  image: z.unknown().refine((file) => file, 'Product image is required.'),
});
```

**Fields:**

| Field | Type | Required | Validation | Purpose |
|-------|------|----------|------------|---------|
| `name` | string | Yes | Min 3 chars | Product name |
| `description` | string | Yes | Min 10 chars | Product description (can be AI-generated) |
| `price` | number | Yes | Coerced from string, min 0 | Product price in currency |
| `stock` | number | Yes | Coerced from string, must be integer | Available stock quantity |
| `status` | enum | Yes | Must be "draft" or "active" | Product publication status |
| `image` | any | Yes | Must be truthy (file or data URI) | Product image |

**TypeScript Type:**
```typescript
type AddProductFormValues = z.infer<typeof addProductSchema>;
```

**Used By:**
- Product creation form
- Future: Product edit form

**Coercion:**
- `price` and `stock` use `z.coerce.number()` to convert string inputs to numbers
- Useful for form inputs which always return strings

---

## AI Flow Schemas

### GuideBusinessOnboarding Input/Output

**Input Schema Location:** `/src/ai/flows/guide-business-onboarding.ts:15-25`

```typescript
const GuideBusinessOnboardingInputSchema = z.object({
  businessName: z.string().describe("The user's business name."),
  businessType: z.string().describe('The type of business the user is onboarding.'),
  brandPreferences: z.string().describe("The user's favorite color to influence branding."),
  logoDataUri: z
    .string()
    .optional()
    .describe(
      "A photo of a company logo, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
```

**Input Fields:**

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `businessName` | string | Yes | Business name for logo design context |
| `businessType` | string | Yes | Business category for style guidance (e.g., "fashion", "electronics") |
| `brandPreferences` | string | Yes | Favorite color for AI to use in logo generation (e.g., "royal blue") |
| `logoDataUri` | string | No | If provided, AI extracts colors instead of generating logo. Must be data URI format. |

**Output Schema Location:** `/src/ai/flows/guide-business-onboarding.ts:28-36`

```typescript
const GuideBusinessOnboardingOutputSchema = z.object({
  logoDataUri: z
    .string()
    .optional()
    .describe(
      'The data URI of the generated logo, including MIME type and Base64 encoding, if a logo was generated.'
    ),
  brandColors: z.array(z.string()).describe('A list of 5 brand colors in hex format (e.g., #RRGGBB) extracted from the logo or generated.'),
});
```

**Output Fields:**

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `logoDataUri` | string | No | Generated logo as data URI (only if logo was generated, not when extracting from uploaded logo) |
| `brandColors` | string[] | Yes | Array of exactly 5 hex color codes: [primary, secondary, accent, background, text] |

**AI Model:** `gemini-2.5-flash-image-preview`

**Use Cases:**
1. **Generate Logo:** Pass businessName, businessType, brandPreferences (no logoDataUri) → Returns logo + colors
2. **Extract Colors:** Pass businessName, businessType, logoDataUri → Returns original logo + extracted colors

---

### GenerateProductDescription Input/Output

**Input Schema Location:** `/src/ai/flows/generate-product-descriptions.ts:14-18`

```typescript
const GenerateProductDescriptionInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  businessType: z.string().describe('The type of business selling the product.'),
  productDetails: z.string().describe('Detailed information about the product.'),
});
```

**Input Fields:**

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `productName` | string | Yes | Name of product to describe |
| `businessType` | string | Yes | Business category for context (should match onboarding business type) |
| `productDetails` | string | Yes | Additional product information to include in description |

**Output Schema Location:** `/src/ai/flows/generate-product-descriptions.ts:21-23`

```typescript
const GenerateProductDescriptionOutputSchema = z.object({
  description: z.string().describe('A compelling product description.'),
});
```

**Output Fields:**

| Field | Type | Purpose |
|-------|------|---------|
| `description` | string | AI-generated product description (engaging, informative, persuasive) |

**AI Model:** `gemini-2.5-flash` (text-only)

**⚠️ Known Issue:** Product form hardcodes `businessType: "Handmade & Crafts"` instead of reading from user profile. See `add-product-form.tsx:122`.

---

### EnhanceProductImage Input/Output

**Input Schema:**

```typescript
const EnhanceProductImageInputSchema = z.object({
  photoDataUri: z.string().describe('Product photo as data URI'),
});
```

**Output Schema:**

```typescript
const EnhanceProductImageOutputSchema = z.object({
  enhancedPhotoDataUri: z.string().describe('Enhanced product photo with background removed'),
});
```

**AI Model:** `gemini-2.5-flash-image-preview`

**Use Case:** Remove background, improve lighting, create professional product shots

---

## Schema Pattern

All schemas in this codebase follow a consistent pattern:

### Frontend Schemas (React Hook Form)

```typescript
// 1. Define Zod schema
const myFormSchema = z.object({
  field1: z.string().min(2, 'Error message'),
  field2: z.number().optional(),
});

// 2. Infer TypeScript type
type MyFormValues = z.infer<typeof myFormSchema>;

// 3. Use with zodResolver
const form = useForm<MyFormValues>({
  resolver: zodResolver(myFormSchema),
  defaultValues: { /* ... */ }
});

// 4. Access in component
<FormField
  control={form.control}
  name="field1"
  render={({ field }) => <Input {...field} />}
/>
```

### AI Flow Schemas (Vercel AI SDK)

```typescript
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { activeTextModel } from '@/ai/provider';

// 1. Define input/output schemas
const InputSchema = z.object({
  field1: z.string().describe('Description for AI'),
});
const OutputSchema = z.object({
  result: z.string().describe('What AI returns'),
});

// 2. Export TypeScript types
export type FlowInput = z.infer<typeof InputSchema>;
export type FlowOutput = z.infer<typeof OutputSchema>;

// 3. Export a plain async function that validates input and uses AI SDK 6
export async function myFlow(input: FlowInput): Promise<FlowOutput> {
  const validatedInput = InputSchema.parse(input);
  const { output } = await generateText({
    model: activeTextModel,
    output: Output.object({ schema: OutputSchema }),
    prompt: `Generate output for ${JSON.stringify(validatedInput)}`,
  });

  return output;
}
```

---

## Common Modifications

### Adding a New Field to Onboarding

1. **Update baseFormSchema** (line 86)
   ```typescript
   newField: z.string().optional(),
   ```

2. **Update form UI** (add FormField component)

3. **Update AI flow** if field affects logo generation

4. **Test validation** thoroughly

### Adding a New Field to Product Form

1. **Update addProductSchema** (line 42)

2. **Add to form UI**

3. **Update AI flow** if field affects description generation

4. **Update future database schema**

### Changing Validation Rules

1. **Edit schema validation** (e.g., change min length)

2. **Update error messages**

3. **Test edge cases**

4. **Update documentation** (this file)

### Adding Conditional Validation

Follow the pattern from `refinedFormSchema`:

```typescript
const mySchema = baseSchema.refine((data) => {
  if (data.condition) {
    return data.dependentField !== undefined;
  }
  return true;
}, {
  message: "Error message here",
  path: ["dependentField"],
});
```

---

## Validation Best Practices

### 1. Always Provide Error Messages

```typescript
// ✅ Good
z.string().min(2, 'Name must be at least 2 characters')

// ❌ Bad
z.string().min(2)
```

### 2. Use Descriptive Messages

```typescript
// ✅ Good
z.string().min(10, 'Description must be at least 10 characters.')

// ❌ Bad
z.string().min(10, 'Too short')
```

### 3. Use `.describe()` for AI Schemas

```typescript
// ✅ Good
z.string().describe('The user's favorite color to influence branding')

// ❌ Bad
z.string() // AI has no context
```

### 4. Coerce When Needed

```typescript
// ✅ Good for form inputs
z.coerce.number().min(0)

// ❌ Bad - form inputs are always strings
z.number().min(0) // Will fail validation
```

### 5. Use Enums for Fixed Options

```typescript
// ✅ Good
z.enum(['draft', 'active'])

// ❌ Bad
z.string() // Allows any value
```

---

## Type Inference

Zod automatically generates TypeScript types:

```typescript
const schema = z.object({
  name: z.string(),
  age: z.number().optional(),
});

type MyType = z.infer<typeof schema>;
// Equivalent to:
// type MyType = {
//   name: string;
//   age?: number | undefined;
// }
```

This ensures your TypeScript types always match your runtime validation.

---

## Testing Schemas

### Unit Testing

```typescript
import { describe, it, expect } from 'vitest';
import { baseFormSchema } from './onboarding-form';

describe('baseFormSchema', () => {
  it('should validate correct data', () => {
    const result = baseFormSchema.safeParse({
      businessName: 'Test Store',
      businessType: 'fashion',
    });
    expect(result.success).toBe(true);
  });

  it('should reject short business names', () => {
    const result = baseFormSchema.safeParse({
      businessName: 'T',
      businessType: 'fashion',
    });
    expect(result.success).toBe(false);
  });
});
```

### Manual Testing

Test API routes directly for AI flow schemas.

---

## Zod v4 Architecture Guidelines

With Baci's migration to **Zod v4**, developers must adhere to the following optimized validation and schema creation patterns:

### 1. Short-Circuiting Defaults vs. Pre-Parsing (`.default()` vs. `.prefault()`)
In Zod v4, the `.default()` method short-circuits the parsing process if the input is `undefined`. It eagerly returns the default value without running any subsequent validation methods (e.g., `.min()`, `.max()`, or custom transformations). The default value is treated as "valid by definition".
- **Use `.default()`** when the default value itself is fully trusted and does not need to be parsed or transformed.
- **Use `.prefault()`** if you need Zod v3-style behavior where the default value is first parsed and validated through subsequent methods before being returned.

```typescript
// Zod v4 Short-Circuit (Default value is not validated by .min)
const nameSchema = z.string().min(3).default(""); 

// Zod v4 Pre-Parsed Default (Default value will trigger .min error)
const strictNameSchema = z.string().min(3).prefault(""); 
```

### 2. Top-Level Tree-Shakable Functions (Deprecated Chaining)
Zod v4 promotes format helpers (like `.email()`, `.uuid()`, `.url()`) to top-level functions to dramatically improve tree-shaking and reduce bundle sizes, especially for frontend client bundles.
- While legacy method-chaining (e.g., `z.email()`) remains supported for compatibility, developers are encouraged to use the new top-level functions for newly created schemas.

```typescript
// Legacy Chained Pattern (Supported but deprecated)
const legacyEmail = z.email({ error: "Invalid email" });

// Modern Zod v4 Pattern (Optimized for Tree-Shaking)
const modernEmail = z.email("Invalid email");
const modernUuid = z.uuid("Invalid UUID");
const modernUrl = z.url("Invalid URL");
```

### 3. Unified Key-Value Requirement for Records
The `z.record()` constructor in Zod v4 strictly requires both the **key** and the **value** schemas to be explicitly defined. This enforces stronger static typing and eliminates ambiguous dictionary types.

```typescript
// ✅ Correct Zod v4 Record schema
const settingsSchema = z.record(z.string(), z.unknown());
```

### 4. Custom Error Messages
- Zod v4 removed the `required_error` and `invalid_type_error` constructor options.
- Use the unified `error` parameter for primitive constructors.
- Use an `error` callback when required and invalid-type messages need to differ.

```typescript
const schema = z.string({
  error: (issue) =>
    issue.input === undefined ? "This field is required" : "Not a valid string",
});
```

---

## Related Documentation

- **Project Overview:** `/AI_CONTEXT.md`
- **Onboarding Flow:** `/src/app/onboarding/_AI_README.md`
- **AI Flows:** `/src/ai/flows/_AI_README.md`
- **Business Types:** `/src/config/business-types.ts`

---

## Questions?

- **Zod Documentation:** https://zod.dev/
- **React Hook Form:** https://react-hook-form.com/get-started

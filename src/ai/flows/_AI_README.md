# AI Flows - Genkit Integration

**Directory:** `/src/ai/flows/`
**Purpose:** Genkit AI flows for merchant dashboard automation
**AI Framework:** Google Genkit 1.20.0

---

## Overview

This directory contains all AI-powered flows using **Google Genkit** as the orchestration layer. Each flow wraps Gemini API calls with structured input/output validation using Zod schemas.

**AI Models Used:**
- `gemini-2.5-flash` - Text generation (product descriptions)
- `gemini-2.5-flash-image-preview` - Image generation and analysis (logos, image enhancement)

---

## Flows Index

| Flow | File | Purpose | Input | Output | Model |
|------|------|---------|-------|--------|-------|
| **guideBusinessOnboarding** | `guide-business-onboarding.ts` | Logo generation + color extraction | businessName, businessType, brandPreferences, optional logoDataUri | logoDataUri, brandColors (5 hex) | gemini-2.5-flash-image-preview |
| **generateProductDescription** | `generate-product-descriptions.ts` | AI product descriptions | productName, businessType, productDetails | description (string) | gemini-2.5-flash |
| **enhanceProductImage** | `enhance-product-images.ts` | Background removal + lighting | photoDataUri | enhancedPhotoDataUri | gemini-2.5-flash-image-preview |

---

## Flow 1: guideBusinessOnboarding

### Purpose
Guides merchants through logo creation and brand color selection during onboarding. Supports two modes:
1. **Generate Logo:** AI creates a logo based on business context and color preferences
2. **Extract Colors:** AI analyzes uploaded logo and extracts brand color palette

### File
`/src/ai/flows/guide-business-onboarding.ts`

### Input Schema

```typescript
{
  businessName: string;         // e.g., "Amara Fashion"
  businessType: string;          // e.g., "fashion", "electronics"
  brandPreferences: string;      // e.g., "deep ocean blue", "warm sunset orange"
  logoDataUri?: string;          // Optional: data:image/png;base64,...
}
```

### Output Schema

```typescript
{
  logoDataUri?: string;          // Generated logo (if created) as data URI
  brandColors: string[];         // Array of exactly 5 hex color codes
}
```

### Brand Colors Order

The 5 colors returned represent:
1. **Primary** - Main brand color
2. **Secondary** - Complementary color
3. **Accent** - Highlight/call-to-action color
4. **Background** - Neutral background
5. **Text** - Dark text color for readability

### Usage Modes

#### Mode 1: Generate Logo

```typescript
const result = await guideBusinessOnboarding({
  businessName: 'Amara Fashion',
  businessType: 'fashion',
  brandPreferences: 'deep ocean blue',
  // logoDataUri: undefined (or omit)
});
// Returns:
// {
//   logoDataUri: 'data:image/png;base64,...',
//   brandColors: ['#3F51B5', '#9C27B0', '#FFC107', '#F5F5F5', '#212121']
// }
```

#### Mode 2: Extract Colors from Uploaded Logo

```typescript
const result = await guideBusinessOnboarding({
  businessName: 'Amara Fashion',
  businessType: 'fashion',
  brandPreferences: '', // Not used in extraction mode
  logoDataUri: 'data:image/png;base64,...' // Uploaded logo
});
// Returns:
// {
//   logoDataUri: undefined, // Not generated
//   brandColors: ['#...', '#...', '#...', '#...', '#...']
// }
```

### Prompts

**✅ Phase 3 Update:** Prompts now include style guidance from business type config.

**Logo Generation Prompt** (lines 166-174, enhanced with config):
```
Generate a simple, modern, and professional logo for a business named "[businessName]".
The business is in the "[businessType]" sector.
The user's favorite color is "[brandPreferences]", so the logo and brand colors should be inspired by this.
After generating the logo, create a 5-color palette (primary, secondary, accent, background, text) based on the generated logo.
Return ONLY the generated image and a JSON object with a "brandColors" key containing an array of 5 hex color strings.
```

**Note:** The actual prompt now includes LOGO STYLE GUIDANCE and COLOR SCHEME GUIDANCE from the business type config (Phase 3).

**Color Extraction Prompt** (lines 109-131):
```
You are an expert branding assistant. Your task is to generate a simple, modern logo and a 5-color brand palette based on the user's input.

Business Name: {{{businessName}}}
Business Type: {{{businessType}}}
Favorite Color: {{{brandPreferences}}}

An existing logo has been provided. Analyze the logo and extract a 5-color palette from it.
The palette should consist of:
1. A primary color.
2. A secondary color.
3. An accent color.
4. A neutral background color.
5. A dark text color.
```

### AI Model
- **Model:** `googleai/gemini-2.5-flash-image-preview`
- **Config:** `responseModalities: ['TEXT', 'IMAGE']`
- **Capabilities:** Image generation, image analysis, structured text output

### Error Handling

1. **JSON Parsing Fails** (line 113-128):
   - Falls back to `extractColorsPrompt` with structured output
   - If still fails, throws error

2. **No Media/Output** (line 105-109):
   - Throws error: "AI failed to generate a logo or brand colors."
   - Logs error with context

3. **Extraction Fails** (line 84-86):
   - Throws error: "Failed to get a structured response from the model when extracting colors."

### Called By
- `/src/app/onboarding/onboarding-form.tsx:172` (Generate logo button)
- `/src/app/onboarding/onboarding-form.tsx:340` (Form submission)

### Future Improvements
- Cache color extraction results to avoid duplicate calls
- Add fallback default palettes if AI fails
- Support more color palette sizes (3, 7, 10 colors)
- Allow user to adjust/refine generated colors

---

## Flow 2: generateProductDescription

### Purpose
Generates compelling, business-type-aware product descriptions using AI. Tailors copy style to the type of business (fashion vs electronics vs handmade, etc.).

### File
`/src/ai/flows/generate-product-descriptions.ts`

### Input Schema

```typescript
{
  productName: string;           // e.g., "Handmade Ceramic Mug"
  businessType: string;          // e.g., "handmade", "fashion", "electronics"
  productDetails: string;        // e.g., "Blue ceramic, 12oz, dishwasher safe"
}
```

### Output Schema

```typescript
{
  description: string;           // AI-generated product description
}
```

### Prompt (lines 36-44)

```
You are an expert copywriter specializing in e-commerce product descriptions.

You will generate a compelling product description based on the provided information, taking into account the business type.

Product Name: {{{productName}}}
Business Type: {{{businessType}}}
Product Details: {{{productDetails}}}

Write a product description that is engaging, informative, and persuasive.
```

### Business Type Context

The `businessType` field influences the AI's writing style:
- **Fashion:** Aspirational, lifestyle-focused, emphasizes style and fit
- **Electronics:** Feature-focused, technical, highlights specs
- **Handmade:** Story-focused, emphasizes craftsmanship and uniqueness
- **Health & Beauty:** Benefit-focused, addresses customer concerns
- **Home Goods:** Lifestyle-focused, how it fits in a home
- **Food & Beverage:** Sensory-focused, emphasizes taste and quality

**✅ Phase 3 Complete:** Flow now automatically reads business type config for prompt customization.

**⚠️ Critical Issue (Phase 4):** Product form hardcodes `businessType: "Handmade & Crafts"` instead of reading from user profile. See `/src/app/dashboard/products/add/add-product-form.tsx:122`.

### AI Model
- **Model:** `googleai/gemini-2.5-flash` (text-only)
- **No image generation/analysis**
- **Faster and cheaper than image preview model**

### Usage Example

```typescript
const result = await generateProductDescription({
  productName: 'Handmade Ceramic Mug',
  businessType: 'handmade',
  productDetails: 'Blue glaze, 12oz capacity, dishwasher safe, made from local clay'
});

console.log(result.description);
// "This beautiful handmade ceramic mug brings artisan craftsmanship to your daily coffee ritual.
// Each piece is lovingly crafted from locally-sourced clay and finished with a stunning blue glaze
// that catches the light. With a generous 12oz capacity and dishwasher-safe design, it combines
// beauty with everyday practicality. No two mugs are exactly alike, making yours truly one-of-a-kind."
```

### Called By
- `/src/app/dashboard/products/add/add-product-form.tsx:119` (Generate with AI button)

### Error Handling
- Logs error to console
- Shows toast notification to user
- Does not crash the form

### Future Improvements
- **Fix hardcoded business type** - Read from user profile (Phase 4, ADR 001)
- Use business type config for description style guidance
- Add tone options (casual, professional, playful)
- Support multiple description lengths (short, medium, long)
- Generate SEO-optimized descriptions
- A/B test different description styles

---

## Flow 3: enhanceProductImage

### Purpose
Enhances product photos by:
1. Removing background (transparent or white)
2. Adjusting lighting to studio quality
3. Making product stand out professionally

### File
`/src/ai/flows/enhance-product-images.ts`

### Input Schema

```typescript
{
  photoDataUri: string;          // data:image/jpeg;base64,...
}
```

### Output Schema

```typescript
{
  enhancedPhotoDataUri: string;  // Enhanced image as data URI
}
```

### Prompt (lines 48-49)

```
The user has uploaded an image of a product for their e-commerce store. Your task is to professionally enhance this image. Isolate the main product by removing the background and making it transparent. Then, adjust the lighting to be bright and even, as if it were taken in a studio, to ensure the product looks appealing and stands out. Return only the enhanced image.
```

### AI Model
- **Model:** `googleai/gemini-2.5-flash-image-preview`
- **Config:** `responseModalities: ['TEXT', 'IMAGE']`
  - **Important:** Must provide both TEXT and IMAGE modalities (line 52 comment)
  - IMAGE-only mode won't work

### Usage Example

```typescript
// User uploads product photo
const file = event.target.files[0];
const reader = new FileReader();
reader.onload = async () => {
  const dataUri = reader.result as string;

  // Enhance the image
  const result = await enhanceProductImage({
    photoDataUri: dataUri
  });

  // Display enhanced version
  setEnhancedImage(result.enhancedPhotoDataUri);
};
reader.readAsDataURL(file);
```

### Called By
- `/src/app/dashboard/products/add/add-product-form.tsx:90` (Automatic on image upload)

### Automatic Enhancement

The product form **automatically enhances** images when uploaded:
1. User selects image file
2. File is converted to data URI
3. `enhanceProductImage` is called immediately
4. Enhanced version is shown with toggle switch
5. User can switch between original and enhanced

### Error Handling

**Line 55-57:**
```typescript
if (!media) {
  throw new Error('no media returned');
}
```

**In Product Form (line 93-100):**
- Catches error
- Shows destructive toast notification
- Keeps original image
- Clears enhanced image state

### Current Limitations

1. **Large File Sizes:** Data URIs are memory-intensive, especially for high-res images
2. **No Preview:** User must wait for enhancement to complete
3. **No Undo:** Can't revert to original after accepting enhanced version
4. **Slow Processing:** Image generation takes 5-15 seconds
5. **Cost:** Image preview model is more expensive than text-only

### Future Improvements
- Upload to Firebase Storage first, pass URLs instead of data URIs
- Show preview/loading indicator during enhancement
- Allow user to adjust enhancement settings (brightness, contrast)
- Batch enhancement for multiple product images
- Cache enhanced images to avoid re-processing
- Compress images before sending to AI
- Add manual crop/rotate before enhancement

---

## Genkit Architecture

### File Structure

```
/src/ai/
├── genkit.ts                          # Genkit initialization, model config
├── dev.ts                             # Development server for Genkit Dev UI
└── flows/
    ├── guide-business-onboarding.ts   # Logo generation + color extraction
    ├── generate-product-descriptions.ts # Product descriptions
    └── enhance-product-images.ts      # Image enhancement
```

### Genkit Initialization

**File:** `/src/ai/genkit.ts`

```typescript
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash', // Default model
});
```

### Development Server

**File:** `/src/ai/dev.ts`

Start Genkit Dev UI:
```bash
npm run genkit:dev
```

Visit: http://localhost:4000

**Features:**
- Test flows with sample inputs
- View flow history and logs
- Inspect input/output schemas
- Debug prompt engineering
- Monitor token usage

---

## Common Patterns

### Flow Definition Pattern

All flows follow this structure:

```typescript
// 1. Import Genkit
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// 2. Define schemas
const InputSchema = z.object({ /* ... */ });
const OutputSchema = z.object({ /* ... */ });

// 3. Export types
export type FlowInput = z.infer<typeof InputSchema>;
export type FlowOutput = z.infer<typeof OutputSchema>;

// 4. Export flow function
export async function flowName(input: FlowInput): Promise<FlowOutput> {
  return flowNameFlow(input);
}

// 5. Define internal flow
const flowNameFlow = ai.defineFlow({
  name: 'flowNameFlow',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
}, async (input) => {
  // AI generation logic
  const { output } = await ai.generate({ /* ... */ });
  return output;
});
```

### Prompt Engineering Pattern

#### For Structured Output (Preferred)

```typescript
const prompt = ai.definePrompt({
  name: 'myPrompt',
  input: { schema: InputSchema },
  output: { schema: OutputSchema },
  prompt: `Detailed instructions with {{{variables}}}`,
});

const { output } = await prompt(input);
return output!; // Zod-validated
```

#### For Free-Form Generation

```typescript
const { output, media } = await ai.generate({
  model: 'googleai/gemini-2.5-flash-image-preview',
  prompt: [
    { text: 'Instructions here' },
    { media: { url: imageDataUri } } // Optional image input
  ],
  config: {
    responseModalities: ['TEXT', 'IMAGE']
  }
});
```

---

## Testing AI Flows

### Using Genkit Dev UI (Recommended)

```bash
npm run genkit:dev
```

1. Open http://localhost:4000
2. Select flow from dropdown
3. Enter sample input (JSON format)
4. Click "Run"
5. View output and logs

### Programmatic Testing

```typescript
import { guideBusinessOnboarding } from '@/ai/flows/guide-business-onboarding';

async function testFlow() {
  const result = await guideBusinessOnboarding({
    businessName: 'Test Store',
    businessType: 'fashion',
    brandPreferences: 'royal blue',
  });

  console.log('Logo:', result.logoDataUri?.substring(0, 50));
  console.log('Colors:', result.brandColors);
}
```

### Test Cases

#### guideBusinessOnboarding
- ✅ Generate logo with valid inputs
- ✅ Extract colors from uploaded logo
- ❌ Handle missing businessName
- ❌ Handle invalid logoDataUri format
- ❌ Handle AI failure gracefully

#### generateProductDescription
- ✅ Generate description for all business types
- ✅ Handle empty productDetails
- ❌ Handle very long product names (token limits)
- ❌ Test description quality/style

#### enhanceProductImage
- ✅ Enhance image with transparent background
- ❌ Handle very large images
- ❌ Handle unsupported image formats
- ❌ Test enhancement quality

---

## Error Handling

### AI Flow Errors

All flows can throw these errors:

1. **Network Errors:** API timeout, connection issues
2. **Model Errors:** Rate limits, quota exceeded
3. **Validation Errors:** Output doesn't match schema
4. **Content Errors:** AI refuses to generate (policy violation)

### Handling in Components

```typescript
try {
  const result = await guideBusinessOnboarding(input);
  // Use result
} catch (error) {
  logger.error({ error, message: 'Flow failed' });
  toast({
    title: 'AI Error',
    description: 'Could not generate logo. Please try again.',
    variant: 'destructive'
  });
  // Fallback behavior
}
```

### Current Error Handling Issues

1. **Silent Failures:** Logo generation fails without user notification
2. **No Retry Logic:** Single failure = complete failure
3. **No Fallbacks:** No default logos or colors when AI fails
4. **Generic Error Messages:** Users don't know what went wrong

---

## Cost & Performance

### Model Pricing (Approximate)

| Model | Input | Output | Use Case |
|-------|-------|--------|----------|
| gemini-2.5-flash | Low | Low | Text generation (descriptions) |
| gemini-2.5-flash-image-preview | Medium | High | Image generation/analysis |

### Token Usage

- **Logo Generation:** ~500-1000 tokens (includes image output)
- **Color Extraction:** ~200-500 tokens (includes image input)
- **Product Description:** ~100-300 tokens
- **Image Enhancement:** ~500-1000 tokens (includes image I/O)

### Optimization Strategies

1. **Cache Results:** Don't regenerate the same content
2. **Compress Images:** Reduce data URI size before sending
3. **Batch Requests:** Group multiple operations when possible
4. **Use Cheaper Models:** Use text-only model when images not needed
5. **Lazy Loading:** Generate content only when needed, not preemptively

---

## Business Type Integration

### Current State (Hardcoded)

Business types passed to AI flows are currently hardcoded strings:
- `guideBusinessOnboarding`: Reads from onboarding form
- `generateProductDescription`: **Hardcoded to "Handmade & Crafts"** ⚠️

### Future State (Configuration-Driven)

**After Phase 3 of ADR 001:**

Import business type config:
```typescript
import { getBusinessTypeById, getAIPromptContext } from '@/config/business-types';

// In flow
const config = getBusinessTypeById(input.businessType);
const context = config.aiPromptContext;
const style = config.journey.productCreation.aiDescriptionStyle;

// Use in prompt
const prompt = `Generate a ${style} description for this ${context} product...`;
```

This will make AI prompts automatically adapt to each business type's style.

---

## Common Modifications

### Adding a New Flow

1. **Create file:** `/src/ai/flows/my-new-flow.ts`

2. **Define schemas:**
```typescript
const InputSchema = z.object({ /* ... */ });
const OutputSchema = z.object({ /* ... */ });
export type MyFlowInput = z.infer<typeof InputSchema>;
export type MyFlowOutput = z.infer<typeof OutputSchema>;
```

3. **Create flow:**
```typescript
const myFlow = ai.defineFlow({
  name: 'myFlow',
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
}, async (input) => {
  const { output } = await ai.generate({ /* ... */ });
  return output;
});

export async function myNewFlow(input: MyFlowInput): Promise<MyFlowOutput> {
  return myFlow(input);
}
```

4. **Test in Genkit Dev UI**

5. **Call from component:**
```typescript
import { myNewFlow } from '@/ai/flows/my-new-flow';

const result = await myNewFlow({ /* ... */ });
```

### Modifying a Prompt

1. **Find prompt definition** (look for `ai.definePrompt` or inline prompt in `ai.generate`)

2. **Edit prompt text** carefully
   - Use clear, specific instructions
   - Provide context and examples
   - Specify output format

3. **Test with multiple inputs** in Genkit Dev UI

4. **Check output quality** - does it match expectations?

5. **Update output schema** if needed

### Changing AI Model

```typescript
// From:
model: 'googleai/gemini-2.5-flash'

// To:
model: 'googleai/gemini-pro' // or other model
```

**Caution:**
- Different models have different capabilities
- Pricing varies significantly
- Response quality may differ
- Token limits may differ

---

## AI Assistant Guidelines

### Before Modifying Flows

1. **Read this file completely**
2. **Check `/AI_CONTEXT.md`** for project-wide rules
3. **Review schema docs** in `/src/schemas/README.md`
4. **Test in Genkit Dev UI** before deploying

### When Creating New Flows

1. **Define clear input/output schemas** with descriptions
2. **Export TypeScript types** for type safety
3. **Add error handling** with user-friendly messages
4. **Document in this file** with examples
5. **Test with edge cases**

### When Modifying Prompts

1. **Be specific** - vague prompts produce vague results
2. **Provide context** - business type, user intent, constraints
3. **Show examples** - especially for structured output
4. **Test variations** - AI output is probabilistic
5. **Monitor quality** - check multiple generations

### Common Pitfalls

- ❌ Changing schema without updating callers
- ❌ Not handling AI failures
- ❌ Using wrong model for task (text vs image)
- ❌ Forgetting to test with all business types
- ❌ Not documenting new flows

---

## Related Documentation

- **Project Overview:** `/AI_CONTEXT.md`
- **Schema Definitions:** `/src/schemas/README.md`
- **Onboarding Flow:** `/src/app/onboarding/_AI_README.md`
- **Business Type Config:** `/src/config/business-types.ts`
- **ADR 001:** `/docs/adr/001-business-type-journey-architecture.md`

---

## External Resources

- **Genkit Docs:** https://firebase.google.com/docs/genkit
- **Gemini API:** https://ai.google.dev/docs
- **Prompt Engineering:** https://ai.google.dev/docs/prompt_best_practices
- **Zod Validation:** https://zod.dev/

---

## Questions?

For AI assistants:
1. Check this file for flow-specific guidance
2. Check `/AI_CONTEXT.md` for project-wide rules
3. Test in Genkit Dev UI: `npm run genkit:dev`
4. Ask user if documentation is unclear

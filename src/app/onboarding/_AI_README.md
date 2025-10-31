# Onboarding Flow - AI Context

**Directory:** `/src/app/onboarding/`
**Purpose:** Merchant onboarding wizard for business setup
**Entry Point:** `page.tsx` → renders `OnboardingForm` component

---

## Overview

This directory contains the 3-step onboarding flow that collects:
1. **Business name** (min 2 characters)
2. **Business type** (6 predefined categories + custom)
3. **Logo** (upload existing OR generate with AI)

The flow integrates with AI to generate logos and extract brand colors, setting up the merchant's visual identity.

---

## Files in This Directory

| File | Lines | Purpose |
|------|-------|---------|
| `page.tsx` | ~30 | Route wrapper, renders onboarding page layout |
| `onboarding-form.tsx` | 456 | **Main form component** with all business logic |

---

## Onboarding Form Architecture

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Business Name                                        │
│ - Input: businessName (string, min 2 chars)                  │
│ - Validation: baseFormSchema.pick({ businessName: true })    │
│ - Next: Enabled after validation                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Business Type                                        │
│ - Dropdown: fashion | electronics | home-goods | ...         │
│ - Conditional: Show "otherBusinessType" input if "other"     │
│ - Validation: refinedFormSchema (checks "other" is filled)   │
│ - Next: Enabled after validation                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Logo & Branding                                      │
│                                                               │
│ ┌─────────────────────┐     OR     ┌─────────────────────┐  │
│ │ Upload Logo         │            │ Generate with AI    │  │
│ │ - User uploads file │            │ - Enter color pref  │  │
│ │ - AI extracts colors│            │ - AI generates logo │  │
│ └─────────────────────┘            └─────────────────────┘  │
│                                                               │
│ Both call: guideBusinessOnboarding AI flow                   │
│ Returns: logoDataUri + 5 brandColors (hex codes)             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Submit                                                        │
│ - Calls: guideBusinessOnboarding again (redundant)           │
│ - Shows toast: "Store Created!"                              │
│ - Redirects: /dashboard                                      │
│ ⚠️  Data NOT saved to database (no Firestore yet)           │
└─────────────────────────────────────────────────────────────┘
```

### Form State Management

The form uses **React Hook Form** with **FormProvider** to share state across steps:

```typescript
const form = useForm<OnboardingFormValues>({
  resolver: zodResolver(
    step === 1 ? baseFormSchema.pick({ businessName: true }) :
    step === 2 ? refinedFormSchema.pick({ businessType, otherBusinessType }) :
    refinedFormSchema
  ),
  defaultValues: { /* ... */ }
});
```

- **Step 1:** Validates only `businessName`
- **Step 2:** Validates `businessType` and conditional `otherBusinessType`
- **Step 3:** Validates all fields

This allows progressive validation without blocking user progress.

---

## Business Types (Configuration-Driven ✅)

**Location:** Dynamically loaded from `/src/config/business-types.ts`
**Implementation:** `onboarding-form.tsx:167-172`

```tsx
{getAllBusinessTypes().map((type) => (
  <SelectItem key={type.id} value={type.id}>
    {type.label}
  </SelectItem>
))}
<SelectItem value="other">Other</SelectItem>
```

**Phase 2 Status:** ✅ COMPLETE (ADR 001)

### ⚠️ Critical: Business Type Dependencies

When you change business types in `/src/config/business-types.ts`, you affect:

1. **Onboarding Form Dropdown** - ✅ Automatically updated (reads from config)

2. **Product Description AI** - `/src/ai/flows/generate-product-descriptions.ts`
   - ✅ Phase 3 COMPLETE: Prompt automatically uses business type context from config
   - ⚠️ Phase 4: Product form still hardcodes business type to "Handmade & Crafts"

3. **Product Creation Form** - `/src/app/dashboard/products/add/add-product-form.tsx:122`
   - ⏳ Phase 4: Hardcodes business type instead of reading from user profile

4. **Future Template Selection** - Not yet implemented
   - Will map business type to storefront template

### ✅ Configuration-Driven (Phase 2 Complete)

**See ADR 001:** `/docs/adr/001-business-type-journey-architecture.md`

Business types are now imported from `/src/config/business-types.ts`. To add a new business type:

1. **Edit config file:** `/src/config/business-types.ts`
2. **Add new entry** to `BUSINESS_TYPES` object
3. **Test onboarding flow** - dropdown automatically includes new type
4. **No code changes needed** in this component!

---

## AI Integration

### Logo Generation Flow

**File:** `/src/ai/flows/guide-business-onboarding.ts`

**Called from:** `onboarding-form.tsx:172-187` (Step 3, Generate button)

```typescript
const result = await guideBusinessOnboarding({
  businessName: 'Amara Fashion',
  businessType: 'fashion', // or custom type
  brandPreferences: 'deep ocean blue',
  // logoDataUri: undefined (generating new logo)
});
// Returns: { logoDataUri: 'data:image/png;base64,...', brandColors: ['#...', ...] }
```

**AI Model:** `gemini-2.5-flash-image-preview`
**Output:**
- Logo as data URI (Base64 encoded PNG/JPG)
- 5 brand colors as hex codes: primary, secondary, accent, background, text

### Color Extraction Flow

**Called from:** `onboarding-form.tsx:340-345` (Submit handler)

When user uploads a logo:

```typescript
const result = await guideBusinessOnboarding({
  businessName: 'Amara Fashion',
  businessType: 'fashion',
  brandPreferences: '', // not needed for extraction
  logoDataUri: 'data:image/png;base64,...', // uploaded logo
});
// Returns: { logoDataUri: same as input, brandColors: ['#...', ...] }
```

**AI Model:** `gemini-2.5-flash-image-preview`
**Output:** 5 extracted brand colors from the logo

### ⚠️ Known Issue: Duplicate AI Calls

**Problem:** Color extraction happens twice:
1. Line 172-187: When user uploads logo (preview)
2. Line 340-345: On form submit

**Impact:**
- Unnecessary API costs
- Slower submission
- Potential inconsistent color results

**Fix:** Cache color extraction results in form state, skip on submit if already extracted.

---

## Zod Schemas

### baseFormSchema (Line 86)

```typescript
{
  businessName: string (min 2),
  businessType: string (min 1),
  otherBusinessType?: string,
  brandPreferences?: string,
  logo?: any
}
```

### refinedFormSchema (Line 103)

Adds conditional validation:
- If `businessType === 'other'`, then `otherBusinessType` must be:
  - Present (not undefined)
  - At least 2 characters

**Validation Error:** Shown on `otherBusinessType` field if invalid.

---

## Key Functions

### handleNext() (Line 376-386)

Validates current step fields and advances to next step.

**Logic:**
- Step 1: Validates `businessName`
- Step 2: Validates `businessType` and `otherBusinessType`
- If valid → `setStep(step + 1)`

### handleGenerateLogo() (Line 203-227)

Triggers AI logo generation.

**Steps:**
1. Validates `brandPreferences` field (favorite color)
2. Gets form values: `businessName`, `businessType`, `brandPreferences`
3. If business type is "other", uses `otherBusinessType` instead
4. Calls `guideBusinessOnboarding` AI flow
5. Sets generated logo in form state
6. Displays logo preview

**Error Handling:** Logs error, shows nothing to user (should show toast).

### onSubmit() (Line 390-421)

Final form submission handler.

**Steps:**
1. Validates entire form
2. Determines final business type (handles "other")
3. Calls `guideBusinessOnboarding` AI flow **again** (redundant if already called)
4. Shows success toast
5. Redirects to `/dashboard`

**⚠️ ISSUE:** Data not persisted! No database integration yet.

---

## Testing Checklist

When modifying this component, test:

### Basic Flow
- ✅ Step 1: Enter business name, click Next
- ✅ Step 2: Select each business type, click Next
- ✅ Step 2: Select "Other", verify custom field appears
- ✅ Step 2: Submit "Other" without custom name → should show error
- ✅ Step 3: Upload logo → verify preview shows
- ✅ Step 3: Click "Generate with AI" → enter color → verify logo generates
- ✅ Submit → verify redirect to /dashboard

### Edge Cases
- ❌ Business name < 2 characters → should block Next
- ❌ Business type not selected → should block Next
- ❌ Logo generation fails → should show error (currently silent)
- ❌ Color extraction fails → should show error (currently silent)
- ❌ Submit without logo → currently allowed, should it be?

### AI Integration
- ✅ Generated logo displays correctly
- ✅ Uploaded logo displays correctly
- ✅ Color extraction returns 5 hex codes
- ✅ Fallback works if AI fails (currently throws error)

### Validation
- ✅ All Zod errors display in UI
- ✅ Step-by-step validation doesn't validate future steps
- ✅ "Other" business type validation works

---

## Common Modifications

### Adding a New Business Type

**✅ Now Configuration-Driven (Phase 2 Complete):**

1. **Edit config:** `/src/config/business-types.ts`
   ```typescript
   NEW_TYPE: {
     id: 'new-type',
     label: 'New Type Label',
     description: 'Description here',
     aiPromptContext: 'context for AI',
     icon: LucideIconName,
     journey: { /* onboarding and product config */ }
   }
   ```

2. **Test onboarding flow** - Dropdown automatically includes new type

3. **Future (Phase 3):** AI prompts will automatically read from config

**That's it!** No changes needed in this component.

### Removing a Business Type

**⚠️ WARNING:** Don't remove types if existing users have selected them!

1. Remove from dropdown (or config file)
2. Add database migration for users with removed type
3. Map old type to new type or "other"

### Changing AI Logo Generation Prompt

**Don't do it here!** Edit the AI flow:
- File: `/src/ai/flows/guide-business-onboarding.ts`
- Lines: 49-71 (prompt definition)
- Lines: 93-98 (inline generation prompt)

### Adding a New Onboarding Step

1. Increment `totalSteps` (currently 3)
2. Add new schema fields to `baseFormSchema`
3. Create new `Step4_ComponentName()` function
4. Add conditional render in form: `{step === 4 && <Step4_ComponentName />}`
5. Update `handleNext()` to validate new step
6. Test extensively!

---

## Known Issues & Gotchas

### 1. Data Not Persisted (Critical)
**Location:** Line 390-421 (`onSubmit`)
**Issue:** Form submission doesn't save data to database
**Workaround:** None - data is lost on page refresh
**Fix:** Implement Firestore integration, save merchant profile

### 2. Duplicate AI Calls
**Location:** Lines 172 and 340
**Issue:** Color extraction called twice for uploaded logos
**Workaround:** None
**Fix:** Cache results in state, skip second call

### 3. Business Type Not Stored
**Issue:** User's business type not saved anywhere
**Impact:** Product form hardcodes business type (line 122 of product form)
**Fix:** Save in user profile, read in product form

### 4. Silent AI Failures
**Location:** Lines 172-187, 340-345
**Issue:** AI failures logged but not shown to user
**Impact:** User sees nothing, doesn't know what happened
**Fix:** Show toast notification on error

### 5. No Logo Requirement
**Issue:** Users can submit without logo
**Question:** Is this intended? Should logo be required?
**Decision:** TBD

### 6. Large Data URIs in State
**Issue:** Base64 encoded images are memory-intensive
**Impact:** Large form state, potential performance issues
**Fix:** Upload images to Firebase Storage, use URLs instead

---

## Related Files

| File | Relationship |
|------|-------------|
| `/src/ai/flows/guide-business-onboarding.ts` | AI flow called by this form |
| `/src/config/business-types.ts` | Future source of business type definitions |
| `/src/app/dashboard/products/add/add-product-form.tsx` | Uses business type for AI prompts |
| `/docs/adr/001-business-type-journey-architecture.md` | Architecture decision for business types |

---

## AI Assistant Guidelines

### Before Modifying

1. **Read this file completely** to understand current architecture
2. **Check `/AI_CONTEXT.md`** for project-wide rules
3. **Review ADR 001** if changing business type logic
4. **Test all 3 steps** after any changes

### Common Tasks

**Change validation:**
- Edit Zod schemas (lines 86-111)
- Test edge cases thoroughly
- Update JSDoc comments

**Modify UI:**
- Each step is a separate component (Step1_, Step2_, Step3_)
- Use existing form components from `/src/components/ui/`
- Keep business logic in handlers, not in step components

**Change AI integration:**
- Edit AI flow file, not this component
- Update input/output types if schema changes
- Test with multiple business types

**Add new field:**
- Add to `baseFormSchema`
- Add to form UI in appropriate step
- Update validation logic in `handleNext()`
- Test required vs optional behavior

### Testing Commands

```bash
# Run dev server
npm run dev

# Test Genkit AI flows in UI
npm run genkit:dev
# Visit: http://localhost:4000

# Type check
npm run typecheck
```

---

## Questions?

- **Project-wide context:** `/AI_CONTEXT.md`
- **Architecture decisions:** `/docs/adr/`
- **AI flow details:** `/src/ai/flows/_AI_README.md`
- **Schema documentation:** `/src/schemas/README.md`

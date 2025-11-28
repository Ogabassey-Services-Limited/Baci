# ADR 001: Business Type Journey Architecture

**Status:** Accepted
**Date:** 2025-11-28
**Author:** System Architecture
**Related Files:**
- `/src/config/business-types.ts`
- `/src/app/onboarding/onboarding-form.tsx`
- `/src/ai/flows/guide-business-onboarding.ts`
- `/src/ai/flows/generate-product-descriptions.ts`

---

## Context

The Baci e-commerce platform supports multiple business categories (Fashion, Electronics, Home Goods, Health & Beauty, Handmade, Food & Beverage). Currently, all business types share:
- The same onboarding flow
- The same product creation form
- Generic AI prompts
- No category-specific features or templates

### Problems with Current Approach

1. **Hardcoded Business Types:** Business types are defined in the onboarding form UI component (line 106-112), making it difficult to add new types or modify existing ones.

2. **Generic AI Prompts:** AI flows don't leverage business type context effectively. For example, product descriptions for fashion items should emphasize style and fit, while electronics should focus on specifications.

3. **No Customization:** A fashion store and an electronics store have very different needs:
   - Fashion: Size charts, color variants, model shots
   - Electronics: Spec sheets, warranty info, compatibility

4. **Hardcoded Business Type in Product Creation:** The product form hardcodes business type to "Handmade & Crafts" (line 122) instead of reading from the user's profile.

5. **No Template System:** All storefronts will look the same regardless of business category.

### Why This Needs to Change

As the platform scales, we need:
- **Rapid addition of new business types** without code changes
- **Tailored experiences** for each business category
- **AI that understands context** and generates appropriate content
- **Type-safe configuration** to prevent runtime errors
- **Single source of truth** for business type definitions

---

## Decision

We will implement a **configuration-driven business type system** with the following architecture:

### 1. Central Configuration File

**File:** `/src/config/business-types.ts`

All business types will be defined in a single TypeScript configuration file with:
- Unique ID and label
- AI prompt context strings
- Journey configurations for onboarding and product creation
- Recommended features per type
- Template IDs for storefront selection (future)
- Icons for UI representation

### 2. Journey Definition Objects

Each business type will have a `journey` object defining:

```typescript
journey: {
  onboarding: {
    logoStyle: string;         // AI prompt guidance for logo generation
    colorScheme: string;        // AI prompt guidance for colors
    additionalSteps?: string[]; // Extra onboarding steps (future)
  },
  productCreation: {
    requiredFields?: string[];      // Type-specific form fields
    aiDescriptionStyle: string;     // How AI should write descriptions
    imageRequirements: string;      // Image guidance for merchants
  }
}
```

### 3. Helper Functions

The config file will export utility functions:
- `getBusinessTypeById(id)` - Retrieve config by ID
- `getAllBusinessTypes()` - Get all types as array
- `isValidBusinessTypeId(id)` - Validation
- `getAIPromptContext(id)` - Get AI prompt context
- `getProductDescriptionStyle(id)` - Get description style guidance

### 4. Migration Path

**Phase 1: Create Configuration ✅ COMPLETE**
- ✅ Create `/src/config/business-types.ts`
- ✅ Define all 7 business types with journeys
- ✅ Export helper functions

**Phase 2: Update Onboarding Form ✅ COMPLETE**
- ✅ Import `getAllBusinessTypes()` from config
- ✅ Replace hardcoded `<SelectItem>` list with dynamic mapping
- ✅ Store business type in user profile (requires Supabase)

**Phase 3: Update AI Flows ✅ COMPLETE**
- ✅ Modified `generate-product-descriptions.ts` to use business type context from config
- ✅ Flow uses `getProductDescriptionStyle(id)` and `getAIPromptContext(id)` for enhanced prompts
- ✅ Modified `guide-business-onboarding.ts` to use journey.onboarding config for logo style and color scheme

**Phase 4: Update Product Form ✅ COMPLETE**
- ✅ Read business type from user profile context (`useMerchant` hook)
- ✅ Pass actual business type to AI flows instead of hardcoding
- ⏳ Add type-specific form fields based on `journey.productCreation.requiredFields` (Future)

**Phase 5: Template System (Future)**
- Create storefront templates per business type
- Use `templateId` from config for template selection
- Allow merchants to preview and customize templates

---

## Consequences

### Positive

1. **Single Source of Truth:** All business type definitions in one file reduces bugs and inconsistencies.

2. **Type Safety:** TypeScript ensures all references to business types are valid at compile time.

3. **Easy to Extend:** Adding a new business type is a simple config change, no code modifications needed.

4. **AI Context:** AI flows can read journey configurations and generate context-appropriate content.

5. **Testability:** Config can be easily unit tested. Mock different business types in tests.

6. **Documentation:** Configuration serves as living documentation of supported business types.

7. **Migration Friendly:** Can be implemented incrementally without breaking existing features.

### Negative

1. **Refactoring Required:** Need to update onboarding form, AI flows, and product form to read from config.

2. **Database Schema:** Requires storing business type in user profile (Supabase schema change).

3. **Breaking Change Risk:** Changing IDs in config could break existing data (needs migration strategy).

4. **Complexity:** More abstraction means more indirection. Developers need to understand the config system.

5. **Icon Dependencies:** Using Lucide icons in config file creates a dependency that might not be ideal for a pure config file.

### Mitigation Strategies

- **Gradual Migration:** Implement in phases, test each phase thoroughly.
- **ID Stability:** Once IDs are set, never change them. Add new types instead.
- **Version Control:** Track config changes carefully in git.
- **Documentation:** Create comprehensive docs (this ADR, AI_CONTEXT.md, component READMEs).

---

## Alternatives Considered

### Alternative 1: Database-Driven Configuration

**Approach:** Store business types in Supabase/database instead of code.

**Pros:**
- Dynamic addition of types without deployment
- Admin UI for managing types
- Can be modified by non-developers

**Cons:**
- Requires admin UI
- No TypeScript type safety
- Harder to version control
- Runtime errors instead of compile-time errors
- Overkill for a relatively static list

**Rejected because:** Business types change infrequently and benefit from type safety.

### Alternative 2: Separate Files Per Type

**Approach:** Create `/src/config/business-types/fashion.ts`, etc.

**Pros:**
- Clear separation of concerns
- Each type is fully independent
- Easier to find specific type config

**Cons:**
- Harder to see all types at once
- More files to maintain
- Harder to enforce consistency
- Requires dynamic imports or index file

**Rejected because:** Single file is easier to maintain and provides better overview.

### Alternative 3: Keep Current Approach (Hardcoded)

**Approach:** Continue with hardcoded business types in components.

**Pros:**
- No refactoring needed
- Simple and straightforward
- Easy to understand

**Cons:**
- Doesn't scale
- Inconsistent AI prompts
- No type-specific customization
- Hard to add new types
- Code duplication

**Rejected because:** Doesn't meet requirements for customization and scalability.

### Alternative 4: Plugin/Extension System

**Approach:** Allow business types to be registered as plugins with hooks.

**Pros:**
- Maximum flexibility
- Third-party extensions possible
- Clean separation

**Cons:**
- Massive over-engineering
- Complex to implement
- Not needed for current scale
- Runtime complexity

**Rejected because:** Way too complex for current needs.

---

## Implementation Notes

### Adding a New Business Type

1. Open `/src/config/business-types.ts`
2. Add new entry to `BUSINESS_TYPES` object:
   ```typescript
   NEW_TYPE: {
     id: 'new-type',
     label: 'New Type Label',
     description: '...',
     aiPromptContext: '...',
     recommendedFeatures: [...],
     templateId: 'template-id',
     icon: LucideIconName,
     journey: { /* ... */ }
   }
   ```
3. TypeScript will auto-complete and validate
4. No other code changes needed (after Phase 2 migration)

### Modifying an Existing Type

1. Find the type in `/src/config/business-types.ts`
2. Modify the fields you need
3. **NEVER change the `id` field** - this will break existing data
4. Test AI flows with the modified config
5. Update tests if needed

### Accessing Config in Components

```typescript
import { getBusinessTypeById, getAllBusinessTypes } from '@/config/business-types';

// In a component
const userBusinessType = 'fashion'; // from user profile
const config = getBusinessTypeById(userBusinessType);

// Use in UI
<p>{config.label}</p>
<config.icon className="w-4 h-4" />

// Use in AI prompts
const context = config.aiPromptContext;
const style = config.journey.productCreation.aiDescriptionStyle;
```

### Testing

```typescript
import { isValidBusinessTypeId, getAllBusinessTypeIds } from '@/config/business-types';

describe('BusinessTypes', () => {
  it('should validate known types', () => {
    expect(isValidBusinessTypeId('fashion')).toBe(true);
    expect(isValidBusinessTypeId('invalid')).toBe(false);
  });

  it('should return all type IDs', () => {
    const ids = getAllBusinessTypeIds();
    expect(ids).toContain('fashion');
    expect(ids).toContain('electronics');
  });
});
```

---

## AI Context

### For AI Assistants Working on This Codebase

1. **ALWAYS check `/src/config/business-types.ts` first** when working with business types.

2. **NEVER hardcode business type values** in components or AI flows. Always import from config.

3. **When adding a new business type:**
   - Update `/src/config/business-types.ts` FIRST
   - Test with all AI flows to ensure prompts work correctly
   - Verify dropdown appears in onboarding form (after Phase 2)

4. **When modifying AI prompts:**
   - Check if the prompt should be business-type-specific
   - Use `getAIPromptContext()` or `getProductDescriptionStyle()` from config
   - Test with at least 3 different business types

5. **When creating new features:**
   - Check if the feature should be business-type-specific
   - Check `recommendedFeatures` array in config
   - Consider adding to the journey configuration

6. **Breaking changes to avoid:**
   - Changing the `id` field (breaks database references)
   - Removing a business type (breaks existing user data)
   - Changing the structure of journey objects (breaks consuming code)

---

## References

- **Related ADRs:** None (this is the first)
- **Related Issues:** N/A
- **Related PRs:** N/A
- **External Resources:**
  - [ADR Best Practices](https://github.com/joelparkerhenderson/architecture-decision-record)
  - [Configuration-Driven Development](https://martinfowler.com/articles/configurationDrivenDevelopment.html)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-10-31 | Initial ADR creation | System |

---

**Next Steps:**
1. ✅ Create `/src/config/business-types.ts`
2. ✅ Migrate onboarding form to use config
3. ✅ Update AI flows to read from config (Phase 3)
4. ⏳ Implement user profile storage (Supabase)
5. ⏳ Update product form to read user's business type (Phase 4)
6. ⏳ Create template system (Phase 5)

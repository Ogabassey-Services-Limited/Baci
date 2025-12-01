# Baci E-commerce Platform - AI Coding Assistant Rules
## ⚠️ CRITICAL: Pre-Implementation Checklist
**BEFORE implementing ANY code changes, you MUST:**
1. **✅ Verify Implementation Strategy**
   - Is this the **best** approach to solve the problem in 2025?
   - Does it follow best practices for security and accessibility in 2025?
   - Is this the **fastest** way to implement it?
   - Have you checked for existing solutions in the codebase?
   - Are there simpler alternatives that achieve the same goal?
   - **If unsure, ASK the user to confirm the approach before proceeding**
2. **✅ Use Latest Versions & Modern APIs**
   - All dependencies should use their latest stable versions (except Tailwind CSS 3.x which is intentional)
   - Use modern JavaScript/TypeScript features (async/await, optional chaining, nullish coalescing)
   - Prefer Next.js 15+ App Router patterns over legacy Pages Router

3. **✅ Technical SEO & Performance First**
   - Generate JSON-LD structured data for all public pages (Product, Organization, BreadcrumbList, etc.)
   - Use semantic HTML5 elements (`<article>`, `<section>`, `<nav>`, `<header>`, `<footer>`, `<aside>`)
   - Add proper heading hierarchy (single `<h1>`, then `<h2>`, `<h3>`, etc.)
   - Include descriptive meta tags (title, description, Open Graph, Twitter Cards)
   - Ensure canonical URLs are set correctly
   - Optimize images (Next.js `<Image>`, WebP format, proper dimensions, lazy loading)
4. **✅ WCAG 2.1 AA Accessibility Compliance**
   - Color contrast ratio minimum 4.5:1 for normal text, 3:1 for large text
   - All interactive elements must be keyboard accessible (proper tabindex, focus states)
   - Use semantic HTML and ARIA labels where appropriate
   - Images must have meaningful `alt` text (or `alt=""` for decorative images)
   - Form inputs must have associated `<label>` elements
   - Error messages must be announced to screen readers
   - Focus indicators must be visible on all interactive elements
5. **✅ Security Principles**
   - Sanitize all URLs and external links (use `rel="noopener noreferrer nofollow"` for untrusted links)
   - Validate and sanitize all user inputs (use Zod schemas)
   - Sanitize AI-generated HTML content (use DOMPurify)
   - Never expose secrets or API keys in client code
   - Use HTTPS for all external resources
   - Implement CSRF protection for forms
   - Follow principle of least privilege for database access (RLS policies)
6. **✅ Semantic HTML & List Structures**
   - Use `<ul>` for unordered lists, `<ol>` for ordered lists
   - Use `<dl>`, `<dt>`, `<dd>` for definition/description lists
   - Avoid `<div>` soup - use semantic elements (`<article>`, `<section>`, `<aside>`)
   - Use `<button>` for actions, `<a>` for navigation
   - Tables should use `<thead>`, `<tbody>`, `<th>`, `<td>` properly
---
## Project Identity
You are working on **Baci**, an AI-native e-commerce platform that enables Nigerian merchants to create complete online stores in under 3 minutes. The platform leverages Google Gemini for intelligent automation, Supabase for backend infrastructure, and Next.js for the storefront.
**Core Philosophy:** "Your business, live in 3 minutes"
**Technical Excellence Standards:**
- ⚡ Performance: Core Web Vitals optimized (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- ♿ Accessibility: WCAG 2.1 AA compliant
- 🔒 Security: OWASP Top 10 mitigated
- 📈 SEO: Structured data, semantic HTML, optimized metadata
- 🎨 UX: Mobile-first, responsive, intuitive
---
## Tech Stack (Version Accuracy Matters)
### Frontend
- **Framework:** Next.js 16.0.6+ (App Router, **not** Pages Router)
- **React:** 19.2.0+
- **TypeScript:** Strict mode enabled
- **Styling:** Tailwind CSS 3.x + shadcn/ui components
- **State Management:** React hooks (`useState`, `useContext`), Zustand for global state
- **Forms:** React Hook Form + Zod validation
- **Animations:** Framer Motion
### Backend & Database
- **Platform:** Supabase (PostgreSQL)
- **Auth:** `@supabase/ssr` (Server-side safe)
- **Storage:** Supabase Storage for images/assets
- **API Routes:** Next.js App Router API handlers
### AI & Integrations
- **Provider:** `@ai-sdk/google` (Google Gemini)
- **Models:**
  - `gemini-2.5-flash`
  - `gemini-2.5-pro` 
- **Payment:** Paystack (Nigerian market) , Korapay (Multi country)
- **CMS:** @measured/puck (visual page builder)
---
## Code Architecture & Patterns
### Directory Structure
```
src/
├── app/                      # Next.js App Router pages
│   ├── (storefront)/        # Customer-facing routes
│   ├── api/                 # API endpoints
│   ├── dashboard/           # Merchant dashboard
│   └── onboarding/          # Merchant signup flow
├── components/
│   ├── ui/                  # Base shadcn/ui components
│   ├── storefront/          # Customer-facing components
│   ├── dashboard/           # Merchant dashboard components
│   └── themed/              # Brand-aware themed components
├── lib/                     # Utilities & core logic
├── ai/                      # AI flows & providers
├── hooks/                   # Custom React hooks
├── schemas/                 # Zod validation schemas
└── types/                   # Shared TypeScript types
```
### File Naming Conventions
- **Components:** `kebab-case.tsx` (e.g., `product-card.tsx`)
- **Utilities:** `kebab-case.ts` (e.g., `format-currency.ts`)
- **Types:** `kebab-case.ts` or `index.ts` (e.g., `types/index.ts`)
- **API Routes:** `route.ts` (Next.js convention)
- **Server Actions:** `actions.ts` (Next.js convention)
---
## Coding Standards
### TypeScript Best Practices
1. **Always use TypeScript** - No `.js` or `.jsx` files
2. **Avoid `any`** - Use `unknown` and type guards instead
3. **Use interfaces for objects, types for unions/intersections**
   ```typescript
   // ✅ Good
   interface Product {
     id: string;
     name: string;
   }
   
   type Status = 'active' | 'draft' | 'archived';
   
   // ❌ Bad
   const product: any = {...};
   ```
4. **Export types alongside components**
   ```typescript
   export interface ProductCardProps {
     product: Product;
     onSelect?: (id: string) => void;
   }
   
   export function ProductCard({ product, onSelect }: ProductCardProps) {
     // ...
   }
   ```
### React Patterns
1. **Use Server Components by default** (Next.js App Router)
   - Only add `'use client'` when you need client-side interactivity
   - Use Server Actions for mutations
   
2. **Component Structure**
   ```typescript
   'use client'; // Only if needed
   
   import { SomeLibrary } from 'library';
   import { LocalComponent } from '@/components/local';
   import type { ComponentProps } from './types';
   
   export interface MyComponentProps {
     // Props here
   }
   
   export function MyComponent({ prop1, prop2 }: MyComponentProps) {
     // Hooks first
     const [state, setState] = useState<Type>(initial);
     const router = useRouter();
     
     // Event handlers
     const handleClick = () => {
       // ...
     };
     
     // Render
     return (
       <div>
         {/* JSX */}
       </div>
     );
   }
   ```
3. **Use async/await, not .then()**
   ```typescript
   // ✅ Good
   async function fetchData() {
     try {
       const data = await api.get('/endpoint');
       return data;
     } catch (error) {
       logger.error({ message: 'Fetch failed', error });
       throw error;
     }
   }
   
   // ❌ Bad
   function fetchData() {
     return api.get('/endpoint')
       .then(data => data)
       .catch(err => console.error(err));
   }
   ```
### Supabase Patterns
1. **Always use server-side client for sensitive operations**
   ```typescript
   // Server Component or API Route
   import { createClient } from '@/lib/supabase/server';
   import { cookies } from 'next/headers';
   
   export async function GET() {
     const cookieStore = await cookies();
     const supabase = createClient(cookieStore);
     // ... use supabase
   }
   ```
2. **Use client-side client only for public data**
   ```typescript
   // Client Component
   import { createClient } from '@/lib/supabase/client';
   
   const supabase = createClient();
   ```
3. **Type-safe queries**
   ```typescript
   const { data, error } = await supabase
     .from('products')
     .select('*')
     .eq('merchant_id', merchantId)
     .single();
   
   if (error) {
     logger.error({ message: 'Query failed', error });
     throw new Error('Failed to fetch product');
   }
   ```
### AI Integration Patterns
1. **Use Vercel AI SDK exported functions**
   ```typescript
   import { generateText, generateObject } from 'ai';
   import { geminiFlash, imagen3 } from '@/ai/provider';
   import { z } from 'zod';
   
   // Text generation
   const { text } = await generateText({
     model: geminiFlash,
     prompt: 'Your prompt here',
   });
   
   // Structured output
   const { object } = await generateObject({
     model: geminiFlash,
     schema: z.object({
       title: z.string(),
       description: z.string(),
     }),
     prompt: 'Generate product details',
   });
   ```
2. **Use the correct model exports**
   - `geminiFlash` - Fast text generation
   - `geminiPro` - Higher quality (currently aliased to flash)
   - `gemini25FlashImage` - Multimodal (text + images)
   - `imagen3` - Image generation only
3. **Always wrap AI calls in try/catch with fallbacks**
   ```typescript
   try {
     const result = await generateText({ model, prompt });
     return result.text;
   } catch (error) {
     logger.error({ message: 'AI generation failed', error });
     return fallbackValue; // Always provide a fallback
   }
   ```
### Error Handling
1. **Use structured logging**
   ```typescript
   import { logger } from '@/lib/logger';
   
   // ✅ Good
   logger.error({
     message: 'Product creation failed',
     error,
     context: { productId, merchantId },
   });
   
   // ❌ Bad
   console.error('Error:', error);
   ```
2. **Use toast for user-facing errors**
   ```typescript
   import { useToast } from '@/hooks/use-toast';
   
   const { toast } = useToast();
   
   toast({
     title: 'Error',
     description: 'Failed to save product',
     variant: 'destructive',
   });
   ```
---
## Theming & Branding System
**Critical:** Baci allows merchants to have custom-branded storefronts. Always use the theming system:
### Theme Configuration
- **Location:** `src/lib/theme-config.ts`
- **Applied via:** CSS Custom Properties (`--theme-*`)
- **Components:** Use themed wrapper components in `src/components/themed/`
### Using Theme Colors
```tsx
// ✅ Good - Uses merchant's brand colors
<div className="bg-[var(--theme-primary)] text-[var(--theme-primary-foreground)]">
  Brand-aware button
</div>
// ❌ Bad - Hardcoded color
<div className="bg-blue-600 text-white">
  Not brand-aware
</div>
```
### Theme Properties Available
- `--theme-primary`, `--theme-secondary`, `--theme-accent`
- `--theme-background`, `--theme-foreground`
- `--theme-header-bg`, `--theme-header-text`, `--theme-header-icon`
- `--theme-footer-bg`, `--theme-footer-text`, `--theme-footer-link`
- See `src/lib/theme-config.ts` for complete list
---
## Database & API Patterns
### Naming Conventions
- **Tables:** `snake_case` (e.g., `merchant_products`, `page_configs`)
- **Columns:** `snake_case` (e.g., `business_name`, `created_at`)
- **JSON/JSONB columns:** Use `*_config` or `*_settings` suffix
### Common Tables
- `merchants` - Merchant accounts & business info
- `products` - Product catalog
- `orders` - Customer orders
- `page_configs` - Puck page builder data (draft/published)
- `ai_hero_images` - AI-generated hero images pool
- `discounts` - Promotional codes
### API Route Patterns
```typescript
// app/api/example/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Business logic
    const { data, error } = await supabase
      .from('table')
      .select('*')
      .eq('user_id', user.id);
    
    if (error) throw error;
    
    return NextResponse.json({ data });
  } catch (error) {
    logger.error({ message: 'API error', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```
---
## Performance & Optimization
1. **Use Next.js Image component**
   ```tsx
   import Image from 'next/image';
   
   <Image
     src={product.imageUrl}
     alt={product.name}
     width={300}
     height={300}
     className="object-cover"
     priority={isAboveFold}
   />
   ```
2. **Lazy load non-critical components**
   ```typescript
   import dynamic from 'next/dynamic';
   
   const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
     loading: () => <Skeleton />,
     ssr: false, // Client-side only if needed
   });
   ```
3. **Optimize Supabase queries**
   - Use `.select()` to fetch only needed columns
   - Add indexes for frequently queried columns
   - Use `.single()` when expecting one result
---
## Security Guidelines
1. **Never expose secrets in client code**
   - Use `NEXT_PUBLIC_*` prefix only for truly public values
   - Keep API keys in `.env.local` (git-ignored)
2. **Validate all user inputs**
   ```typescript
   import { z } from 'zod';
   
   const productSchema = z.object({
     name: z.string().min(1).max(100),
     price: z.number().positive(),
   });
   
   const result = productSchema.safeParse(userInput);
   if (!result.success) {
     return { error: result.error.issues };
   }
   ```
3. **Sanitize AI outputs**
   ```typescript
   import DOMPurify from 'isomorphic-dompurify';
   
   const clean = DOMPurify.sanitize(aiGeneratedHTML);
   ```
4. **Use RLS (Row Level Security) in Supabase**
   - All tables should have RLS policies
   - Users can only access their own data
5. **Link Sanitization** - Critical for security
   ```tsx
   // ✅ Good - Sanitized external link
   <a 
     href={sanitizedUrl} 
     target="_blank" 
     rel="noopener noreferrer nofollow"
     aria-label="Visit external site (opens in new tab)"
   >
     {linkText}
   </a>
   
   // ❌ Bad - Unsanitized link
   <a href={userProvidedUrl} target="_blank">Click here</a>
   ```
6. **Content Security Policy (CSP)**
   - Set appropriate CSP headers in `next.config.ts`
   - Restrict resource loading to trusted sources
   - Use nonces for inline scripts when necessary
---
## Technical SEO Best Practices
### JSON-LD Structured Data
**Always generate structured data for public pages using our utility:**
```typescript
import { generateProductSchema, generateOrganizationSchema, generateBreadcrumbSchema } from '@/lib/seo-utils';
// Product pages
export async function generateMetadata({ params }: PageProps) {
  const product = await fetchProduct(params.slug);
  
  return {
    title: product.name,
    description: product.description,
    openGraph: {
      title: product.name,
      description: product.description,
      images: [product.imageUrl],
      type: 'product',
    },
    // Add JSON-LD in page component
  };
}
// In page component
export default function ProductPage({ product }: Props) {
  const productSchema = generateProductSchema({
    name: product.name,
    description: product.description,
    image: product.imageUrl,
    price: product.price,
    currency: 'NGN',
    availability: product.inStock ? 'InStock' : 'OutOfStock',
  });
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      {/* Page content */}
    </>
  );
}
```
### Semantic HTML Structure
```tsx
// ✅ Good - Semantic HTML
<article className="product">
  <header>
    <h1>{product.name}</h1>
  </header>
  
  <section className="details">
    <h2>Product Details</h2>
    <dl>
      <dt>Price</dt>
      <dd>{formatCurrency(product.price)}</dd>
      <dt>Availability</dt>
      <dd>{product.stock} in stock</dd>
    </dl>
  </section>
  
  <section className="description">
    <h2>Description</h2>
    <p>{product.description}</p>
  </section>
  
  <footer>
    <button type="button">Add to Cart</button>
  </footer>
</article>
// ❌ Bad - Div soup
<div className="product">
  <div className="product-title">{product.name}</div>
  <div className="product-details">
    <div>Price: {product.price}</div>
    <div>Stock: {product.stock}</div>
  </div>
  <div onClick={addToCart}>Add to Cart</div>
</div>
```
### Meta Tags & Open Graph
```tsx
// Always include in page metadata
export const metadata = {
  title: 'Page Title - Baci',
  description: 'Compelling description under 160 characters',
  keywords: ['e-commerce', 'Nigeria', 'online store'],
  
  openGraph: {
    title: 'Page Title',
    description: 'Description for social sharing',
    images: ['/og-image.jpg'],
    type: 'website',
    siteName: 'Baci',
  },
  
  twitter: {
    card: 'summary_large_image',
    title: 'Page Title',
    description: 'Twitter-specific description',
    images: ['/twitter-image.jpg'],
  },
  
  alternates: {
    canonical: 'https://baci.tech/page-url',
  },
};
```
### Heading Hierarchy
```tsx
// ✅ Good - Proper hierarchy
<main>
  <h1>Main Page Title</h1>
  
  <section>
    <h2>Section Title</h2>
    <p>Content...</p>
    
    <h3>Subsection</h3>
    <p>More content...</p>
  </section>
  
  <section>
    <h2>Another Section</h2>
    <p>Content...</p>
  </section>
</main>
// ❌ Bad - Skipped levels, multiple H1s
<main>
  <h1>Title 1</h1>
  <h1>Title 2</h1>  {/* Only ONE h1 per page */}
  <h4>Skipped h2 and h3</h4>
</main>
```
---
## Accessibility (WCAG 2.1 AA) Guidelines
### Color Contrast
```tsx
// Use our contrast checker utility
import { checkContrast } from '@/lib/accessibility';
// ✅ Good - Meets WCAG AA (4.5:1 for normal text)
<p className="text-gray-900 dark:text-gray-100">
  Readable text with proper contrast
</p>
// ❌ Bad - Low contrast
<p className="text-gray-400 bg-gray-300">
  Hard to read - only 2:1 contrast ratio
</p>
```
### Keyboard Navigation
```tsx
// ✅ Good - Fully keyboard accessible
<button
  type="button"
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
  className="focus:ring-2 focus:ring-primary focus:outline-none"
  aria-label="Add product to cart"
>
  Add to Cart
</button>
// ✅ Good - Custom interactive element
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
  className="cursor-pointer focus:ring-2 focus:ring-primary"
  aria-label="Open menu"
>
  Menu Icon
</div>
// ❌ Bad - Not keyboard accessible
<div onClick={handleClick}>Click me</div>
```
### Form Accessibility
```tsx
// ✅ Good - Accessible form
<form onSubmit={handleSubmit}>
  <div>
    <label htmlFor="product-name" className="block mb-2">
      Product Name <span aria-label="required">*</span>
    </label>
    <input
      id="product-name"
      type="text"
      name="name"
      required
      aria-required="true"
      aria-invalid={errors.name ? 'true' : 'false'}
      aria-describedby={errors.name ? 'name-error' : undefined}
      className="w-full border rounded px-3 py-2"
    />
    {errors.name && (
      <p id="name-error" className="text-red-600 text-sm mt-1" role="alert">
        {errors.name.message}
      </p>
    )}
  </div>
  
  <button type="submit" aria-label="Save product">
    Save
  </button>
</form>
// ❌ Bad - No labels,  no error announcements
<form>
  <input type="text" placeholder="Name" />
  {errors.name && <span>{errors.name}</span>}
  <button>Save</button>
</form>
```
### Image Accessibility
```tsx
// ✅ Good - Descriptive alt text
<Image
  src={product.imageUrl}
  alt={`${product.name} - ${product.category}`}
  width={300}
  height={300}
/>
// ✅ Good - Decorative image
<Image
  src="/decorative-pattern.svg"
  alt=""
  aria-hidden="true"
  width={100}
  height={100}
/>
// ❌ Bad - Missing or generic alt
<Image src={image} alt="Image" />
<Image src={image} />
```
### ARIA Labels & Roles
```tsx
// ✅ Good - Proper ARIA usage
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/" aria-current="page">Home</a></li>
    <li><a href="/products">Products</a></li>
  </ul>
</nav>
<button
  onClick={toggleMenu}
  aria-expanded={isOpen}
  aria-controls="mobile-menu"
  aria-label="Toggle navigation menu"
>
  <MenuIcon aria-hidden="true" />
</button>
<div
  id="mobile-menu"
  className={isOpen ? 'block' : 'hidden'}
  role="region"
  aria-labelledby="menu-heading"
>
  <h2 id="menu-heading" className="sr-only">Site Navigation</h2>
  {/* Menu content */}
</div>
// ❌ Bad - Missing ARIA, unclear purpose
<button onClick={toggleMenu}>
  <MenuIcon />
</button>
```
### Screen Reader Only Content
```tsx
// Utility class for sr-only content
// In global CSS: .sr-only { ... }
<h1>
  Products
  <span className="sr-only">- Page {currentPage} of {totalPages}</span>
</h1>
<button>
  <TrashIcon aria-hidden="true" />
  <span className="sr-only">Delete product</span>
</button>
```
---
## Git Commit Conventions
Use conventional commits format:
```
feat: add product image optimization
fix: resolve cart total calculation bug
docs: update API documentation
refactor: simplify theme color extraction
perf: optimize product query performance
test: add unit tests for checkout flow
chore: update dependencies
```
### Commit Workflow
1. Make logical, atomic commits
2. Keep commits focused (one feature/fix per commit)
3. Write descriptive commit messages
4. Use `--no-verify` only when necessary (e.g., bypassing pre-commit hooks for cleanup commits)
---
## Testing & Quality
1. **Run type checks before committing**
   ```bash
   npm run typecheck
   ```
2. **Run linter**
   ```bash
   npm run lint
   ```
3. **Build before pushing**
   ```bash
   npm run build
   ```
4. **Test critical AI flows manually**
   - Onboarding (logo upload → color extraction)
   - Product description generation
   - Blog post generation
---
## AI Assistant Workflow Rules
### When Writing Code
1. **Always check existing patterns first** - Look at similar components/files before creating new ones
2. **Prefer modification over recreation** - Edit existing files instead of rewriting
3. **Use project conventions** - Follow the established file structure and naming
4. **Type safety is non-negotiable** - All code must pass TypeScript strict checks
5. **Test after changes** - Run build and typecheck to verify changes
### When Fixing Bugs
1. **Identify the root cause** - Don't just patch symptoms
2. **Check for similar issues** - Fix all instances of the same pattern
3. **Verify the fix** - Run the affected feature to ensure it works
4. **Update types if needed** - Ensure TypeScript types reflect reality
### When Adding Features
1. **Understand the context** - Read related files and documentation
2. **Follow existing patterns** - Match the style of similar features
3. **Consider theming** - New components should respect merchant branding
4. **Plan database changes** - Discuss schema modifications before implementing
5. **Document complex logic** - Add comments for non-obvious code
### Communication Style
1. **Be concise** - Provide clear, actionable information
2. **Show, don't just tell** - Include code examples
3. **Acknowledge mistakes** - If an approach doesn't work, explain why and pivot
4. **Ask for clarification** - Don't assume; confirm requirements
---
## Common Gotchas & Pitfalls
### Next.js App Router
- **Don't use `useRouter()` from `next/navigation` in Server Components** - It's client-only
- **`cookies()` is async** - Always `await cookies()` in Next.js 15+
- **Server Actions need `'use server'`** - Mark functions with this directive
### Supabase
- **RLS policies are enforced** - If a query returns nothing, check RLS rules
- **Date fields are strings** - Convert to `Date` objects in TypeScript
- **JSONB columns need casting** - Use `.select('jsonb_column::text')` if needed
### AI SDK
- **Models are not interchangeable** - `imagen3` only generates images, not text
- **Structured output requires Zod schemas** - Use `generateObject` not `generateText`
- **Rate limits exist** - Implement exponential backoff for retries
### Tailwind CSS
- **Dynamic classes don't work** - Use template literals in `className`, not string concatenation
  ```tsx
  // ❌ Bad
  className={`bg-${color}-500`} // Won't work
  
  // ✅ Good
  className="bg-blue-500 data-[active=true]:bg-green-500"
  // or use CSS variables
  style={{ backgroundColor: `var(--theme-${color})` }}
  ```
---
## Documentation Requirements
### When Creating New Features
1. **Update `project_brief.md`** if it changes core user flows
2. **Update `techstack.md`** if adding new dependencies
3. **Add JSDoc comments** to exported functions/components
   ```typescript
   /**
    * Generates a product description using AI
    * @param productName - The name of the product
    * @param category - Product category for context
    * @returns AI-generated description string
    */
   export async function generateDescription(
     productName: string,
     category: string
   ): Promise<string> {
     // ...
   }
   ```
### When Adding Dependencies
Document in a comment or README:
- **Why** was it added?
- **What** does it replace (if applicable)?
- **How** should it be used?
---
## Quick Reference
### Import Aliases
- `@/` → `src/` (e.g., `@/components/ui/button`)
- `@/lib/` → `src/lib/`
- `@/app/` → `src/app/`
### Environment Variables (Common)
- `NEXT_PUBLIC_SUPABASE_URL` - Public Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Server-only admin key
- `GOOGLE_GENAI_API_KEY` - Google AI API key
- `PAYSTACK_SECRET_KEY` - Paystack secret key
### Useful Commands
```bash
npm run dev          # Start development server
npm run build        # Production build
npm run typecheck    # Check TypeScript types
npm run lint         # Run ESLint
npm run docs         # Generate TypeDoc documentation
```
---
## Final Notes
- **Stay consistent** - Match the existing code style
- **Prioritize merchant experience** - Fast onboarding and easy store management
- **Think mobile-first** - Most merchants use phones
- **Embrace AI** - Use Gemini for repetitive tasks (descriptions, SEO, etc.)
- **Keep it simple** - Complex features can be added later; MVP first
**Remember:** Every line of code should serve the mission of getting Nigerian merchants online in under 3 minutes.

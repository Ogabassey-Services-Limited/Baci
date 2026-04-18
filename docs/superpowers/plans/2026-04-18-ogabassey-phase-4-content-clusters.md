# Ogabassey Phase 4 Content Clusters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reinforce Ogabassey's commercial graph by turning existing blog content into deterministic, crawlable links around category hubs, compare pages, price-band pages, and PDPs without adding new route families or database migrations.

**Architecture:** Phase 4 reuses existing published `blog_posts` as the canonical informational URL surface for buyer guides, “best in Nigeria” pages, troubleshooting content, and decision-support content. A new typed content-cluster support layer infers commercial context from existing post metadata, then renders links in both directions: blog posts link into category/compare/price-band/PDP pages, and commercial pages surface matching published guides. All matching is server-rendered, request-scoped, deterministic, and based on bounded token rules plus the Phase 1/2/3 models that already exist.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, existing storefront blog routes, existing phase 1/2/3 SEO models, Vitest + React Testing Library, Biome.

---

## Scope Decisions

- Use existing storefront blog routes only:
  - `/{slug}/blog`
  - `/{slug}/blog/{postSlug}`
- Do **not** add new public route families in Phase 4.
- Do **not** add migrations or new blog-post database columns.
- Do **not** change `/faq` in this phase. Support/troubleshooting content will live under existing blog post URLs.
- Keep existing blog metadata, canonical URLs, breadcrumb schema, and sitemap behavior intact.
- Replace the client-fetched Ogabassey PDP `BlogSnippet` with server-rendered guide links so the informational graph lives in initial HTML.

## File Map

**Create**

- `apps/web/src/config/storefront-content-clusters.ts`
  Purpose: bounded token taxonomy and score weights for `smartphones`, `laptops`, and `smart-tvs`.
- `apps/web/src/lib/storefront-content/content-cluster-types.ts`
  Purpose: shared types for published guide posts, inferred context, and rendered guide links.
- `apps/web/src/lib/storefront-content/get-published-cluster-posts.ts`
  Purpose: request-scoped server loader for published blog posts using only the fields Phase 4 needs.
- `apps/web/src/lib/storefront-content/get-published-cluster-posts.test.ts`
- `apps/web/src/lib/storefront-content/infer-content-cluster-context.ts`
  Purpose: infer category, intent kind, brands, and price-band hints from post metadata.
- `apps/web/src/lib/storefront-content/infer-content-cluster-context.test.ts`
- `apps/web/src/lib/storefront-content/build-commercial-guide-links.ts`
  Purpose: score published guide posts for category/PDP/compare/price-band pages.
- `apps/web/src/lib/storefront-content/build-commercial-guide-links.test.ts`
- `apps/web/src/lib/storefront-content/build-informational-cluster-model.ts`
  Purpose: build outbound commercial links for a single informational article.
- `apps/web/src/lib/storefront-content/build-informational-cluster-model.test.ts`
- `apps/web/src/lib/storefront-content/build-blog-cluster-collections.ts`
  Purpose: build server-rendered guide collections for `/blog`.
- `apps/web/src/lib/storefront-content/build-blog-cluster-collections.test.ts`
- `apps/web/src/components/storefront/ogabassey/seo/informational-cluster-panel.tsx`
  Purpose: render a reusable “Shop related products / compare / price-band” section on blog post pages.
- `apps/web/src/components/storefront/ogabassey/seo/informational-cluster-panel.test.tsx`
- `apps/web/src/components/storefront/ogabassey/seo/informational-cluster-index.tsx`
  Purpose: render the `/blog` guide-collection rail for priority categories.
- `apps/web/src/components/storefront/ogabassey/seo/informational-cluster-index.test.tsx`

**Modify**

- `apps/web/src/app/(storefront)/[slug]/blog/[postSlug]/page.tsx`
  Purpose: build and render the outbound informational cluster rail.
- `apps/web/src/app/(storefront)/[slug]/blog/[postSlug]/page.test.tsx`
- `apps/web/src/app/(storefront)/[slug]/blog/page.tsx`
  Purpose: render guide collections ahead of the listing UI.
- `apps/web/src/app/(storefront)/[slug]/blog/page.test.tsx`
- `apps/web/src/app/(storefront)/[slug]/[category]/category-page-content.tsx`
  Purpose: load published guide posts once per category request and pass them into the category hub builder.
- `apps/web/src/app/(storefront)/[slug]/[category]/page.test.tsx`
- `apps/web/src/lib/storefront-category/category-hub-types.ts`
- `apps/web/src/lib/storefront-category/build-category-hub-model.ts`
- `apps/web/src/lib/storefront-category/build-category-hub-model.test.ts`
- `apps/web/src/components/storefront/ogabassey/seo/category-hub-sections.tsx`
- `apps/web/src/components/storefront/ogabassey/seo/category-hub-sections.test.tsx`
- `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.tsx`
  Purpose: load published guide posts on the generic PDP route and pass them into the semantic model builder.
- `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx`
- `apps/web/src/lib/storefront-product/product-semantic-types.ts`
- `apps/web/src/lib/storefront-product/build-product-semantic-model.ts`
- `apps/web/src/lib/storefront-product/build-product-semantic-model.test.ts`
- `apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.tsx`
- `apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx`
- `apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx`
- `apps/web/src/components/storefront/ogabassey/pages/product-details-page.test.tsx`
- `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.tsx`
  Purpose: load published guide posts on the categorized PDP route and pass them into the semantic model builder.
- `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx`
- `apps/web/src/lib/storefront-compare/load-compare-page.ts`
- `apps/web/src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/compare-page-content.tsx`
- `apps/web/src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx`
- `apps/web/src/lib/storefront-compare/load-price-band-page.ts`
- `apps/web/src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/price-band-page-content.tsx`
- `apps/web/src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/price-band-page-content.test.tsx`

## Shared Rules

### Supported commercial categories

Use exactly these three Phase 2 priority categories:

```ts
type SupportedClusterCategory = 'smartphones' | 'laptops' | 'smart-tvs';
```

### Informational intent kinds

Use exactly these four intent buckets:

```ts
type ContentClusterKind =
  | 'buyer-guide'
  | 'best-in-nigeria'
  | 'troubleshooting'
  | 'decision-support';
```

### Category token support

Encode the token support exactly in `storefront-content-clusters.ts`:

```ts
export const CONTENT_CLUSTER_SUPPORT = {
  smartphones: {
    categoryNames: ['smartphones', 'phones', 'mobile phones'],
    articleTokens: [
      'smartphone',
      'phone',
      'iphone',
      'android',
      'samsung',
      'galaxy',
      'redmi',
      'xiaomi',
      'tecno',
      'itel',
      'infinix',
      'battery',
      'camera',
      '5g',
      'sim',
    ],
    brandTokens: {
      apple: ['apple', 'iphone', 'ios'],
      samsung: ['samsung', 'galaxy'],
      redmi: ['redmi', 'xiaomi'],
      tecno: ['tecno'],
      infinix: ['infinix'],
      itel: ['itel'],
    },
    priceBandAliases: {
      'under-300k': ['budget', 'cheap', 'entry-level', 'affordable'],
      'under-500k': ['midrange', 'mid-range', 'under-500k', 'value'],
    },
  },
  laptops: {
    categoryNames: ['laptops', 'computers', 'notebooks'],
    articleTokens: [
      'laptop',
      'notebook',
      'macbook',
      'windows',
      'ssd',
      'ram',
      'gaming',
      'battery',
      'intel',
      'amd',
    ],
    brandTokens: {
      hp: ['hp'],
      dell: ['dell'],
      lenovo: ['lenovo'],
      apple: ['apple', 'macbook'],
      asus: ['asus'],
    },
    priceBandAliases: {
      'under-500k': ['budget', 'student', 'entry-level', 'cheap'],
      'under-1m': ['midrange', 'creator', 'office', 'work'],
    },
  },
  'smart-tvs': {
    categoryNames: ['smart tvs', 'smart tv', 'televisions', 'tvs'],
    articleTokens: [
      'tv',
      'television',
      'smart tv',
      'oled',
      'qled',
      'google tv',
      'android tv',
      '4k',
      'hdr',
    ],
    brandTokens: {
      samsung: ['samsung'],
      lg: ['lg'],
      hisense: ['hisense'],
      tcl: ['tcl'],
      sony: ['sony'],
    },
    priceBandAliases: {
      'under-500k': ['budget', 'entry-level', 'cheap'],
      'under-1m': ['midrange', '4k', 'family'],
    },
  },
} as const;

export const CONTENT_KIND_TOKENS = {
  'buyer-guide': ['buyer guide', 'buying guide', 'how to choose', 'what to buy'],
  'best-in-nigeria': ['best', 'top', 'nigeria', 'budget', 'affordable'],
  troubleshooting: ['fix', 'troubleshoot', 'problem', 'issue', 'repair', 'why'],
  'decision-support': ['vs', 'versus', 'compare', 'difference', 'which'],
} as const;
```

### Deterministic scoring

Use this score model inside `build-commercial-guide-links.ts`:

```ts
const SCORE = {
  categoryMatch: 4,
  kindMatch: 2,
  brandMatch: 2,
  priceBandMatch: 2,
  productTokenMatch: 1,
  titleTokenMatch: 1,
} as const;
```

Then sort by:

1. descending `score`
2. descending `publishedAt`
3. ascending `slug`

Require `score >= 4` to publish a guide link.

## Task 1: Shared Cluster Taxonomy and Scoring

**Files:**
- Create: `apps/web/src/config/storefront-content-clusters.ts`
- Create: `apps/web/src/lib/storefront-content/content-cluster-types.ts`
- Create: `apps/web/src/lib/storefront-content/get-published-cluster-posts.ts`
- Create: `apps/web/src/lib/storefront-content/get-published-cluster-posts.test.ts`
- Create: `apps/web/src/lib/storefront-content/infer-content-cluster-context.ts`
- Create: `apps/web/src/lib/storefront-content/infer-content-cluster-context.test.ts`
- Create: `apps/web/src/lib/storefront-content/build-commercial-guide-links.ts`
- Create: `apps/web/src/lib/storefront-content/build-commercial-guide-links.test.ts`

- [ ] **Step 1: Write the failing tests**

Create fixtures that prove:

```ts
const publishedGuidePosts = [
  {
    slug: 'best-phones-in-nigeria',
    title: 'Best Phones in Nigeria',
    excerpt: 'Budget and flagship phone picks.',
    category: 'Smartphones',
    tags: ['smartphones', 'budget', 'iphone'],
    keywords: ['android', 'battery'],
    featured_image_url: null,
    published_at: '2026-04-10T09:00:00.000Z',
    reading_time_minutes: 6,
  },
  {
    slug: 'apple-vs-samsung-buying-guide',
    title: 'Apple vs Samsung Buying Guide',
    excerpt: 'Which ecosystem fits you.',
    category: 'Smartphones',
    tags: ['smartphones', 'apple', 'samsung'],
    keywords: ['iphone', 'galaxy'],
    featured_image_url: null,
    published_at: '2026-04-09T09:00:00.000Z',
    reading_time_minutes: 5,
  },
  {
    slug: 'best-laptops-in-nigeria',
    title: 'Best Laptops in Nigeria',
    excerpt: 'Work and gaming laptop picks.',
    category: 'Laptops',
    tags: ['laptops', 'hp', 'dell'],
    keywords: ['ssd', 'ram'],
    featured_image_url: null,
    published_at: '2026-04-08T09:00:00.000Z',
    reading_time_minutes: 7,
  },
];

it('infers smartphones best-in-nigeria context from blog metadata', () => {
  expect(
    inferContentClusterContext({
      title: 'Best Phones in Nigeria for 2026',
      excerpt: 'Affordable Android and iPhone picks',
      category: 'Smartphones',
      tags: ['budget', 'iphone'],
      keywords: ['android', 'battery'],
    }),
  ).toMatchObject({
    categorySlug: 'smartphones',
    kind: 'best-in-nigeria',
    brands: ['apple'],
  });
});

it('selects only matching published guides for a compare page', () => {
  const links = buildCommercialGuideLinks({
    storeUrl: 'https://ogabassey.com',
    posts: publishedGuidePosts,
    context: {
      pageKind: 'compare',
      categorySlug: 'smartphones',
      brands: ['apple', 'samsung'],
    },
  });

  expect(links.map((link) => link.href)).toEqual([
    'https://ogabassey.com/blog/apple-vs-samsung-buying-guide',
  ]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
cd /private/tmp/baci-ogabassey-cwv-deferment-recovered/apps/web
pnpm exec vitest --run \
  src/lib/storefront-content/infer-content-cluster-context.test.ts \
  src/lib/storefront-content/build-commercial-guide-links.test.ts \
  src/lib/storefront-content/get-published-cluster-posts.test.ts
```

Expected: missing module / missing export failures for the new cluster files.

- [ ] **Step 3: Implement the minimal shared layer**

Use these exact runtime shapes:

```ts
export interface PublishedClusterPost {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  tags: string[] | null;
  keywords: string[] | null;
  featured_image_url: string | null;
  published_at: string | null;
  reading_time_minutes: number | null;
}

export interface InferredContentClusterContext {
  categorySlug: SupportedClusterCategory | null;
  kind: ContentClusterKind | null;
  brands: string[];
  matchedPriceBands: string[];
  tokens: string[];
}

export interface InformationalGuideLink {
  href: string;
  title: string;
  description: string;
  kind: ContentClusterKind;
}
```

Implementation rules:

- `getPublishedClusterPosts(merchantId)` must query only:
  - `slug`
  - `title`
  - `excerpt`
  - `category`
  - `tags`
  - `keywords`
  - `featured_image_url`
  - `published_at`
  - `reading_time_minutes`
- `inferContentClusterContext()` must tokenize `title`, `excerpt`, `category`, `tags`, and `keywords`, then:
  - prefer an explicit category-name match
  - otherwise choose the highest positive category token overlap
  - infer `kind` from `CONTENT_KIND_TOKENS`
  - infer brand keys from `brandTokens`
  - infer price-band aliases from `priceBandAliases`
- `buildCommercialGuideLinks()` must return at most 3 links.

- [ ] **Step 4: Run the shared tests to green**

Run the same command from Step 2.

Expected: PASS

## Task 2: Blog Post Outbound Commercial Rail

**Files:**
- Create: `apps/web/src/lib/storefront-content/build-informational-cluster-model.ts`
- Create: `apps/web/src/lib/storefront-content/build-informational-cluster-model.test.ts`
- Create: `apps/web/src/components/storefront/ogabassey/seo/informational-cluster-panel.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/seo/informational-cluster-panel.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/blog/[postSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/blog/[postSlug]/page.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add one builder test and one route test.

In `blog/[postSlug]/page.test.tsx` make the route harness deterministic before adding assertions:

- add `const mockBuildInformationalClusterModel = vi.fn();`
- add:

```ts
vi.mock('@/lib/storefront-content/build-informational-cluster-model', () => ({
  buildInformationalClusterModel: (...args: unknown[]) =>
    mockBuildInformationalClusterModel(...args),
}));
```

- keep the existing `liveBlogPost` fixture for metadata-only tests
- add a separate `smartphoneGuideBlogPost` fixture for the new route test with this exact content:

```ts
const smartphoneGuideBlogPost = {
  ...liveBlogPost,
  post: {
    ...liveBlogPost.post,
    title: 'Best Phones in Nigeria for 2026',
    slug: 'best-phones-in-nigeria',
    category: 'Smartphones',
    excerpt: 'Affordable Android and iPhone picks for buyers in Nigeria.',
    tags: ['budget', 'iphone', 'samsung'],
    keywords: ['android', 'battery', 'smartphones'],
  },
};
```

- in `build-informational-cluster-model.test.ts`, define the builder fixtures explicitly before the test block:

```ts
const smartphoneGuidePost = {
  slug: 'best-phones-in-nigeria',
  title: 'Best Phones in Nigeria for 2026',
  excerpt: 'Affordable Android and iPhone picks for buyers in Nigeria.',
  category: 'Smartphones',
  tags: ['budget', 'iphone', 'samsung'],
  keywords: ['android', 'battery', 'smartphones'],
  featured_image_url: null,
  published_at: '2026-04-10T09:00:00.000Z',
  reading_time_minutes: 6,
};

const smartphoneCategoryData = {
  merchant: {
    id: 'merchant-1',
    business_name: 'Ogabassey',
    slug: 'ogabassey',
  },
  category: {
    slug: 'smartphones',
    name: 'Smartphones',
  },
  products: [
    {
      slug: 'iphone-17-pro-max',
      name: 'iPhone 17 Pro Max',
      brand: 'Apple',
      price: 495_000,
      category_slug: 'smartphones',
      product_key_specs: {
        chipset: 'A19 Pro',
        ram_gb: 8,
        storage_gb: 256,
      },
    },
    {
      slug: 'samsung-galaxy-z-trifold',
      name: 'Samsung Galaxy Z TriFold',
      brand: 'Samsung',
      price: 480_000,
      category_slug: 'smartphones',
      product_key_specs: {
        chipset: 'Snapdragon 8 Elite',
        ram_gb: 16,
        storage_gb: 512,
      },
    },
    {
      slug: 'galaxy-a56',
      name: 'Galaxy A56',
      brand: 'Samsung',
      price: 410_000,
      category_slug: 'smartphones',
      product_key_specs: {
        chipset: 'Exynos',
        ram_gb: 8,
        storage_gb: 128,
      },
    },
    {
      slug: 'iphone-15',
      name: 'iPhone 15',
      brand: 'Apple',
      price: 430_000,
      category_slug: 'smartphones',
      product_key_specs: {
        chipset: 'A17',
        ram_gb: 8,
        storage_gb: 128,
      },
    },
  ],
  isCollection: false,
};
```

Then add the tests:

```ts
it('builds category, compare, price-band, and PDP links for a smartphone guide', async () => {
  const model = await buildInformationalClusterModel({
    merchantId: 'merchant-1',
    merchantSlug: 'ogabassey',
    storeUrl: 'https://ogabassey.com',
    post: smartphoneGuidePost,
    categoryDataOverride: smartphoneCategoryData,
  });

  expect(model?.primaryCategoryLink?.href).toBe('https://ogabassey.com/smartphones');
  expect(model?.commerceLinks.map((link) => link.href)).toContain(
    'https://ogabassey.com/smartphones/compare/apple-vs-samsung',
  );
});

it('renders crawlable commerce links beneath the blog post body', async () => {
  mockDraftMode.mockResolvedValue({ isEnabled: false });
  mockGetCachedBlogPost.mockResolvedValue(smartphoneGuideBlogPost);
  mockBuildInformationalClusterModel.mockResolvedValue({
    heading: 'Continue shopping smartphones',
    primaryCategoryLink: {
      href: 'https://ogabassey.com/smartphones',
      label: 'Shop more smartphones',
    },
    commerceLinks: [
      {
        href: 'https://ogabassey.com/smartphones/compare/apple-vs-samsung',
        label: 'Apple vs Samsung',
      },
    ],
    featuredProducts: [],
  });

  render(await BlogPostPage({ params: Promise.resolve({ slug: 'ogabassey', postSlug: 'best-phones-in-nigeria' }) }));

  expect(
    screen.getByRole('link', { name: /shop more smartphones/i }),
  ).toHaveAttribute('href', 'https://ogabassey.com/smartphones');
});
```

- [ ] **Step 2: Run the blog post tests to verify they fail**

Run:

```bash
cd /private/tmp/baci-ogabassey-cwv-deferment-recovered/apps/web
pnpm exec vitest --run \
  src/lib/storefront-content/build-informational-cluster-model.test.ts \
  "src/app/(storefront)/[slug]/blog/[postSlug]/page.test.tsx"
```

Expected: missing rail model and missing rendered links.

- [ ] **Step 3: Implement the outbound rail**

Use this model shape:

```ts
export interface InformationalClusterModel {
  heading: string;
  primaryCategoryLink: { href: string; label: string } | null;
  commerceLinks: { href: string; label: string }[];
  featuredProducts: { href: string; title: string; description: string }[];
}
```

Use this exact builder input shape:

```ts
export interface BuildInformationalClusterModelInput {
  merchantId: string;
  merchantSlug: string;
  storeUrl: string;
  post: PublishedClusterPost;
  categoryDataOverride?: {
    merchant?: { id: string; business_name: string; slug: string };
    category?: { slug?: string | null; name?: string | null };
    products?: Array<{
      slug: string;
      name: string;
      brand?: string | null;
      price: number;
      category_slug?: string | null;
      product_key_specs?: Record<string, unknown> | null;
    }>;
    isCollection?: boolean;
  } | null;
}
```

Implementation rules:

- `buildInformationalClusterModel()` must:
  - infer the article category via `inferContentClusterContext()`
  - use `input.categoryDataOverride` when it is provided
  - otherwise load the matching category data with `getCachedCategoryPageData()`
  - reuse `buildCategorySupportLinks()` for compare + price-band URLs
  - choose up to 2 featured PDPs from normalized category products
    - first prefer products whose brand matches inferred article brands
    - otherwise choose the lowest-price in-stock products in the category
- `informational-cluster-panel.tsx` must render only server-known `href` values in normal anchor tags.
- `blog/[postSlug]/page.tsx` must import `buildInformationalClusterModel()` and render the panel immediately after `<BlogPostBody />`.
- `blog/[postSlug]/page.tsx` must build the rail from the resolved post payload already loaded in that file; do **not** re-query the blog post separately.
- the route implementation must treat a `null` informational cluster model as “render nothing”, so unrelated blog posts keep their current output.
- Keep all existing metadata, JSON-LD, breadcrumbs, and related-post logic unchanged.

- [ ] **Step 4: Run the blog post tests to green**

Run the same command from Step 2.

Expected: PASS

## Task 3: Reverse Guide Rails on Commercial Pages

**Files:**
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/category-page-content.tsx`
- Modify: `apps/web/src/lib/storefront-category/category-hub-types.ts`
- Modify: `apps/web/src/lib/storefront-category/build-category-hub-model.ts`
- Modify: `apps/web/src/lib/storefront-category/build-category-hub-model.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/seo/category-hub-sections.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/seo/category-hub-sections.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx`
- Modify: `apps/web/src/lib/storefront-product/product-semantic-types.ts`
- Modify: `apps/web/src/lib/storefront-product/build-product-semantic-model.ts`
- Modify: `apps/web/src/lib/storefront-product/build-product-semantic-model.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/product-details-page.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pages/product-details-page.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx`
- Modify: `apps/web/src/lib/storefront-compare/load-compare-page.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/compare-page-content.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx`
- Modify: `apps/web/src/lib/storefront-compare/load-price-band-page.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/price-band-page-content.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/price-band-page-content.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add targeted regressions that assert guide links now appear on:

```ts
expect(model.guideLinks[0]?.href).toBe('https://ogabassey.com/blog/best-phones-in-nigeria');
expect(screen.getByRole('link', { name: /best phones in nigeria/i })).toHaveAttribute(
  'href',
  'https://ogabassey.com/blog/best-phones-in-nigeria',
);
```

Required surfaces:

- category hub section
- category route integration
- PDP semantic sections
- generic PDP route integration
- categorized PDP route integration
- compare page content
- price-band page content

- [ ] **Step 2: Run the targeted commercial-page tests to verify they fail**

Run:

```bash
cd /private/tmp/baci-ogabassey-cwv-deferment-recovered/apps/web
pnpm exec vitest --run \
  "src/app/(storefront)/[slug]/[category]/page.test.tsx" \
  src/lib/storefront-category/build-category-hub-model.test.ts \
  src/components/storefront/ogabassey/seo/category-hub-sections.test.tsx \
  "src/app/(storefront)/[slug]/products/[productSlug]/page.test.tsx" \
  src/lib/storefront-product/build-product-semantic-model.test.ts \
  src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx \
  "src/app/(storefront)/[slug]/[category]/[productSlug]/page.test.tsx" \
  "src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx" \
  "src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/price-band-page-content.test.tsx" \
  src/components/storefront/ogabassey/pages/product-details-page.test.tsx
```

Expected: missing `guideLinks` fields and missing rendered anchors.

- [ ] **Step 3: Implement reverse guide selection**

Use `buildCommercialGuideLinks()` on each surface with these exact context rules:

- Category hubs:
  - `pageKind: 'category'`
  - `categorySlug`
  - no brand filter
  - prefer `buyer-guide` then `best-in-nigeria`
- PDPs:
  - `pageKind: 'product'`
  - `categorySlug`
  - `brands: [currentProduct.brand]` when present
  - `productSlugs: [currentProduct.slug]`
  - keep max 3 links
- Compare pages:
  - `pageKind: 'compare'`
  - `categorySlug`
  - `brands: [leftBrand, rightBrand]` for brand pages
  - `productSlugs: [leftProduct.slug, rightProduct.slug]` for product pages
  - prefer `decision-support` then `buyer-guide`
- Price-band pages:
  - `pageKind: 'price-band'`
  - `categorySlug`
  - `priceBandSlug`
  - prefer `best-in-nigeria` then `buyer-guide`

Model additions:

```ts
// CategoryHubModel
guideLinks: InformationalGuideLink[];

// ProductSemanticModel
guideLinks: InformationalGuideLink[];

// Compare + price-band page models
guideLinks: InformationalGuideLink[];
```

Data plumbing rules:

- `buildCategoryHubModel()` must gain `guidePosts: PublishedClusterPost[]`.
- `buildProductSemanticModel()` must gain `guidePosts: PublishedClusterPost[]`.
- `category-page-content.tsx` must load `const guidePosts = await getPublishedClusterPosts(merchant.id);` exactly once per request and pass that array into `buildCategoryPageHubModel(...)`.
- `products/[productSlug]/page.tsx` must load `const guidePosts = await getPublishedClusterPosts(merchant.id);` after merchant resolution and pass that array into `buildProductSemanticModel(...)`.
- `[category]/[productSlug]/page.tsx` must load `const guidePosts = await getPublishedClusterPosts(merchant.id);` after merchant resolution and pass that array into `buildProductSemanticModel(...)`.
- `loadComparePage()` and `loadPriceBandPage()` must each load published guide posts with the already-resolved `merchant.id` and compute `guideLinks` inside the loader, so their page-content components remain pure render surfaces.

Route-test harness rules:

- `[category]/page.test.tsx` must extend its existing mocks with `getPublishedClusterPosts` and make the `CategoryPage` mock render `hubContent.guideLinks`.
- `products/[productSlug]/page.test.tsx` already mocks `buildProductSemanticModel`; extend it with `getPublishedClusterPosts` and assert the rendered guide link comes from the mocked semantic model.
- `[category]/[productSlug]/page.test.tsx` already mocks `buildProductSemanticModel`; extend it with `getPublishedClusterPosts` and reuse the current smartphone render-path fixture when asserting guide links.

Rendering rules:

- Reuse one heading string on commercial pages: `Buyer guides and support articles`
- Render the guide rail below existing commercial-support links, not above the primary comparison/spec content
- Remove `BlogSnippet` from `product-details-page.tsx` once `ProductSemanticSections` renders the new server-side guide rail

- [ ] **Step 4: Run the targeted commercial-page tests to green**

Run the same command from Step 2.

Expected: PASS

## Task 4: Blog Hub Collections

**Files:**
- Create: `apps/web/src/lib/storefront-content/build-blog-cluster-collections.ts`
- Create: `apps/web/src/lib/storefront-content/build-blog-cluster-collections.test.ts`
- Create: `apps/web/src/components/storefront/ogabassey/seo/informational-cluster-index.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/seo/informational-cluster-index.test.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/blog/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/blog/page.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add a builder test plus a route test:

In `blog/page.test.tsx` make the new route assertion deterministic:

- add `const mockBuildBlogClusterCollections = vi.fn();`
- add:

```ts
vi.mock('@/lib/storefront-content/build-blog-cluster-collections', () => ({
  buildBlogClusterCollections: (...args: unknown[]) =>
    mockBuildBlogClusterCollections(...args),
}));
```

- keep the existing `postsPayload` fixture for metadata tests
- add a new `clusterCollections` fixture for the route test:

```ts
const clusterCollections = [
  {
    categorySlug: 'smartphones',
    heading: 'Smartphone buying guides',
    categoryHref: 'https://ogabassey.com/smartphones',
    guides: [
      {
        href: 'https://ogabassey.com/blog/best-phones-in-nigeria',
        title: 'Best Phones in Nigeria',
        description: 'Budget and flagship picks.',
        kind: 'best-in-nigeria',
      },
      {
        href: 'https://ogabassey.com/blog/apple-vs-samsung-buying-guide',
        title: 'Apple vs Samsung Buying Guide',
        description: 'Which ecosystem fits you.',
        kind: 'decision-support',
      },
    ],
  },
];
```

- in `build-blog-cluster-collections.test.ts`, define the builder fixture explicitly before the test block:

```ts
const publishedGuidePosts = [
  {
    slug: 'best-phones-in-nigeria',
    title: 'Best Phones in Nigeria',
    excerpt: 'Budget and flagship phone picks.',
    category: 'Smartphones',
    tags: ['smartphones', 'budget', 'iphone'],
    keywords: ['android', 'battery'],
    featured_image_url: null,
    published_at: '2026-04-10T09:00:00.000Z',
    reading_time_minutes: 6,
  },
  {
    slug: 'apple-vs-samsung-buying-guide',
    title: 'Apple vs Samsung Buying Guide',
    excerpt: 'Which ecosystem fits you.',
    category: 'Smartphones',
    tags: ['smartphones', 'apple', 'samsung'],
    keywords: ['iphone', 'galaxy'],
    featured_image_url: null,
    published_at: '2026-04-09T09:00:00.000Z',
    reading_time_minutes: 5,
  },
  {
    slug: 'best-laptops-in-nigeria',
    title: 'Best Laptops in Nigeria',
    excerpt: 'Work and gaming laptop picks.',
    category: 'Laptops',
    tags: ['laptops', 'hp', 'dell'],
    keywords: ['ssd', 'ram'],
    featured_image_url: null,
    published_at: '2026-04-08T09:00:00.000Z',
    reading_time_minutes: 7,
  },
  {
    slug: 'student-laptop-buying-guide',
    title: 'Student Laptop Buying Guide',
    excerpt: 'What to buy for school and office work.',
    category: 'Laptops',
    tags: ['laptops', 'student'],
    keywords: ['budget', 'office'],
    featured_image_url: null,
    published_at: '2026-04-07T09:00:00.000Z',
    reading_time_minutes: 5,
  },
  {
    slug: 'best-smart-tvs-in-nigeria',
    title: 'Best Smart TVs in Nigeria',
    excerpt: 'Living-room and home-theater picks.',
    category: 'Smart TVs',
    tags: ['smart tvs', 'lg', 'samsung'],
    keywords: ['4k', 'hdr'],
    featured_image_url: null,
    published_at: '2026-04-06T09:00:00.000Z',
    reading_time_minutes: 6,
  },
  {
    slug: 'smart-tv-buying-guide',
    title: 'Smart TV Buying Guide',
    excerpt: 'How to choose screen size and panel type.',
    category: 'Smart TVs',
    tags: ['smart tvs', 'television'],
    keywords: ['oled', 'qled'],
    featured_image_url: null,
    published_at: '2026-04-05T09:00:00.000Z',
    reading_time_minutes: 5,
  },
];
```

```ts
it('groups published guides into smartphones, laptops, and smart-tv collections', () => {
  const collections = buildBlogClusterCollections({
    storeUrl: 'https://ogabassey.com',
    posts: publishedGuidePosts,
  });

  expect(collections.map((section) => section.categorySlug)).toEqual([
    'smartphones',
    'laptops',
    'smart-tvs',
  ]);
});

it('renders guide collections above the blog listing', async () => {
  mockBuildBlogClusterCollections.mockReturnValue(clusterCollections);

  render(
    await BlogPageContent({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({}),
    }),
  );

  expect(screen.getByRole('heading', { name: /guide collections/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the blog index tests to verify they fail**

Run:

```bash
cd /private/tmp/baci-ogabassey-cwv-deferment-recovered/apps/web
pnpm exec vitest --run \
  src/lib/storefront-content/build-blog-cluster-collections.test.ts \
  "src/app/(storefront)/[slug]/blog/page.test.tsx"
```

Expected: missing collection builder and missing rendered section.

- [ ] **Step 3: Implement the guide index**

Use this collection shape:

```ts
export interface BlogClusterCollection {
  categorySlug: SupportedClusterCategory;
  heading: string;
  categoryHref: string;
  guides: InformationalGuideLink[];
}
```

Implementation rules:

- change `async function BlogPageContent(...)` to `export async function BlogPageContent(...)` so `blog/page.test.tsx` can target the resolved server output directly
- Build one collection per supported category with at least 2 matching published posts.
- Each collection must expose:
  - a category-hub link (`/{category}`)
  - up to 3 guide links
- `blog/page.tsx` must load guide collections from the same listing payload already fetched for the page; do **not** re-query the blog listing a second time.
- Render the section above the existing blog listing UI in `blog/page.tsx` so it appears for both default and template-rendered blog pages.
- For template storefronts, render the guide index outside `TemplateBlogRenderer` and immediately before it, so no template registry API changes are required in Phase 4.
- Keep existing canonical, RSS, pagination, and blog JSON-LD behavior unchanged.

- [ ] **Step 4: Run the blog index tests to green**

Run the same command from Step 2.

Expected: PASS

## Final Verification

- [ ] **Step 1: Run the focused Phase 4 matrix**

```bash
cd /private/tmp/baci-ogabassey-cwv-deferment-recovered/apps/web
pnpm exec vitest --run \
  src/lib/storefront-content/*.test.ts \
  "src/app/(storefront)/[slug]/blog/page.test.tsx" \
  "src/app/(storefront)/[slug]/blog/[postSlug]/page.test.tsx" \
  src/lib/storefront-category/build-category-hub-model.test.ts \
  src/components/storefront/ogabassey/seo/category-hub-sections.test.tsx \
  src/lib/storefront-product/build-product-semantic-model.test.ts \
  src/components/storefront/ogabassey/seo/product-semantic-sections.test.tsx \
  "src/app/(storefront)/[slug]/[category]/compare/[comparisonSlug]/compare-page-content.test.tsx" \
  "src/app/(storefront)/[slug]/[category]/best-under/[priceBandSlug]/price-band-page-content.test.tsx" \
  src/components/storefront/ogabassey/pages/product-details-page.test.tsx
```

- [ ] **Step 2: Run quality gates for touched files**

```bash
cd /private/tmp/baci-ogabassey-cwv-deferment-recovered/apps/web
pnpm exec biome check \
  src/lib/storefront-content \
  src/components/storefront/ogabassey/seo \
  "src/app/(storefront)/[slug]/blog/page.tsx" \
  "src/app/(storefront)/[slug]/blog/[postSlug]/page.tsx" \
  src/lib/storefront-category/build-category-hub-model.ts \
  src/lib/storefront-product/build-product-semantic-model.ts \
  src/lib/storefront-compare/load-compare-page.ts \
  src/lib/storefront-compare/load-price-band-page.ts
pnpm turbo typecheck --filter=@baci/web
```

- [ ] **Step 3: Manual verification**

Check these live HTML surfaces locally:

1. `/{slug}/blog`
2. `/{slug}/blog/{postSlug}`
3. `/{slug}/{category}`
4. `/{slug}/{category}/compare/{comparisonSlug}`
5. `/{slug}/{category}/best-under/{priceBandSlug}`
6. `/{slug}/{category}/{productSlug}`

Confirm:

- guide links are present in initial HTML
- all links are normal crawlable anchors
- no duplicate blog/module blocks remain on PDPs
- existing canonical and JSON-LD payloads are unchanged except for the new internal-link sections

## Notes for the Implementer

- Keep this phase deterministic. No runtime AI generation, embeddings, or client-side Supabase fetches.
- Do not reintroduce a client-only blog-recommendation widget after removing `BlogSnippet`.
- Reuse existing Phase 1 support-link builders instead of inventing parallel compare/price-band URL logic.
- Keep the number of guide links intentionally small:
  - 3 max on commercial pages
  - 3 max per blog collection
  - 2 max featured PDPs on blog post pages
- If a post cannot be classified confidently, render no rail rather than forcing a thin or misleading link cluster.

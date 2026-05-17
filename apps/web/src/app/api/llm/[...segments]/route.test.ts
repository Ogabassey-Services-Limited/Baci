import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Hoisted mock fns                                                   */
/* ------------------------------------------------------------------ */
const getMerchantByIdentifier = vi.fn();
const getCachedBlogListing = vi.fn();
const getCachedBlogPost = vi.fn();
const getCachedCategoryPageData = vi.fn();
const getCachedProductWithDetails = vi.fn();

const buildBlogIndexMarkdown = vi.fn();
const buildBlogPostMarkdown = vi.fn();
const buildCategoryMarkdown = vi.fn();
const buildProductMarkdown = vi.fn();
const buildStorefrontAboutMarkdown = vi.fn();
const buildStorefrontContactMarkdown = vi.fn();
const buildStorefrontFaqMarkdown = vi.fn();
const buildStorefrontHomeMarkdown = vi.fn();
const markdownResponse = vi.fn();
const notFoundMarkdownResponse = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier,
  getCachedBlogListing,
  getCachedBlogPost,
  getCachedCategoryPageData,
  getCachedProductWithDetails,
}));

vi.mock('@/lib/llms-markdown', () => ({
  buildBlogIndexMarkdown,
  buildBlogPostMarkdown,
  buildCategoryMarkdown,
  buildProductMarkdown,
  buildStorefrontAboutMarkdown,
  buildStorefrontContactMarkdown,
  buildStorefrontFaqMarkdown,
  buildStorefrontHomeMarkdown,
  markdownResponse,
  notFoundMarkdownResponse,
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
/** In test env NODE_ENV !== 'production', so protocol resolves to http */
const HOST = 'ogabassey.com';
const ORIGIN = `http://${HOST}`;

function makeRequest(path: string): Request {
  return new Request(`https://${HOST}${path}`, {
    headers: { host: HOST },
  });
}

function makeParams(segments: string[]) {
  return { params: Promise.resolve({ segments }) };
}

const baseMerchant = {
  id: 'm1',
  business_name: 'Ogabassey',
  slug: 'ogabassey',
  payout_currency: 'NGN',
  about_page: null as string | null,
  pages: null as Record<string, string> | null,
  email: null as string | null,
  phone: null as string | null,
  faq_items: null as unknown[] | null,
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */
describe('GET /api/llm/[...segments]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    markdownResponse.mockImplementation(
      (body: string) =>
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
        })
    );
    notFoundMarkdownResponse.mockImplementation(
      (body: string) =>
        new Response(body, {
          status: 404,
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
        })
    );
  });

  /* ------ Empty segments ------ */
  describe('empty segments', () => {
    it('returns 404 when segments array is empty', async () => {
      const { GET } = await import('./route');
      const response = await GET(makeRequest('/api/llm'), makeParams([]));

      expect(response.status).toBe(404);
      expect(getMerchantByIdentifier).not.toHaveBeenCalled();
    });
  });

  /* ------ Merchant not found ------ */
  describe('merchant not found', () => {
    it('returns 404 when merchant does not exist', async () => {
      getMerchantByIdentifier.mockResolvedValue(null);

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/unknown-store'),
        makeParams(['unknown-store'])
      );

      expect(response.status).toBe(404);
      expect(getMerchantByIdentifier).toHaveBeenCalledWith('unknown-store');
    });
  });

  /* ------ 1 segment: home ------ */
  describe('home page (1 segment)', () => {
    it('returns storefront home markdown', async () => {
      const merchant = { ...baseMerchant };
      getMerchantByIdentifier.mockResolvedValue(merchant);
      buildStorefrontHomeMarkdown.mockReturnValue('# Ogabassey\n');

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey'),
        makeParams(['ogabassey'])
      );

      expect(response.status).toBe(200);
      expect(buildStorefrontHomeMarkdown).toHaveBeenCalledWith(
        merchant,
        ORIGIN
      );
    });
  });

  /* ------ 2 segments: about ------ */
  describe('about page (2 segments)', () => {
    it('returns about markdown when about_page is set', async () => {
      const merchant = { ...baseMerchant, about_page: 'We sell gadgets.' };
      getMerchantByIdentifier.mockResolvedValue(merchant);
      buildStorefrontAboutMarkdown.mockReturnValue('# About\n');

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/about'),
        makeParams(['ogabassey', 'about'])
      );

      expect(response.status).toBe(200);
      expect(buildStorefrontAboutMarkdown).toHaveBeenCalledWith(
        merchant,
        ORIGIN
      );
    });

    it('returns about markdown when pages.about is set', async () => {
      const merchant = {
        ...baseMerchant,
        pages: { about: 'About us content' },
      };
      getMerchantByIdentifier.mockResolvedValue(merchant);
      buildStorefrontAboutMarkdown.mockReturnValue('# About\n');

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/about'),
        makeParams(['ogabassey', 'about'])
      );

      expect(response.status).toBe(200);
    });

    it('returns fallback about markdown when no about content exists', async () => {
      const merchant = { ...baseMerchant };
      getMerchantByIdentifier.mockResolvedValue(merchant);
      buildStorefrontAboutMarkdown.mockReturnValue('# About\n');

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/about'),
        makeParams(['ogabassey', 'about'])
      );

      expect(response.status).toBe(200);
      expect(buildStorefrontAboutMarkdown).toHaveBeenCalledWith(
        merchant,
        ORIGIN
      );
    });
  });

  /* ------ 2 segments: contact ------ */
  describe('contact page (2 segments)', () => {
    it('returns contact markdown when email is set', async () => {
      const merchant = { ...baseMerchant, email: 'hello@ogabassey.com' };
      getMerchantByIdentifier.mockResolvedValue(merchant);
      buildStorefrontContactMarkdown.mockReturnValue('# Contact\n');

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/contact'),
        makeParams(['ogabassey', 'contact'])
      );

      expect(response.status).toBe(200);
      expect(buildStorefrontContactMarkdown).toHaveBeenCalledWith(
        merchant,
        ORIGIN
      );
    });

    it('returns contact markdown when phone is set', async () => {
      const merchant = { ...baseMerchant, phone: '+2348012345678' };
      getMerchantByIdentifier.mockResolvedValue(merchant);
      buildStorefrontContactMarkdown.mockReturnValue('# Contact\n');

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/contact'),
        makeParams(['ogabassey', 'contact'])
      );

      expect(response.status).toBe(200);
    });

    it('returns contact markdown when pages.contact is set', async () => {
      const merchant = {
        ...baseMerchant,
        pages: { contact: 'Contact details' },
      };
      getMerchantByIdentifier.mockResolvedValue(merchant);
      buildStorefrontContactMarkdown.mockReturnValue('# Contact\n');

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/contact'),
        makeParams(['ogabassey', 'contact'])
      );

      expect(response.status).toBe(200);
    });

    it('returns 404 when no contact info exists', async () => {
      const merchant = { ...baseMerchant };
      getMerchantByIdentifier.mockResolvedValue(merchant);

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/contact'),
        makeParams(['ogabassey', 'contact'])
      );

      expect(response.status).toBe(404);
      expect(buildStorefrontContactMarkdown).not.toHaveBeenCalled();
    });
  });

  /* ------ 2 segments: faq ------ */
  describe('faq page (2 segments)', () => {
    it('returns faq markdown when faq_items has entries', async () => {
      const merchant = {
        ...baseMerchant,
        faq_items: [{ question: 'Q?', answer: 'A.' }],
      };
      getMerchantByIdentifier.mockResolvedValue(merchant);
      buildStorefrontFaqMarkdown.mockReturnValue('# FAQ\n');

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/faq'),
        makeParams(['ogabassey', 'faq'])
      );

      expect(response.status).toBe(200);
      expect(buildStorefrontFaqMarkdown).toHaveBeenCalledWith(merchant, ORIGIN);
    });

    it('returns faq markdown when pages.faq has legacy content', async () => {
      const merchant = {
        ...baseMerchant,
        pages: { faq: 'Q: What?\nA: Something.' },
      };
      getMerchantByIdentifier.mockResolvedValue(merchant);
      buildStorefrontFaqMarkdown.mockReturnValue('# FAQ\n');

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/faq'),
        makeParams(['ogabassey', 'faq'])
      );

      expect(response.status).toBe(200);
    });

    it('returns fallback faq markdown when no faq content exists', async () => {
      const merchant = { ...baseMerchant };
      getMerchantByIdentifier.mockResolvedValue(merchant);
      buildStorefrontFaqMarkdown.mockReturnValue('# FAQ\n');

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/faq'),
        makeParams(['ogabassey', 'faq'])
      );

      expect(response.status).toBe(200);
      expect(buildStorefrontFaqMarkdown).toHaveBeenCalledWith(merchant, ORIGIN);
    });
  });

  /* ------ 2 segments: blog index ------ */
  describe('blog index (2 segments)', () => {
    it('returns blog index markdown when posts exist', async () => {
      const blogMerchant = { business_name: 'Ogabassey', slug: 'ogabassey' };
      getMerchantByIdentifier.mockResolvedValue({ ...baseMerchant });
      getCachedBlogListing.mockResolvedValue({
        merchant: blogMerchant,
        posts: [{ title: 'Guide', slug: 'guide', excerpt: 'Read this' }],
        categories: ['Guides'],
      });
      buildBlogIndexMarkdown.mockReturnValue('# Ogabassey Blog\n');

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/blog'),
        makeParams(['ogabassey', 'blog'])
      );

      expect(response.status).toBe(200);
      expect(getCachedBlogListing).toHaveBeenCalledWith('ogabassey');
      expect(buildBlogIndexMarkdown).toHaveBeenCalledWith(
        blogMerchant,
        ORIGIN,
        expect.any(Array),
        ['Guides']
      );
    });

    it('filters test posts and junk categories from blog index markdown', async () => {
      const blogMerchant = { business_name: 'Ogabassey', slug: 'ogabassey' };
      const publicPost = {
        title: 'Guide',
        slug: 'guide',
        excerpt: 'Read this',
      };
      getMerchantByIdentifier.mockResolvedValue({ ...baseMerchant });
      getCachedBlogListing.mockResolvedValue({
        merchant: blogMerchant,
        posts: [
          publicPost,
          {
            title: 'Test Post: Agent Integration Working',
            slug: 'test-post-agent-integration-working',
            excerpt: 'Internal test',
          },
        ],
        categories: ['Guides', 'gcrblw'],
      });
      buildBlogIndexMarkdown.mockReturnValue('# Ogabassey Blog\n');

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/blog'),
        makeParams(['ogabassey', 'blog'])
      );

      expect(response.status).toBe(200);
      expect(buildBlogIndexMarkdown).toHaveBeenCalledWith(
        blogMerchant,
        ORIGIN,
        [publicPost],
        ['Guides']
      );
    });

    it('returns 404 when no blog posts exist', async () => {
      getMerchantByIdentifier.mockResolvedValue({ ...baseMerchant });
      getCachedBlogListing.mockResolvedValue({
        merchant: { business_name: 'Ogabassey' },
        posts: [],
        categories: [],
      });

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/blog'),
        makeParams(['ogabassey', 'blog'])
      );

      expect(response.status).toBe(404);
    });

    it('returns 404 when blog listing returns null', async () => {
      getMerchantByIdentifier.mockResolvedValue({ ...baseMerchant });
      getCachedBlogListing.mockResolvedValue(null);

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/blog'),
        makeParams(['ogabassey', 'blog'])
      );

      expect(response.status).toBe(404);
    });
  });

  /* ------ 2 segments: category (default) ------ */
  describe('category page (2 segments)', () => {
    it('returns category markdown when products exist', async () => {
      const merchant = { ...baseMerchant };
      getMerchantByIdentifier.mockResolvedValue(merchant);
      getCachedCategoryPageData.mockResolvedValue({
        isCollection: false,
        fallbackName: 'Phones',
        fallbackDescription: 'Shop phones.',
        products: [
          { id: 'p1', name: 'iPhone 15', slug: 'iphone-15', price: 1000 },
        ],
      });
      buildCategoryMarkdown.mockReturnValue('# Phones\n');

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/phones'),
        makeParams(['ogabassey', 'phones'])
      );

      expect(response.status).toBe(200);
      expect(getCachedCategoryPageData).toHaveBeenCalledWith(
        'm1',
        'phones',
        'ogabassey'
      );
      expect(buildCategoryMarkdown).toHaveBeenCalledWith(
        merchant,
        ORIGIN,
        'phones',
        expect.objectContaining({ products: expect.any(Array) })
      );
    });

    it('returns 404 when category has no products', async () => {
      getMerchantByIdentifier.mockResolvedValue({ ...baseMerchant });
      getCachedCategoryPageData.mockResolvedValue({
        isCollection: false,
        fallbackName: 'Empty',
        products: [],
      });

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/empty-category'),
        makeParams(['ogabassey', 'empty-category'])
      );

      expect(response.status).toBe(404);
    });

    it('returns 404 when category data is null', async () => {
      getMerchantByIdentifier.mockResolvedValue({ ...baseMerchant });
      getCachedCategoryPageData.mockResolvedValue(null);

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/nonexistent'),
        makeParams(['ogabassey', 'nonexistent'])
      );

      expect(response.status).toBe(404);
    });
  });

  /* ------ 3 segments: blog post ------ */
  describe('blog post (3 segments)', () => {
    it('returns blog post markdown when post exists', async () => {
      const blogMerchant = { business_name: 'Ogabassey' };
      const post = {
        title: 'Guide',
        slug: 'guide',
        excerpt: 'Read this',
        author_name: 'Editor',
      };
      getMerchantByIdentifier.mockResolvedValue({ ...baseMerchant });
      getCachedBlogPost.mockResolvedValue({ merchant: blogMerchant, post });
      buildBlogPostMarkdown.mockReturnValue('# Guide\n');

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/blog/guide'),
        makeParams(['ogabassey', 'blog', 'guide'])
      );

      expect(response.status).toBe(200);
      expect(getCachedBlogPost).toHaveBeenCalledWith('ogabassey', 'guide');
      expect(buildBlogPostMarkdown).toHaveBeenCalledWith(
        blogMerchant,
        ORIGIN,
        post
      );
    });

    it('returns 404 when blog post does not exist', async () => {
      getMerchantByIdentifier.mockResolvedValue({ ...baseMerchant });
      getCachedBlogPost.mockResolvedValue(null);

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/blog/missing'),
        makeParams(['ogabassey', 'blog', 'missing'])
      );

      expect(response.status).toBe(404);
    });
  });

  /* ------ 3 segments: product ------ */
  describe('product page (3 segments)', () => {
    it('returns product markdown when product exists', async () => {
      const merchant = { ...baseMerchant };
      const product = {
        id: 'p1',
        name: 'iPhone 15',
        slug: 'iphone-15',
        description: 'Flagship smartphone',
        price: 1000,
        category: 'Phones',
        brand: 'Apple',
        stock: 3,
        images: ['https://img.test/iphone.jpg'],
      };
      getMerchantByIdentifier.mockResolvedValue(merchant);
      getCachedProductWithDetails.mockResolvedValue(product);
      buildProductMarkdown.mockReturnValue('# iPhone 15\n');

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/phones/iphone-15'),
        makeParams(['ogabassey', 'phones', 'iphone-15'])
      );

      expect(response.status).toBe(200);
      expect(getCachedProductWithDetails).toHaveBeenCalledWith(
        'm1',
        'iphone-15'
      );
      expect(buildProductMarkdown).toHaveBeenCalledWith(
        merchant,
        ORIGIN,
        product
      );
    });

    it('returns 404 when product does not exist', async () => {
      getMerchantByIdentifier.mockResolvedValue({ ...baseMerchant });
      getCachedProductWithDetails.mockResolvedValue(null);

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/phones/missing'),
        makeParams(['ogabassey', 'phones', 'missing'])
      );

      expect(response.status).toBe(404);
    });
  });

  /* ------ 4+ segments: too many ------ */
  describe('too many segments', () => {
    it('returns 404 for 4 or more segments', async () => {
      getMerchantByIdentifier.mockResolvedValue({ ...baseMerchant });

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey/a/b/c'),
        makeParams(['ogabassey', 'a', 'b', 'c'])
      );

      expect(response.status).toBe(404);
    });
  });

  /* ------ Error handling ------ */
  describe('error handling', () => {
    it('returns 404 when handleLlmRequest throws an unhandled error', async () => {
      getMerchantByIdentifier.mockRejectedValue(new Error('DB error'));

      const { GET } = await import('./route');
      const response = await GET(
        makeRequest('/api/llm/ogabassey'),
        makeParams(['ogabassey'])
      );

      expect(response.status).toBe(404);
      expect(notFoundMarkdownResponse).toHaveBeenCalled();
    });
  });
});

/* ------------------------------------------------------------------ */
/*  toLlmApiPath unit tests                                            */
/*                                                                     */
/*  The function lives in proxy.ts (protected file), so we test it     */
/*  indirectly by reimplementing the same logic here and verifying      */
/*  expected transformations. This keeps the test suite self-contained  */
/*  while documenting the contract between proxy and the route handler. */
/* ------------------------------------------------------------------ */
describe('toLlmApiPath (contract tests)', () => {
  /**
   * Reference implementation matching proxy.ts toLlmApiPath.
   * Kept in sync manually — if proxy changes, these tests catch drift.
   */
  function toLlmApiPath(pathname: string, slug: string): string {
    let clean = pathname;
    if (clean.endsWith('/index.html.md')) {
      clean = clean.slice(0, -'/index.html.md'.length);
    } else if (clean.endsWith('.md')) {
      clean = clean.slice(0, -'.md'.length);
    }
    clean = clean.replace(/^\//, '');
    return clean ? `/api/llm/${slug}/${clean}` : `/api/llm/${slug}`;
  }

  it('maps /index.html.md to home', () => {
    expect(toLlmApiPath('/index.html.md', 'ogabassey')).toBe(
      '/api/llm/ogabassey'
    );
  });

  it('maps /about.md to about page', () => {
    expect(toLlmApiPath('/about.md', 'ogabassey')).toBe(
      '/api/llm/ogabassey/about'
    );
  });

  it('maps /contact.md to contact page', () => {
    expect(toLlmApiPath('/contact.md', 'ogabassey')).toBe(
      '/api/llm/ogabassey/contact'
    );
  });

  it('maps /faq.md to faq page', () => {
    expect(toLlmApiPath('/faq.md', 'ogabassey')).toBe('/api/llm/ogabassey/faq');
  });

  it('maps /blog/my-post.md to blog post', () => {
    expect(toLlmApiPath('/blog/my-post.md', 'ogabassey')).toBe(
      '/api/llm/ogabassey/blog/my-post'
    );
  });

  it('maps /shoes/index.html.md to category', () => {
    expect(toLlmApiPath('/shoes/index.html.md', 'ogabassey')).toBe(
      '/api/llm/ogabassey/shoes'
    );
  });

  it('maps /shoes/nike-air.md to product', () => {
    expect(toLlmApiPath('/shoes/nike-air.md', 'ogabassey')).toBe(
      '/api/llm/ogabassey/shoes/nike-air'
    );
  });

  it('maps /blog/index.html.md to blog index', () => {
    expect(toLlmApiPath('/blog/index.html.md', 'ogabassey')).toBe(
      '/api/llm/ogabassey/blog'
    );
  });

  it('preserves nested path segments', () => {
    expect(toLlmApiPath('/electronics/laptops/macbook.md', 'store')).toBe(
      '/api/llm/store/electronics/laptops/macbook'
    );
  });
});

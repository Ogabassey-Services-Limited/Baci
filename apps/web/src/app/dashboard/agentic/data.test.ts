import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const createClient = vi.fn();
const getMerchantForUser = vi.fn();
const loadAgenticActionHealth = vi.fn();
const getCachedOpenAIFeedData = vi.fn();
const getCachedGoogleMerchantFeedData = vi.fn();
const buildMerchantTrustProfile = vi.fn();
const buildAgentCommerceTrustReadiness = vi.fn();
const supabaseFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));

vi.mock('@/lib/merchant-server', () => ({
  getMerchantForUser: () => getMerchantForUser(),
}));

vi.mock('@/lib/agentic/action-health-loader', () => ({
  loadAgenticActionHealth: (...args: unknown[]) =>
    loadAgenticActionHealth(...args),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: () => 'https://shop.example.com',
}));

vi.mock('@/lib/storefront-trust/build-merchant-trust-profile', () => ({
  buildMerchantTrustProfile: (...args: unknown[]) =>
    buildMerchantTrustProfile(...args),
}));

vi.mock(
  '@/lib/storefront-trust/build-agent-commerce-trust-readiness',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/lib/storefront-trust/build-agent-commerce-trust-readiness')
      >();
    return {
      ...actual,
      buildAgentCommerceTrustReadiness: (...args: unknown[]) =>
        buildAgentCommerceTrustReadiness(...args),
    };
  }
);

vi.mock('@/app/api/feed/openai/feed-data', () => ({
  getCachedOpenAIFeedData: (...args: unknown[]) =>
    getCachedOpenAIFeedData(...args),
}));

vi.mock('@/app/api/feed/google-merchant/feed-data', () => ({
  getCachedGoogleMerchantFeedData: (...args: unknown[]) =>
    getCachedGoogleMerchantFeedData(...args),
}));

const merchant = {
  business_name: 'Demo Store',
  custom_domain: null,
  id: 'merchant-1',
  is_published: true,
  slug: 'demo',
};

const ownerStaffAccess = {
  isOwner: true,
  isStaff: false,
  permissions: { full_access: { all: true } },
  role: null,
};

const actionHealth = {
  actions: [
    {
      code: 'AGENTIC_ACTIONS_HEALTHY',
      count: 0,
      message: 'No recent agentic action issues need attention.',
      severity: 'ok' as const,
    },
  ],
  generated_at: '2026-05-18T08:00:00.000Z',
};

const crawlerRows = [
  {
    agent_family: 'openai',
    bot_name: 'OpenAI',
    cache_outcome: 'hit',
    crawled_at: '2026-05-20T05:00:00.000Z',
    host: 'shop.example.com',
    id: 'crawler-row-2',
    response_time_ms: 120,
    status_code: 200,
    url_path: '/agent-commerce.json',
    user_agent: 'GPTBot/1.0',
  },
  {
    agent_family: 'google',
    bot_name: 'Google',
    cache_outcome: 'miss',
    crawled_at: '2026-05-20T04:58:00.000Z',
    host: 'shop.example.com',
    id: 'crawler-row-1',
    response_time_ms: 320,
    status_code: 200,
    url_path: '/feeds/openai.jsonl',
    user_agent: 'Google-Extended',
  },
];

const fullReadiness = {
  checks: [
    {
      affectedProductIds: ['p-1', 'p-2'],
      id: 'catalog-surface-parity' as const,
      label: 'Catalog surface parity',
      message: '2 products missing from a surface.',
      severity: 'fail' as const,
    },
  ],
  status: 'fail' as const,
  surfaces: {
    agentCommerceManifest: 'https://shop.example.com/agent-commerce.json',
    agentNativeCommerce:
      'https://shop.example.com/.well-known/agent-native-commerce',
    agentTrust: 'https://shop.example.com/agent-trust.json',
    currentProductFeed: 'https://shop.example.com/feeds/agent-products.jsonl',
    googleMerchantXml: 'https://shop.example.com/feeds/google-merchant.xml',
    llms: 'https://shop.example.com/llms.txt',
    openAiProductFeed: 'https://shop.example.com/feeds/openai.jsonl',
    policies: {
      privacy_policy_url: 'https://shop.example.com/privacy',
      return_policy_url: 'https://shop.example.com/returns',
      shipping_policy_url: 'https://shop.example.com/shipping',
      terms_of_service_url: 'https://shop.example.com/terms',
    },
    productApi: 'https://shop.example.com/api/storefront/demo/products',
    robots: 'https://shop.example.com/robots.txt',
    sitemap: 'https://shop.example.com/sitemap.xml',
    ucpProfile: 'https://shop.example.com/.well-known/ucp',
  },
  totals: {
    googleProducts: 2,
    latestProductUpdatedAt: '2026-05-18T08:00:00.000Z',
    openAiProducts: 2,
    priceMismatches: 0,
    productsWithStructuredData: 2,
    productsWithVerifiedImages: 2,
    sharedProducts: 2,
    staleProducts: 0,
    urlMismatches: 0,
  },
};

interface CrawlerLogQuery {
  eq(column: string, value: string): CrawlerLogQuery;
  gte(column: string, value: string): CrawlerLogQuery;
  limit(count: number): Promise<{
    data: Record<string, unknown>[] | null;
    error: unknown;
  }>;
  lte(column: string, value: string): CrawlerLogQuery;
  or(filter: string): CrawlerLogQuery;
  order(column: string, options: { ascending: boolean }): CrawlerLogQuery;
  select(columns: string): CrawlerLogQuery;
}

function createCrawlerLogQuery({
  data = crawlerRows,
  error = null,
}: {
  data?: Record<string, unknown>[] | null;
  error?: unknown;
} = {}): CrawlerLogQuery {
  const orderSpecs: Array<{ ascending: boolean; column: string }> = [];
  let cursorFilter: string | null = null;

  const compareOrderValues = (leftValue: unknown, rightValue: unknown) => {
    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      return leftValue - rightValue;
    }

    if (typeof leftValue === 'string' && typeof rightValue === 'string') {
      return leftValue.localeCompare(rightValue);
    }

    return 0;
  };

  const getOrderedData = () => {
    if (!data || orderSpecs.length === 0) {
      return data;
    }

    return [...data].sort((leftRow, rightRow) => {
      for (const { ascending, column } of orderSpecs) {
        const comparison = compareOrderValues(
          leftRow[column],
          rightRow[column]
        );
        if (comparison !== 0) {
          return ascending ? comparison : -comparison;
        }
      }

      return 0;
    });
  };

  const parseCursorFilter = () => {
    const match = cursorFilter?.match(
      /^crawled_at\.lt\.(.*),and\(crawled_at\.eq\.(.*),id\.lt\.(.*)\)$/
    );
    if (!match) return null;

    return {
      crawledAt: match[1] ?? '',
      tiedCrawledAt: match[2] ?? '',
      id: match[3] ?? '',
    };
  };

  const getFilteredData = () => {
    const orderedData = getOrderedData();
    const cursor = parseCursorFilter();

    if (!orderedData || !cursor) {
      return orderedData;
    }

    return orderedData.filter((row) => {
      const crawledAt = row.crawled_at;
      const id = row.id;

      if (typeof crawledAt !== 'string' || typeof id !== 'string') {
        return false;
      }

      return (
        crawledAt < cursor.crawledAt ||
        (crawledAt === cursor.tiedCrawledAt && id < cursor.id)
      );
    });
  };

  const query: CrawlerLogQuery = {
    eq: vi.fn((_column: string, _value: string) => query),
    gte: vi.fn((_column: string, _value: string) => query),
    limit: vi.fn((count: number) => {
      const filteredData = getFilteredData();
      return Promise.resolve({
        data: filteredData?.slice(0, count) ?? null,
        error,
      });
    }),
    lte: vi.fn((_column: string, _value: string) => query),
    or: vi.fn((filter: string) => {
      cursorFilter = filter;
      return query;
    }),
    order: vi.fn((column: string, options: { ascending: boolean }) => {
      orderSpecs.push({ column, ascending: options.ascending });
      return query;
    }),
    select: vi.fn((_columns: string) => query),
  };

  return query;
}

describe('loadAgenticCentersData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseFrom.mockImplementation((table: string) => {
      if (table === 'crawler_logs') return createCrawlerLogQuery();
      throw new Error(`Unexpected table: ${table}`);
    });
    createClient.mockResolvedValue({ from: supabaseFrom });
    getMerchantForUser.mockResolvedValue({
      merchant,
      staffAccess: ownerStaffAccess,
    });
    loadAgenticActionHealth.mockResolvedValue(actionHealth);
    getCachedOpenAIFeedData.mockResolvedValue({ products: [] });
    getCachedGoogleMerchantFeedData.mockResolvedValue({
      imageManifest: {},
      products: [],
    });
    buildMerchantTrustProfile.mockReturnValue({});
    buildAgentCommerceTrustReadiness.mockReturnValue(fullReadiness);
  });

  it('loads action, slim trust, and crawler center data for published merchants', async () => {
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(loadAgenticActionHealth).toHaveBeenCalledWith(
      expect.anything(),
      'merchant-1'
    );
    expect(getCachedOpenAIFeedData).toHaveBeenCalledWith('merchant-1', true);
    expect(getCachedGoogleMerchantFeedData).toHaveBeenCalledWith(
      'merchant-1',
      'demo'
    );
    expect(result.actionCenterState).toBe('ready');
    expect(result.actionHealth).toBe(actionHealth);
    expect(result.trustCenterState).toBe('ready');
    expect(result.trustReadiness).not.toHaveProperty('surfaces');
    expect(result.trustReadiness?.checks[0]).toMatchObject({
      affectedProductCount: 2,
      id: 'catalog-surface-parity',
    });
    expect(supabaseFrom).toHaveBeenCalledWith('crawler_logs');
    expect(result.crawlerCenterState).toBe('ready');
    expect(result.crawlerSummary).toMatchObject({
      health: {
        aiAgentCrawls: 2,
        cacheMissCrawls: 1,
        failedCrawls: 0,
      },
      isPartial: false,
      totalCrawls: 2,
      windowDays: 14,
    });
  });

  it('trims recent crawler rows while preserving aggregate counts', async () => {
    const manyCrawlerRows = [0, 1, 2, 3, 4].map((index) => ({
      agent_family: 'openai',
      bot_name: 'OpenAI',
      cache_outcome: index === 4 ? 'miss' : 'hit',
      crawled_at: `2026-05-20T05:0${index}:00.000Z`,
      host: 'shop.example.com',
      id: `crawler-row-${index}`,
      response_time_ms: 120,
      status_code: 200,
      url_path: `/agent-page-${index}`,
      user_agent: 'GPTBot/1.0',
    }));
    supabaseFrom.mockImplementation((table: string) => {
      if (table === 'crawler_logs') {
        return createCrawlerLogQuery({ data: manyCrawlerRows });
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result.crawlerSummary).toMatchObject({
      health: {
        aiAgentCrawls: 5,
        cacheMissCrawls: 1,
      },
      totalCrawls: 5,
    });
    expect(result.crawlerSummary?.recent).toHaveLength(3);
    expect(result.crawlerSummary?.recent.map((row) => row.url_path)).toEqual([
      '/agent-page-4',
      '/agent-page-3',
      '/agent-page-2',
    ]);
    expect(result.crawlerSummary?.recent[0]).not.toHaveProperty('id');
  });

  it('orders same-timestamp crawler rows by id before trimming recent activity', async () => {
    const tiedCrawlerRows = [
      {
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: '2026-05-20T05:00:00.000Z',
        host: 'shop.example.com',
        id: 'crawler-row-001',
        response_time_ms: 120,
        status_code: 200,
        url_path: '/agent-page-low',
        user_agent: 'GPTBot/1.0',
      },
      {
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: '2026-05-20T05:00:00.000Z',
        host: 'shop.example.com',
        id: 'crawler-row-003',
        response_time_ms: 120,
        status_code: 200,
        url_path: '/agent-page-high',
        user_agent: 'GPTBot/1.0',
      },
      {
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: '2026-05-20T05:00:00.000Z',
        host: 'shop.example.com',
        id: 'crawler-row-002',
        response_time_ms: 120,
        status_code: 200,
        url_path: '/agent-page-mid',
        user_agent: 'GPTBot/1.0',
      },
      {
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: '2026-05-20T04:59:00.000Z',
        host: 'shop.example.com',
        id: 'crawler-row-004',
        response_time_ms: 120,
        status_code: 200,
        url_path: '/agent-page-older',
        user_agent: 'GPTBot/1.0',
      },
    ];
    supabaseFrom.mockImplementation((table: string) => {
      if (table === 'crawler_logs') {
        return createCrawlerLogQuery({ data: tiedCrawlerRows });
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result.crawlerSummary?.recent.map((row) => row.url_path)).toEqual([
      '/agent-page-high',
      '/agent-page-mid',
      '/agent-page-low',
    ]);
  });

  it('pages crawler rows before building aggregate counts', async () => {
    const paginatedCrawlerRows = Array.from(
      { length: 1001 },
      (_value, index) => ({
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: `2026-05-20T05:${String(index % 60).padStart(2, '0')}:00.000Z`,
        host: 'shop.example.com',
        id: `crawler-row-${String(index).padStart(4, '0')}`,
        response_time_ms: 120,
        status_code: 200,
        url_path: `/agent-page-${index}`,
        user_agent: 'GPTBot/1.0',
      })
    );
    const crawlerLogQuery = createCrawlerLogQuery({
      data: paginatedCrawlerRows,
    });
    supabaseFrom.mockImplementation((table: string) => {
      if (table === 'crawler_logs') {
        return crawlerLogQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result.crawlerSummary?.totalCrawls).toBe(1001);
    expect(result.crawlerSummary?.health.aiAgentCrawls).toBe(1001);
    expect(result.crawlerSummary?.isPartial).toBe(false);
    expect(crawlerLogQuery.order).toHaveBeenNthCalledWith(1, 'crawled_at', {
      ascending: false,
    });
    expect(crawlerLogQuery.order).toHaveBeenNthCalledWith(2, 'id', {
      ascending: false,
    });
    expect(crawlerLogQuery.limit).toHaveBeenNthCalledWith(1, 1001);
    expect(crawlerLogQuery.limit).toHaveBeenNthCalledWith(2, 1001);
    expect(crawlerLogQuery.lte).toHaveBeenCalledWith(
      'crawled_at',
      expect.any(String)
    );
    expect(crawlerLogQuery.or).toHaveBeenCalledTimes(1);
    expect(crawlerLogQuery.or).toHaveBeenCalledWith(
      expect.stringMatching(
        /^crawled_at\.lt\..*,and\(crawled_at\.eq\..*,id\.lt\..*\)$/
      )
    );
  });

  it('caps crawler aggregation after the maximum page window', async () => {
    const cappedCrawlerRows = Array.from(
      { length: 10_001 },
      (_value, index) => ({
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: `2026-05-20T${String(Math.floor(index / 3600)).padStart(2, '0')}:${String(Math.floor(index / 60) % 60).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
        host: 'shop.example.com',
        id: `crawler-row-${String(index).padStart(5, '0')}`,
        response_time_ms: 120,
        status_code: 200,
        url_path: `/agent-page-${index}`,
        user_agent: 'GPTBot/1.0',
      })
    );
    const crawlerLogQuery = createCrawlerLogQuery({ data: cappedCrawlerRows });
    supabaseFrom.mockImplementation((table: string) => {
      if (table === 'crawler_logs') {
        return crawlerLogQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result.crawlerSummary?.totalCrawls).toBe(10_000);
    expect(result.crawlerSummary?.isPartial).toBe(true);
    expect(crawlerLogQuery.limit).toHaveBeenCalledTimes(10);
    expect(crawlerLogQuery.limit).toHaveBeenNthCalledWith(10, 1001);
  });

  it('does not mark crawler aggregation partial at the exact page cap', async () => {
    const cappedCrawlerRows = Array.from(
      { length: 10_000 },
      (_value, index) => ({
        agent_family: 'openai',
        bot_name: 'OpenAI',
        cache_outcome: 'hit',
        crawled_at: `2026-05-20T${String(Math.floor(index / 3600)).padStart(2, '0')}:${String(Math.floor(index / 60) % 60).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
        host: 'shop.example.com',
        id: `crawler-row-${String(index).padStart(5, '0')}`,
        response_time_ms: 120,
        status_code: 200,
        url_path: `/agent-page-${index}`,
        user_agent: 'GPTBot/1.0',
      })
    );
    const crawlerLogQuery = createCrawlerLogQuery({ data: cappedCrawlerRows });
    supabaseFrom.mockImplementation((table: string) => {
      if (table === 'crawler_logs') {
        return crawlerLogQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result.crawlerSummary?.totalCrawls).toBe(10_000);
    expect(result.crawlerSummary?.isPartial).toBe(false);
    expect(crawlerLogQuery.limit).toHaveBeenCalledTimes(10);
  });

  it('skips loaders when the store is unpublished', async () => {
    getMerchantForUser.mockResolvedValue({
      merchant: { ...merchant, is_published: false },
      staffAccess: ownerStaffAccess,
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(loadAgenticActionHealth).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
    expect(getCachedOpenAIFeedData).not.toHaveBeenCalled();
    expect(getCachedGoogleMerchantFeedData).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      actionCenterState: 'ready',
      actionHealth: null,
      crawlerCenterState: 'ready',
      crawlerSummary: null,
      isPublished: false,
      trustCenterState: 'ready',
      trustReadiness: null,
    });
  });

  it('returns unauthorized states when no merchant is available', async () => {
    getMerchantForUser.mockResolvedValue({
      merchant: null,
      staffAccess: {
        isOwner: false,
        isStaff: false,
        permissions: {},
        role: null,
      },
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result).toMatchObject({
      actionCenterState: 'unauthorized',
      actionHealth: null,
      crawlerCenterState: 'unauthorized',
      crawlerSummary: null,
      trustCenterState: 'unauthorized',
      trustReadiness: null,
    });
  });

  it('does not load centers when staff lacks integrations view permission', async () => {
    getMerchantForUser.mockResolvedValue({
      merchant,
      staffAccess: {
        isOwner: false,
        isStaff: true,
        permissions: {
          analytics: { view: false },
          integrations: { view: false },
        },
        role: 'manager',
      },
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(loadAgenticActionHealth).not.toHaveBeenCalled();
    expect(getCachedOpenAIFeedData).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      actionCenterState: 'unauthorized',
      actionHealth: null,
      crawlerCenterState: 'unauthorized',
      crawlerSummary: null,
      isPublished: true,
      trustCenterState: 'unauthorized',
      trustReadiness: null,
    });
  });

  it('marks action center unauthorized on permission-denied loader errors', async () => {
    loadAgenticActionHealth.mockRejectedValueOnce({
      code: '42501',
      message: 'permission denied for relation merchant_feature_settings',
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(result.actionCenterState).toBe('unauthorized');
    expect(result.actionHealth).toBeNull();
    expect(result.crawlerCenterState).toBe('ready');
    expect(result.trustCenterState).toBe('ready');
  });

  it('marks trust center unavailable when trust readiness loading fails', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    getCachedOpenAIFeedData.mockRejectedValueOnce(
      new Error('feed unavailable')
    );
    const { loadAgenticCentersData } = await import('./data');

    try {
      const result = await loadAgenticCentersData();

      expect(result.actionCenterState).toBe('ready');
      expect(result.actionHealth).toBe(actionHealth);
      expect(result.crawlerCenterState).toBe('ready');
      expect(result.trustCenterState).toBe('error');
      expect(result.trustReadiness).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch trust readiness:',
        'feed unavailable'
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('keeps crawler visibility available for staff with analytics view only', async () => {
    getMerchantForUser.mockResolvedValue({
      merchant,
      staffAccess: {
        isOwner: false,
        isStaff: true,
        permissions: {
          analytics: { view: true },
          integrations: { view: false },
        },
        role: 'marketing',
      },
    });
    const { loadAgenticCentersData } = await import('./data');

    const result = await loadAgenticCentersData();

    expect(loadAgenticActionHealth).not.toHaveBeenCalled();
    expect(getCachedOpenAIFeedData).not.toHaveBeenCalled();
    expect(result.actionCenterState).toBe('unauthorized');
    expect(result.trustCenterState).toBe('unauthorized');
    expect(result.crawlerCenterState).toBe('ready');
    expect(result.crawlerSummary?.totalCrawls).toBe(2);
  });

  it('marks crawler visibility unavailable when crawler loading fails', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    supabaseFrom.mockImplementation((table: string) => {
      if (table === 'crawler_logs') {
        return createCrawlerLogQuery({
          data: null,
          error: { message: 'crawler logs unavailable' },
        });
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    const { loadAgenticCentersData } = await import('./data');

    try {
      const result = await loadAgenticCentersData();

      expect(result.actionCenterState).toBe('ready');
      expect(result.trustCenterState).toBe('ready');
      expect(result.crawlerCenterState).toBe('error');
      expect(result.crawlerSummary).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch crawler visibility:',
        'crawler logs unavailable'
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

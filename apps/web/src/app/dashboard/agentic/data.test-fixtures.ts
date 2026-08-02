import { vi } from 'vitest';

const merchant = {
  business_name: 'Demo Store',
  custom_domain: null,
  feature_settings: {
    agentic_checkout_enabled: true,
    custom_settings: {
      agentic_agent_allowlist: ['openai-agent'],
      agentic_agent_denylist: ['legacy-bot'],
      unrelated_setting: 'preserve-me',
    },
  },
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

export {
  actionHealth,
  createCrawlerLogQuery,
  fullReadiness,
  merchant,
  ownerStaffAccess,
};

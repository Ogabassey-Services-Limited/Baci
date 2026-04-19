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
  'buyer-guide': [
    'buyer guide',
    'buying guide',
    'how to choose',
    'what to buy',
  ],
  'best-in-nigeria': ['best', 'top', 'nigeria', 'budget', 'affordable'],
  troubleshooting: ['fix', 'troubleshoot', 'problem', 'issue', 'repair', 'why'],
  'decision-support': ['vs', 'versus', 'compare', 'difference', 'which'],
} as const;

export const CONTENT_CLUSTER_SCORE = {
  categoryMatch: 4,
  kindMatch: 2,
  brandMatch: 2,
  priceBandMatch: 2,
  productTokenMatch: 1,
  titleTokenMatch: 1,
} as const;

export interface ProductSEO {
  productId: string;
  productName: string;
  seoScore: number;
  hasTitle: boolean;
  hasDescription: boolean;
  hasKeywords: boolean;
  issues: string[];
}

export interface SEOSummary {
  totalProducts: number;
  averageSEOScore: number;
  missingTitle: number;
  missingDescription: number;
  missingKeywords: number;
  fullyOptimized: number;
  needsWork: number;
}

export interface SEOOptimization {
  productId: string;
  productName: string;
  original: {
    meta_title?: string;
    meta_description?: string;
    keywords?: string[];
  };
  optimized: {
    meta_title: string;
    meta_description: string;
    keywords: string[];
    focus_keyword: string;
    seo_score: number;
    suggestions: string[];
  };
}

interface SEOAnalysis {
  title_length: number;
  title_has_keyword: boolean;
  description_length: number;
  description_has_keyword: boolean;
  keyword_count: number;
  score: number;
  issues: string[];
  suggestions: string[];
}

export function analyzeSEO(
  title: string,
  description: string,
  keywords: string[],
  focusKeyword: string
): SEOAnalysis {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  const titleLength = title.length;
  const titleHasKeyword =
    focusKeyword.length > 0 &&
    title.toLowerCase().includes(focusKeyword.toLowerCase());
  if (titleLength < 30) {
    issues.push('Title is too short (< 30 chars)');
    score -= 15;
  } else if (titleLength > 60) {
    issues.push('Title is too long (> 60 chars)');
    score -= 10;
  }
  if (!titleHasKeyword) {
    issues.push('Focus keyword not found in title');
    score -= 20;
    suggestions.push(`Add "${focusKeyword}" to the title`);
  }

  const descLength = description.length;
  const descHasKeyword =
    focusKeyword.length > 0 &&
    description.toLowerCase().includes(focusKeyword.toLowerCase());
  if (descLength < 120) {
    issues.push('Meta description is too short (< 120 chars)');
    score -= 15;
  } else if (descLength > 160) {
    issues.push('Meta description is too long (> 160 chars)');
    score -= 10;
  }
  if (!descHasKeyword) {
    issues.push('Focus keyword not found in description');
    score -= 15;
    suggestions.push(`Include "${focusKeyword}" in the meta description`);
  }

  if (keywords.length < 3) {
    issues.push('Too few keywords (< 3)');
    score -= 10;
    suggestions.push('Add more relevant keywords');
  } else if (keywords.length > 10) {
    issues.push('Too many keywords (> 10)');
    score -= 5;
  }
  if (!title.match(/buy|shop|best|top|quality|premium/i)) {
    suggestions.push(
      'Consider adding power words like "Best", "Premium", or "Quality"'
    );
  }
  if (
    !description.includes('₦') &&
    !description.match(/free shipping|discount|sale/i)
  ) {
    suggestions.push(
      'Consider mentioning price or promotions in the description'
    );
  }

  return {
    title_length: titleLength,
    title_has_keyword: titleHasKeyword,
    description_length: descLength,
    description_has_keyword: descHasKeyword,
    keyword_count: keywords.length,
    score: Math.max(0, score),
    issues,
    suggestions,
  };
}

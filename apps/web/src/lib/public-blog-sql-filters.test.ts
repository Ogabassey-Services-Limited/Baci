import { describe, expect, it } from 'vitest';
import {
  BLOCKED_PUBLIC_BLOG_CATEGORY_VALUES,
  BLOCKED_PUBLIC_BLOG_POST_SLUG_PARTS,
  BLOCKED_PUBLIC_BLOG_POST_TITLE_PREFIXES,
} from './public-blog-content-quality';
import { applyPublicBlogSqlFilters } from './public-blog-sql-filters';

describe('applyPublicBlogSqlFilters', () => {
  it('applies public blog post blocklist filters', () => {
    const filters: [string, string, string][] = [];
    const query = {
      not(column: string, operator: 'ilike', value: string) {
        filters.push([column, operator, value]);
        return this;
      },
    };

    expect(applyPublicBlogSqlFilters(query)).toBe(query);
    expect(filters).toEqual([
      ...BLOCKED_PUBLIC_BLOG_POST_TITLE_PREFIXES.map(
        (prefix): [string, string, string] => ['title', 'ilike', `${prefix}%`]
      ),
      ...BLOCKED_PUBLIC_BLOG_POST_SLUG_PARTS.map(
        (part): [string, string, string] => ['slug', 'ilike', `%${part}%`]
      ),
    ]);
  });

  it('adds category filters when requested', () => {
    const filters: [string, string, string][] = [];
    const query = {
      not(column: string, operator: 'ilike', value: string) {
        filters.push([column, operator, value]);
        return this;
      },
    };

    applyPublicBlogSqlFilters(query, { includeCategoryFilters: true });

    expect(filters).toEqual([
      ...BLOCKED_PUBLIC_BLOG_POST_TITLE_PREFIXES.map(
        (prefix): [string, string, string] => ['title', 'ilike', `${prefix}%`]
      ),
      ...BLOCKED_PUBLIC_BLOG_POST_SLUG_PARTS.map(
        (part): [string, string, string] => ['slug', 'ilike', `%${part}%`]
      ),
      ...BLOCKED_PUBLIC_BLOG_CATEGORY_VALUES.map((category) => [
        'category',
        'ilike',
        category,
      ]),
    ]);
  });
});

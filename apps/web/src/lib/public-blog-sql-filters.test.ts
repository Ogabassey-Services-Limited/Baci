import { describe, expect, it } from 'vitest';
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
      ['title', 'ilike', 'test post%'],
      ['slug', 'ilike', '%agent-integration-working%'],
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

    expect(filters).toContainEqual(['category', 'ilike', 'test']);
    expect(filters).toContainEqual(['category', 'ilike', 'uncategorized']);
  });
});

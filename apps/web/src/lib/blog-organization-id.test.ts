import { describe, expect, it } from 'vitest';
import { buildBlogOrganizationId } from './blog-organization-id';

describe('buildBlogOrganizationId', () => {
  it('normalizes trailing slashes before appending the organization fragment', () => {
    expect(buildBlogOrganizationId('https://ogabassey.com')).toBe(
      'https://ogabassey.com#organization'
    );
    expect(buildBlogOrganizationId('https://ogabassey.com/')).toBe(
      'https://ogabassey.com#organization'
    );
  });
});

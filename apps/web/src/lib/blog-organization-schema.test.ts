import { describe, expect, it } from 'vitest';
import {
  buildBlogOrganizationId,
  buildBlogOrganizationSchema,
} from './blog-organization-schema';

describe('buildBlogOrganizationSchema', () => {
  it('builds a stable entity id from the storefront origin', () => {
    expect(buildBlogOrganizationId('https://ogabassey.com')).toBe(
      'https://ogabassey.com#organization'
    );
    expect(buildBlogOrganizationId('https://ogabassey.com/')).toBe(
      'https://ogabassey.com#organization'
    );
  });

  it('emits an OnlineStore entity with logo and normalized social sameAs', () => {
    const schema = buildBlogOrganizationSchema(
      {
        business_name: 'Ogabassey',
        logo_url: 'https://cdn.ogabassey.com/logo.png',
        country: 'NG',
        social_media: {
          facebook: 'ogabassey',
          instagram: '@ogabassey',
          twitter: 'https://twitter.com/ogabassey',
        },
      },
      'https://ogabassey.com'
    );

    expect(schema['@type']).toBe('OnlineStore');
    expect(schema['@id']).toBe('https://ogabassey.com#organization');
    expect(schema.name).toBe('Ogabassey');
    expect(schema.url).toBe('https://ogabassey.com');
    expect(schema.logo).toEqual(
      expect.objectContaining({
        '@type': 'ImageObject',
        url: 'https://cdn.ogabassey.com/logo.png',
      })
    );
    expect(schema.sameAs).toEqual([
      'https://facebook.com/ogabassey',
      'https://instagram.com/ogabassey',
      'https://twitter.com/ogabassey',
    ]);
  });

  it('omits logo and sameAs when the merchant has neither', () => {
    const schema = buildBlogOrganizationSchema(
      { business_name: 'Bare Store' },
      'https://bare.example.com'
    );

    expect(schema['@type']).toBe('OnlineStore');
    expect(schema.name).toBe('Bare Store');
    expect(schema.url).toBe('https://bare.example.com');
    expect(schema.logo).toBeUndefined();
    expect(schema.sameAs).toBeUndefined();
  });

  it('handles null logo_url and null social_media gracefully', () => {
    const schema = buildBlogOrganizationSchema(
      {
        business_name: 'Null Fields Store',
        logo_url: null,
        country: null,
        social_media: null,
      },
      'https://nullfields.example.com'
    );

    expect(schema.name).toBe('Null Fields Store');
    expect(schema.logo).toBeUndefined();
    expect(schema.sameAs).toBeUndefined();
  });
});

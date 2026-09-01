import { describe, expect, it } from 'vitest';
import { addPublicProjectionSeoPolicyPaths } from './add-public-projection-seo-policy-paths';

describe('addPublicProjectionSeoPolicyPaths', () => {
  it('adds route paths for populated policy fields', () => {
    const paths = new Set<string>();

    addPublicProjectionSeoPolicyPaths(paths, {
      privacy: 'Privacy policy',
      returnPolicy: { sections: ['returns'] },
      shipping: 'Shipping policy',
      terms: 'Terms of service',
    });

    expect([...paths].sort()).toEqual([
      '/privacy',
      '/privacy-policy',
      '/returns',
      '/shipping',
      '/terms',
      '/terms-and-conditions',
      '/terms-of-service',
    ]);
  });

  it('does not add paths for empty or absent policies', () => {
    const paths = new Set<string>(['/existing']);

    addPublicProjectionSeoPolicyPaths(paths, {
      privacy: '   ',
      returns: ' ',
      shipping: undefined,
      terms: undefined,
    });
    addPublicProjectionSeoPolicyPaths(paths, undefined);

    expect([...paths]).toEqual(['/existing']);
  });
});

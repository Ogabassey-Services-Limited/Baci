import { describe, it } from 'vitest';
import { expectLoadingModuleRenders } from '@/app/(storefront)/[slug]/loading-route-test-utils';

describe('(catalog) loading', () => {
  it('renders the shared catalog loading boundary', async () => {
    await expectLoadingModuleRenders(
      import.meta.url,
      'Loading product listing'
    );
  });
});

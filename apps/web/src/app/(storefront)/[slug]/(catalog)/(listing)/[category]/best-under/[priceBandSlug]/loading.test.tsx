import { describe, it } from 'vitest';
import { expectLoadingModuleRenders } from '@/app/(storefront)/[slug]/loading-route-test-utils';

describe('category price band loading', () => {
  it('renders the shared product listing loading boundary', async () => {
    await expectLoadingModuleRenders(
      import.meta.url,
      'Loading product listing'
    );
  });
});

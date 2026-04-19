import { describe, it } from 'vitest';
import { expectLoadingModuleRenders } from '@/app/(storefront)/[slug]/loading-route-test-utils';

describe('(home) loading', () => {
  it('renders the shared homepage loading boundary', async () => {
    await expectLoadingModuleRenders(
      import.meta.url,
      'Loading storefront homepage'
    );
  });
});

import { describe, it } from 'vitest';
import { expectLoadingModuleRenders } from '@/app/(storefront)/[slug]/loading-route-test-utils';

describe('category comparison loading', () => {
  it('renders the shared product detail loading boundary', async () => {
    await expectLoadingModuleRenders(import.meta.url, 'Loading product page');
  });
});

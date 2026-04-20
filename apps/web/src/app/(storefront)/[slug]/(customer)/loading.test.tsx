import { describe, it } from 'vitest';
import { expectLoadingModuleRenders } from '@/app/(storefront)/[slug]/loading-route-test-utils';

describe('(customer) loading', () => {
  it('renders the shared customer loading boundary', async () => {
    await expectLoadingModuleRenders(import.meta.url, 'Loading customer page');
  });
});

import { describe, it } from 'vitest';
import { expectLoadingModuleRenders } from '@/app/(storefront)/[slug]/loading-route-test-utils';

describe('(commerce) loading', () => {
  it('renders the shared commerce loading boundary', async () => {
    await expectLoadingModuleRenders(import.meta.url, 'Loading commerce page');
  });
});

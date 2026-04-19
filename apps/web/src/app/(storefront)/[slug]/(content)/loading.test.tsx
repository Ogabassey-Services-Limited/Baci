import { describe, it } from 'vitest';
import { expectLoadingModuleRenders } from '@/app/(storefront)/[slug]/loading-route-test-utils';

describe('(content) loading', () => {
  it('renders the shared content loading boundary', async () => {
    await expectLoadingModuleRenders(import.meta.url, 'Loading page content');
  });
});

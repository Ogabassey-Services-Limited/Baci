import { describe, it } from 'vitest';
import { expectLoadingModuleRenders } from '@/app/(storefront)/[slug]/loading-route-test-utils';

describe('blog post loading', () => {
  it('renders the shared blog post loading boundary', async () => {
    await expectLoadingModuleRenders(import.meta.url, 'Loading blog post');
  });
});

import { describe, it } from 'vitest';
import { expectLoadingModuleRenders } from '@/app/(storefront)/[slug]/loading-route-test-utils';

describe('(blog) loading', () => {
  it('renders the shared blog listing loading boundary', async () => {
    await expectLoadingModuleRenders(import.meta.url, 'Loading blog posts');
  });
});

import { expectLoadingModuleRenders } from '@/app/(storefront)/[slug]/loading-route-test-utils';

describe('dashboard blog edit loading', () => {
  it('renders a route-owned loading state for first navigation', async () => {
    await expectLoadingModuleRenders(
      import.meta.url,
      'Loading blog post editor'
    );
  });
});

import { describe, expect, it } from 'vitest';
import { isStorefrontDocumentNavigation } from '@/lib/storefront-document-navigation';

describe('isStorefrontDocumentNavigation', () => {
  it('recognizes only document GET and HEAD requests as eligible for synthetic statuses', () => {
    // Arrange
    const documentHeaders = new Headers({ 'sec-fetch-dest': 'document' });
    const rscHeaders = new Headers({ rsc: '1' });
    const prefetchHeaders = new Headers({ 'next-router-prefetch': '1' });
    const routerStateHeaders = new Headers({
      'next-router-state-tree': '%5B%22%22%5D',
    });
    const imageHeaders = new Headers({ 'sec-fetch-dest': 'image' });

    // Act
    const documentNavigation = isStorefrontDocumentNavigation(
      'GET',
      documentHeaders
    );
    const rscNavigation = isStorefrontDocumentNavigation('GET', rscHeaders);
    const prefetchNavigation = isStorefrontDocumentNavigation(
      'GET',
      prefetchHeaders
    );
    const routerStateNavigation = isStorefrontDocumentNavigation(
      'GET',
      routerStateHeaders
    );
    const imageNavigation = isStorefrontDocumentNavigation('GET', imageHeaders);

    // Assert
    expect(documentNavigation).toBe(true);
    expect(rscNavigation).toBe(false);
    expect(prefetchNavigation).toBe(false);
    expect(routerStateNavigation).toBe(false);
    expect(imageNavigation).toBe(false);
    expect(isStorefrontDocumentNavigation('POST', documentHeaders)).toBe(false);
  });
});

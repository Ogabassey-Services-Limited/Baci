import { getHomeProductGridSummary } from './home-product-grid-summary';
import type { Block } from '@/types/blocks';

function productGrid(id: string): Block {
  return {
    type: 'ProductGrid',
    props: {
      id,
      title: `Grid ${id}`,
    },
  };
}

function categoryRail(id: string): Block {
  return {
    type: 'CategoryRail',
    props: {
      id,
      title: `Category ${id}`,
    },
  };
}

describe('getHomeProductGridSummary', () => {
  it('summarizes product grid blocks with category state for reset keys', () => {
    const blocks = [
      categoryRail('categories'),
      productGrid('featured'),
      productGrid('recent'),
    ];

    const summary = getHomeProductGridSummary(blocks, 'phones');

    expect(summary).toEqual({
      primaryProductGridIndex: 1,
      productGridBlockCount: 2,
      productGridDatasetKey: JSON.stringify({
        selectedCategoryId: 'phones',
        productGridBlockIds: ['featured', 'recent'],
      }),
    });
  });

  it('returns an empty-grid summary when no product grid exists', () => {
    const summary = getHomeProductGridSummary(
      [categoryRail('categories')],
      null
    );

    expect(summary).toEqual({
      primaryProductGridIndex: -1,
      productGridBlockCount: 0,
      productGridDatasetKey: JSON.stringify({
        selectedCategoryId: null,
        productGridBlockIds: [],
      }),
    });
  });
});

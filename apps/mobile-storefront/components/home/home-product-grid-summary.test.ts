import type { Block } from '@/types/blocks';
import { getHomeProductGridSummary } from './home-product-grid-summary';

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
  it('locates the primary product grid and counts grid blocks', () => {
    const blocks = [
      categoryRail('categories'),
      productGrid('featured'),
      productGrid('recent'),
    ];

    const summary = getHomeProductGridSummary(blocks);

    expect(summary).toEqual({
      primaryProductGridIndex: 1,
      productGridBlockCount: 2,
    });
  });

  it('returns an empty-grid summary when no product grid exists', () => {
    const summary = getHomeProductGridSummary([categoryRail('categories')]);

    expect(summary).toEqual({
      primaryProductGridIndex: -1,
      productGridBlockCount: 0,
    });
  });
});

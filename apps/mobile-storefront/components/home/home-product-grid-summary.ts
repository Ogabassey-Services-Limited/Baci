import type { Block } from '@/types/blocks';

interface HomeProductGridSummary {
  primaryProductGridIndex: number;
  productGridBlockCount: number;
  productGridDatasetKey: string;
}

export function getHomeProductGridSummary(
  blocks: Block[],
  selectedCategoryId: string | null
): HomeProductGridSummary {
  const productGridBlocks = blocks.filter((block) => block.type === 'ProductGrid');
  const productGridBlockIds = productGridBlocks.map(
    (block) => block.props.id ?? block.type
  );
  const primaryProductGridId = productGridBlocks[0]?.props.id ?? null;
  const primaryProductGridIndex = primaryProductGridId
    ? blocks.findIndex(
        (block) =>
          block.type === 'ProductGrid' && block.props.id === primaryProductGridId
      )
    : blocks.findIndex((block) => block.type === 'ProductGrid');

  return {
    primaryProductGridIndex,
    productGridBlockCount: productGridBlocks.length,
    productGridDatasetKey: JSON.stringify({
      selectedCategoryId,
      productGridBlockIds,
    }),
  };
}

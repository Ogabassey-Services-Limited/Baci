import type { Block } from '@/types/blocks';

interface HomeProductGridSummary {
  primaryProductGridIndex: number;
  productGridBlockCount: number;
}

export function getHomeProductGridSummary(
  blocks: Block[]
): HomeProductGridSummary {
  const productGridBlocks = blocks.filter(
    (block) => block.type === 'ProductGrid'
  );
  const primaryProductGridId = productGridBlocks[0]?.props.id ?? null;
  const primaryProductGridIndex = primaryProductGridId
    ? blocks.findIndex(
        (block) =>
          block.type === 'ProductGrid' &&
          block.props.id === primaryProductGridId
      )
    : blocks.findIndex((block) => block.type === 'ProductGrid');

  return {
    primaryProductGridIndex,
    productGridBlockCount: productGridBlocks.length,
  };
}

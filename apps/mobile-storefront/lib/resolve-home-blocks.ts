import type { Block } from '@/types/blocks';

const DEFAULT_HOME_BLOCKS: Block[] = [
  { type: 'HeroCarousel', props: { id: 'default-hero', slides: [] } },
  {
    type: 'CategoryRail',
    props: { id: 'default-categories', title: 'Shop by Category' },
  },
  {
    type: 'ProductGrid',
    props: {
      id: 'default-products',
      title: 'Featured Products',
      limit: 12,
    },
  },
];

function isBlockArray(content: unknown): content is Block[] {
  return (
    Array.isArray(content) &&
    content.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        'type' in item &&
        typeof item.type === 'string' &&
        'props' in item &&
        typeof item.props === 'object' &&
        item.props !== null &&
        !Array.isArray(item.props) &&
        'id' in item.props &&
        typeof item.props.id === 'string'
    )
  );
}

export function resolveHomeBlocks(
  content: unknown,
  isElite: boolean,
  isInitialLoading: boolean
): Block[] {
  if (isInitialLoading) {
    return [];
  }

  const blocks = isBlockArray(content) ? content : DEFAULT_HOME_BLOCKS;
  if (!isElite || blocks.some((block) => block.type === 'CategoryRail')) {
    return blocks;
  }

  const nextBlocks = [...blocks];
  const heroIndex = nextBlocks.findIndex(
    (block) => block.type === 'HeroCarousel'
  );
  const injected: Block = {
    type: 'CategoryRail',
    props: { id: 'forced-categories', slug: 'utility' },
  };

  if (heroIndex === -1) {
    nextBlocks.unshift(injected);
  } else {
    nextBlocks.splice(heroIndex + 1, 0, injected);
  }

  return nextBlocks;
}

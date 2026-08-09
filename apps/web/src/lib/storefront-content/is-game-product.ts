import type { BuildCommercialGuideLinksContext } from './content-cluster-types';

const GAME_CATEGORY_PATTERN =
  /^(?:(?:portable-)?gaming|playstation-[45]|nintendo-switch(?:-2)?|xbox)$/u;
const GAME_HARDWARE_MARKERS = new Set([
  'adapter',
  'cable',
  'charger',
  'controller',
  'dock',
  'headset',
  'keyboard',
  'remote',
  'speaker',
  'stand',
]);

/** Decides whether catalog wording should preserve game-title tokens. */
export function isGameProduct(
  context: Omit<BuildCommercialGuideLinksContext, 'pageKind'>,
  tokenize: (value: string) => string[]
) {
  if (!GAME_CATEGORY_PATTERN.test(context.categorySlug)) {
    return false;
  }
  return !(context.productNames ?? context.productSlugs ?? [])
    .flatMap(tokenize)
    .some((token) => GAME_HARDWARE_MARKERS.has(token));
}

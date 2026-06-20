import { StyleSheet } from 'react-native';

/**
 * Cell + content styles for the virtualized home feed. Grid cells mirror the
 * shipping `category/[slug]` 2-col precedent (flex:1 wrapper + index%2 gutter);
 * list/editorial cells fill the row and self-inset via the card's own margins.
 */
export const homeFeedStyles = StyleSheet.create({
  productWrapper: {
    flex: 1,
  },
  productLeft: {
    paddingRight: 8,
  },
  productRight: {
    paddingLeft: 8,
  },
  fullWidthCell: {
    width: '100%',
  },
});

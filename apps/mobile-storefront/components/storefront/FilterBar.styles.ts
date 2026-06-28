import { Platform, StyleSheet } from 'react-native';
import { BRAND, palette, RADIUS } from '@/constants/Colors';
import { getFilterBarShadowStyles } from './FilterBar.shadows';

const shadowStyles = getFilterBarShadowStyles(
  Platform.OS === 'web' ? 'web' : 'native'
);

export const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray[100],
    zIndex: 1000,
    elevation: 4,
    paddingBottom: 4,
  },
  categoryList: {
    borderBottomWidth: 1,
    borderBottomColor: palette.gray[50],
  },
  categoryContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.gray[200],
    gap: 6,
  },
  catPillActive: {
    backgroundColor: BRAND.primary,
    borderColor: BRAND.primary,
    ...shadowStyles.catPillActive,
  },
  catText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.gray[700],
    fontFamily: 'serif',
  },
  catTextActive: {
    color: palette.white,
  },
  toolsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 2000,
  },
  mainTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 2000,
  },
  filterWrapper: {
    position: 'relative',
    zIndex: 3000,
    elevation: 20,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.red[50],
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: palette.red[100],
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.primary,
    fontFamily: 'serif',
  },
  chevron: {
    marginTop: 1,
  },
  popover: {
    position: 'absolute',
    top: 42,
    left: 0,
    width: 200,
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 6,
    ...shadowStyles.popover,
    borderWidth: 1,
    borderColor: palette.gray[100],
    zIndex: 4000,
  },
  popoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 10,
  },
  popoverItemActive: {
    backgroundColor: palette.red[50],
  },
  popoverText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.gray[600],
    fontFamily: 'serif',
  },
  popoverTextActive: {
    color: BRAND.primary,
    fontWeight: '800',
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  vDivider: {
    width: 1,
    height: 24,
    backgroundColor: palette.gray[200],
  },
  dynamicArea: {
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.gray[100],
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 32,
  },
  currency: {
    fontSize: 11,
    color: palette.gray[500],
    fontWeight: '700',
    marginRight: 2,
  },
  priceInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: palette.gray[900],
    padding: 0,
    fontFamily: 'serif',
  },
  dash: {
    color: palette.gray[300],
    fontWeight: '700',
    fontSize: 10,
  },
  brandScroll: {
    flexGrow: 0,
  },
  brandScrollContent: {
    alignItems: 'center',
    paddingRight: 4,
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginRight: 8,
  },
  brandChipActive: {
    backgroundColor: palette.red[500],
    borderColor: palette.red[500],
    ...shadowStyles.brandChipActive,
  },
  brandChipInactive: {
    backgroundColor: palette.white,
    borderColor: palette.gray[200],
  },
  brandChipIcon: {
    marginRight: 6,
  },
  brandChipText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'serif',
  },
  brandChipTextActive: {
    color: palette.white,
  },
  brandChipTextInactive: {
    color: palette.gray[600],
  },
  conditionSegment: {
    flexDirection: 'row',
    backgroundColor: palette.gray[100],
    padding: 2,
    borderRadius: 10,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentItemActive: {
    backgroundColor: palette.white,
    ...shadowStyles.segmentItemActive,
  },
  segmentText: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.gray[500],
    fontFamily: 'serif',
  },
  segmentTextActive: {
    color: palette.gray[900],
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingChipActive: {
    backgroundColor: palette.amber[100],
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '800',
    color: palette.gray[500],
    fontFamily: 'serif',
  },
  ratingTextActive: {
    color: palette.amber[700],
  },
  anyText: {
    fontSize: 11,
    color: palette.gray[400],
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  anyTextActive: {
    color: palette.gray[900],
    fontWeight: '800',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: palette.gray[100],
    padding: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.gray[200],
  },
  viewBtn: {
    padding: 6,
    borderRadius: 8,
  },
  viewBtnActive: {
    backgroundColor: palette.white,
    ...shadowStyles.viewBtnActive,
  },
  backdrop: {
    position: 'absolute',
    top: -500,
    left: -500,
    right: -500,
    bottom: -1500,
    backgroundColor: 'transparent',
    zIndex: 105,
  },
});

import { StyleSheet } from 'react-native';
import { BRAND, SPACING } from '@/constants/Colors';

export const utilityPanelStyles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginTop: -8,
    marginBottom: 0,
    transform: [{ translateY: 8 }],
    borderRadius: 24,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
  },
  minimalContainer: { paddingVertical: SPACING.sm },
  promoBanner: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingVertical: 10,
    borderRadius: 16,
  },
  promoText: { fontSize: 11, textAlign: 'center' },
  promoHighlight: { color: BRAND.primary, fontWeight: '700' },
  categoriesContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    width: '100%',
  },
  circleItem: { alignItems: 'center', flex: 1 },
  circleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  circleIconActive: {
    borderColor: BRAND.primary,
    borderWidth: 1,
  },
  circleLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  circleLabelActive: {
    fontWeight: '700',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
});

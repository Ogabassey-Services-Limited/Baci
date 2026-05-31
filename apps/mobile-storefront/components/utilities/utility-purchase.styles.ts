import { StyleSheet } from 'react-native';
import { SHADOWS } from '@/constants/Colors';

const UTILITY_PURCHASE_STYLE_TOKENS = {
  backButtonBorderRadius: 999,
  backButtonGap: 4,
  backButtonMinHeight: 34,
  backButtonPaddingHorizontal: 9,
  errorMessageFontSize: 15,
  fontSizeLg: 20,
  fontSizeMd: 14,
  fontSizeSm: 12,
  fontWeightSemibold: '600',
  fontWeightBold: '700',
  headerIconCircleSize: 40,
  headerIconButtonSize: 44,
  headerPaddingBottom: 12,
  headerPaddingHorizontal: 16,
  headerSideWidth: 44,
  marginBottomSm: 8,
} as const;

export const utilityPurchaseStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: UTILITY_PURCHASE_STYLE_TOKENS.headerPaddingHorizontal,
    paddingBottom: UTILITY_PURCHASE_STYLE_TOKENS.headerPaddingBottom,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: 'relative',
    minHeight: UTILITY_PURCHASE_STYLE_TOKENS.headerIconButtonSize,
  },
  headerSide: {
    position: 'absolute',
    left: UTILITY_PURCHASE_STYLE_TOKENS.headerPaddingHorizontal,
    width: UTILITY_PURCHASE_STYLE_TOKENS.headerSideWidth,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  headerSideRight: {
    position: 'absolute',
    right: UTILITY_PURCHASE_STYLE_TOKENS.headerPaddingHorizontal,
    width: UTILITY_PURCHASE_STYLE_TOKENS.headerSideWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: UTILITY_PURCHASE_STYLE_TOKENS.fontSizeLg,
    fontWeight: UTILITY_PURCHASE_STYLE_TOKENS.fontWeightBold,
    textAlign: 'center',
  },
  headerIconButton: {
    width: UTILITY_PURCHASE_STYLE_TOKENS.headerIconButtonSize,
    height: UTILITY_PURCHASE_STYLE_TOKENS.headerIconButtonSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconCircle: {
    alignItems: 'center',
    borderRadius: UTILITY_PURCHASE_STYLE_TOKENS.headerIconCircleSize / 2,
    height: UTILITY_PURCHASE_STYLE_TOKENS.headerIconCircleSize,
    justifyContent: 'center',
    width: UTILITY_PURCHASE_STYLE_TOKENS.headerIconCircleSize,
    ...SHADOWS.xl,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: UTILITY_PURCHASE_STYLE_TOKENS.headerPaddingHorizontal,
  },
  errorTitle: {
    fontSize: UTILITY_PURCHASE_STYLE_TOKENS.fontSizeLg,
    fontWeight: UTILITY_PURCHASE_STYLE_TOKENS.fontWeightBold,
    marginBottom: UTILITY_PURCHASE_STYLE_TOKENS.marginBottomSm,
  },
  errorMessage: {
    fontSize: UTILITY_PURCHASE_STYLE_TOKENS.errorMessageFontSize,
    textAlign: 'center',
    marginBottom: UTILITY_PURCHASE_STYLE_TOKENS.headerPaddingHorizontal,
  },
  backButton: {
    minHeight: UTILITY_PURCHASE_STYLE_TOKENS.backButtonMinHeight,
    paddingHorizontal:
      UTILITY_PURCHASE_STYLE_TOKENS.backButtonPaddingHorizontal,
    borderRadius: UTILITY_PURCHASE_STYLE_TOKENS.backButtonBorderRadius,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: UTILITY_PURCHASE_STYLE_TOKENS.backButtonGap,
  },
  backButtonText: {
    fontSize: UTILITY_PURCHASE_STYLE_TOKENS.fontSizeMd,
    fontWeight: UTILITY_PURCHASE_STYLE_TOKENS.fontWeightSemibold,
  },
});

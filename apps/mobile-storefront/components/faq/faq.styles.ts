import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/Colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: 'Inter_700Bold',
    marginBottom: SPACING.md,
  },
  supportGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  supportCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  supportIconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  supportTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    marginBottom: 2,
  },
  supportSubtitle: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  faqList: {
    gap: SPACING.sm,
  },
  faqItem: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  faqQuestion: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 22,
  },
  faqAnswer: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
    marginTop: SPACING.sm,
  },
  storeInfo: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
  },
  storeInfoTitle: {
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_700Bold',
    marginBottom: SPACING.sm,
  },
  storeInfoText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  storeAddressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
});

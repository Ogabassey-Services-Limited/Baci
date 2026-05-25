import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const blogPreviewStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerSpacer: {
    width: 32,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  content: {
    padding: SPACING.lg,
  },
  card: {
    borderRadius: RADIUS.xl,
    gap: SPACING.md,
    overflow: 'hidden',
    padding: SPACING.lg,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  statusText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.xs,
    textTransform: 'uppercase',
  },
  featuredImage: {
    aspectRatio: 16 / 9,
    borderRadius: RADIUS.lg,
    width: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    aspectRatio: 16 / 9,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    width: '100%',
  },
  placeholderText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.sm,
  },
  category: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.sm,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size['3xl'],
    lineHeight: 32,
  },
  excerpt: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    lineHeight: 22,
  },
  webViewContainer: {
    height: 520,
  },
  webView: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: SPACING['2xl'],
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.xl,
    marginTop: SPACING.md,
  },
  emptyBody: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
});

import { StyleSheet } from 'react-native';
import { palette, SPACING, TYPOGRAPHY } from '@/constants/Colors';

export const styles = StyleSheet.create({
  section: {
    paddingVertical: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: 'Inter_700Bold',
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  list: {
    flexDirection: 'column',
  },
  gridWrapper: {
    width: '50%',
    paddingHorizontal: 8,
  },
  editorialWrapper: {
    width: '100%',
  },
  listWrapper: {
    width: '100%',
  },
  emptyState: {
    width: '100%',
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.gray[300],
  },
  retryButtonText: {
    color: palette.gray[700],
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  loadingMore: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
});

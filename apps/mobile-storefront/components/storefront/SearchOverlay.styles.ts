import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/Colors';

export const searchOverlayStyles = StyleSheet.create({
  sheet: {
    flex: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  contentContainer: {
    flex: 1,
    padding: SPACING.md,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 6,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  categoryCard: {
    width: '48%',
    padding: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultDetails: {
    flex: 1,
    gap: 4,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  aiPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: 12,
    backgroundColor: 'rgba(BRAND.primary, 0.05)',
    marginBottom: 24,
    borderStyle: 'dashed',
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
});

import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const variantInventoryUnitsSheetStyles = StyleSheet.create({
  actionButton: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    justifyContent: 'flex-end',
    marginTop: SPACING.md,
  },
  badgeOption: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  card: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  editInput: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontSize: TYPOGRAPHY.size.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.size.md,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  filterBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  filterScroll: {
    gap: SPACING.xs,
  },
  filterTab: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  formRow: {
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  identifier: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  listContent: {
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  metadata: {
    fontSize: 11,
    marginTop: 2,
  },
  notesText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
  },
  statusBadge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
});

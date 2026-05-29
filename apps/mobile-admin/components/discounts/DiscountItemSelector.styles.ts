import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const styles = StyleSheet.create({
  closeBtn: { padding: SPACING.xs },
  container: { flex: 1 },
  errorBanner: {
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    flexDirection: 'row',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    padding: SPACING.sm,
  },
  errorText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  itemDesc: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: 2,
  },
  itemImage: {
    borderRadius: RADIUS.sm,
    height: 50,
    marginRight: SPACING.md,
    width: 50,
  },
  itemInfo: { flex: 1, marginRight: SPACING.md },
  itemName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  itemRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  list: { paddingHorizontal: SPACING.md },
  loader: { marginTop: SPACING.xl },
  saveBtn: { padding: SPACING.xs },
  saveText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
  },
  searchContainer: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    margin: SPACING.md,
    padding: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    marginLeft: SPACING.sm,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
  },
});

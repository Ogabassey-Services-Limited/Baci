import { StyleSheet } from 'react-native';
import {
  AI_ACCENT_COLOR,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/theme';

export const BLOG_EDITOR_AI_COLOR = AI_ACCENT_COLOR;
export const BLOG_EDITOR_FAB_BOTTOM = 80;
export const BLOG_EDITOR_FAB_SIZE = 56;

export const blogEditorStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formContent: {
    flexGrow: 1,
    paddingBottom: 0,
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
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  saveText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  editorContainer: {
    flex: 1,
  },
  toolbarContainer: {
    borderTopWidth: 1,
  },
  toolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  toolbarButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    minWidth: 40,
    padding: SPACING.sm,
  },
  toolbarLabel: {
    fontSize: TYPOGRAPHY.size.lg,
  },
  divider: {
    height: 24,
    marginHorizontal: SPACING.sm,
    width: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  loadingCard: {
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    gap: SPACING.md,
    padding: SPACING['2xl'],
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  dialogCard: {
    borderRadius: RADIUS['2xl'],
    maxWidth: 480,
    padding: SPACING['2xl'],
    width: '100%',
  },
  dialogTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size['2xl'],
    marginBottom: SPACING.xs,
  },
  dialogSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    marginBottom: SPACING.lg,
  },
  dialogInput: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    marginBottom: SPACING.xl,
    minHeight: 48,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    justifyContent: 'flex-end',
  },
  dialogButton: {
    borderRadius: RADIUS.md,
    minWidth: 96,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  dialogButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
    textAlign: 'center',
  },
  fab: {
    alignItems: 'center',
    borderRadius: BLOG_EDITOR_FAB_SIZE / 2,
    bottom: BLOG_EDITOR_FAB_BOTTOM,
    elevation: 8,
    height: BLOG_EDITOR_FAB_SIZE,
    justifyContent: 'center',
    position: 'absolute',
    right: SPACING.xl,
    shadowColor: '#000000',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    width: BLOG_EDITOR_FAB_SIZE,
    zIndex: 100,
  },
});

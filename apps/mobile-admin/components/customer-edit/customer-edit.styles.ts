import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const customerEditStyles = {
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: SPACING['3xl'],
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: SPACING['2xl'],
    paddingHorizontal: SPACING.lg,
  },
  avatarOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 5,
    marginBottom: SPACING.md,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    color: '#FFFFFF',
  },
  headerName: {
    fontSize: TYPOGRAPHY.size['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.xs,
  },
  headerSubtext: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  section: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  input: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top' as const,
  },
  buttonContainer: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  saveButton: {
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  phoneContainer: {
    width: '100%' as const,
    height: 58,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    overflow: 'hidden' as const,
  },
  phoneTextContainer: {
    backgroundColor: 'transparent',
  },
  phoneTextInput: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    height: 54,
  },
  phoneCodeText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
} as const;

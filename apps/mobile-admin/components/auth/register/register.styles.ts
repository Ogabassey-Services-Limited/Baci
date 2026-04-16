import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, ThemeColors, TYPOGRAPHY } from '@/constants/theme';

export const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    color: colors.textOnPrimary,
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  content: {
    padding: SPACING.lg,
  },
  progressContainer: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: SPACING.xs,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  stepText: {
    color: colors.textSecondary,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.xl,
    textAlign: 'right',
  },
  formSection: {
    gap: SPACING.xl,
  },
  sectionTitle: {
    color: colors.textOnPrimary,
    fontSize: TYPOGRAPHY.size['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  sectionValidation: {
    color: colors.textSecondary,
    fontSize: TYPOGRAPHY.size.md,
    marginTop: -SPACING.lg,
  },
  inputGroup: {
    gap: SPACING.sm,
  },
  nameRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  nameInputGroup: {
    flex: 1,
    gap: SPACING.sm,
  },
  label: {
    color: colors.text,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: colors.textOnPrimary,
    fontSize: TYPOGRAPHY.size.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordInput: {
    flex: 1,
    padding: SPACING.md,
    color: colors.textOnPrimary,
    fontSize: TYPOGRAPHY.size.md,
  },
  eyeButton: {
    padding: SPACING.md,
  },
  button: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: RADIUS.full,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  urlSuffix: {
    color: colors.textSecondary,
    paddingRight: SPACING.md,
    paddingLeft: SPACING.xs,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    backgroundColor: colors.card,
    height: '100%',
    textAlignVertical: 'center',
    paddingVertical: SPACING.md,
  },
  urlInput: {
    flex: 1,
    color: colors.textOnPrimary,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  termsText: {
    color: colors.textSecondary,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
    marginTop: SPACING.lg,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
  },
  validationContainer: {
    marginTop: 12,
    gap: 8,
  },
  validationTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  strengthMeter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 4,
  },
  strengthBar: {
    height: 4,
    borderRadius: 2,
  },
  checklist: {
    marginTop: 4,
    gap: 6,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  checkTextValid: {
    color: colors.success,
    fontSize: 12,
  },
  checkTextError: {
    color: colors.error,
    fontSize: 12,
  },
});

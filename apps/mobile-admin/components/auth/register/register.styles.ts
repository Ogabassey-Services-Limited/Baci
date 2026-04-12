import { StyleSheet } from 'react-native';
import { DARK_COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const registerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_COLORS.background,
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
    color: '#FFF',
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  content: {
    padding: SPACING.lg,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#2A2A40',
    borderRadius: 2,
    marginBottom: SPACING.xs,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: DARK_COLORS.primary,
  },
  stepText: {
    color: '#9CA3AF',
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.xl,
    textAlign: 'right',
  },
  formSection: {
    gap: SPACING.xl,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.size['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  sectionValidation: {
    color: '#9CA3AF',
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
    color: '#E2E8F0',
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  input: {
    backgroundColor: DARK_COLORS.inputBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: '#FFF',
    fontSize: TYPOGRAPHY.size.md,
    borderWidth: 1,
    borderColor: DARK_COLORS.border,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DARK_COLORS.inputBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DARK_COLORS.border,
  },
  passwordInput: {
    flex: 1,
    padding: SPACING.md,
    color: '#FFF',
    fontSize: TYPOGRAPHY.size.md,
  },
  eyeButton: {
    padding: SPACING.md,
  },
  button: {
    backgroundColor: DARK_COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: RADIUS.full,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
    shadowColor: DARK_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DARK_COLORS.inputBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: DARK_COLORS.border,
    overflow: 'hidden',
  },
  urlSuffix: {
    color: '#9CA3AF',
    paddingRight: SPACING.md,
    paddingLeft: SPACING.xs,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    backgroundColor: 'rgba(255,255,255,0.05)',
    height: '100%',
    textAlignVertical: 'center',
    paddingVertical: SPACING.md,
  },
  urlInput: {
    flex: 1,
    color: '#FFF',
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  termsText: {
    color: '#9CA3AF',
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
    marginTop: SPACING.lg,
    lineHeight: 20,
  },
  termsLink: {
    color: DARK_COLORS.primary,
    textDecorationLine: 'underline',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  validationContainer: {
    marginTop: 12,
    gap: 8,
  },
  validationTitle: {
    color: '#9CA3AF',
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
    color: '#6B7280',
    fontSize: 12,
  },
  checkTextValid: {
    color: '#10B981',
    fontSize: 12,
  },
  checkTextError: {
    color: '#EF4444',
    fontSize: 12,
  },
});

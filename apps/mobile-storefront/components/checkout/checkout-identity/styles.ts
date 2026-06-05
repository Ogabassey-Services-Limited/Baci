import { StyleSheet } from 'react-native';
import { BRAND, palette, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';

export const styles = StyleSheet.create({
  // Container & Layout
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropPressable: {
    flex: 1,
  },
  // Bottom Sheet
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...SHADOWS.xl,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: palette.gray[300],
    borderRadius: 2,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.gray[100],
    backgroundColor: palette.gray[50],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.gray[900],
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.gray[100],
  },
  floatingCloseButton: {
    position: 'absolute',
    top: 12,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.gray[100],
    zIndex: 3,
  },
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: palette.gray[100],
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: BRAND.primary,
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.gray[500],
  },
  tabTextActive: {
    color: BRAND.primary,
  },
  // Content
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    gap: SPACING.md, // Reduced from lg (24) to md (16) for more compact forms
  },
  // Option Cards
  optionCard: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.gray[100],
    ...SHADOWS.sm,
  },
  optionCardSecondary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FEE2E2',
    alignItems: 'center',
  },
  guestPassiveCard: {
    padding: 16,
    alignItems: 'stretch',
    shadowOpacity: 0,
    elevation: 0,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  optionHeaderCentered: {
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.gray[900],
  },
  optionDescription: {
    fontSize: 12,
    color: palette.gray[500],
    marginBottom: 16,
  },
  optionDescriptionCentered: {
    textAlign: 'center',
    color: palette.gray[600],
  },
  // Buttons
  primaryButton: {
    height: 54,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 12,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: '#B91C1C',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  secondaryButton: {
    height: 54,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    borderRadius: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
  },
  passiveButton: {
    height: 48,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: palette.gray[200],
    borderRadius: 12,
  },
  passiveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    color: palette.gray[900],
  },
  // Social Buttons
  socialButton: {
    height: 54,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: palette.gray[200],
    borderRadius: 12,
    gap: 12,
  },
  socialButtonDisabled: {
    opacity: 0.6,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.gray[900],
  },
  socialCheckoutSection: {
    gap: 10,
  },
  socialCheckoutLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  socialCheckoutRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialCheckoutButton: {
    flex: 1,
    height: 52,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: palette.gray[200],
    borderRadius: 14,
    gap: 10,
    ...SHADOWS.sm,
  },
  socialCheckoutButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.gray[900],
  },
  emailSignInButton: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderTopWidth: 1,
  },
  emailSignInButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.gray[500],
  },
  emailBackButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  emailBackButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND.primary,
  },
  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Reduced from 12 to 8
    paddingVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.gray[200],
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.gray[400],
    textTransform: 'uppercase',
  },
  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: BRAND.primary,
  },
  // Form Inputs
  inputGroup: {
    gap: 6,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.gray[700],
  },
  forgotLink: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.primary,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: palette.gray[200],
    borderRadius: RADIUS.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: palette.gray[900],
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: palette.gray[200],
    borderRadius: RADIUS.lg,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: palette.gray[900],
  },
  showPasswordButton: {
    paddingHorizontal: 12,
  },
  showPasswordText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.gray[500],
  },
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: SPACING.lg,
    backgroundColor: palette.gray[50],
    borderTopWidth: 1,
    borderTopColor: palette.gray[100],
  },
  footerText: {
    flexShrink: 1,
    fontSize: 10,
    color: palette.gray[400],
    fontWeight: '500',
    textAlign: 'center',
  },
});

import { BRAND, palette, SHADOWS } from '@/constants/Colors';

export const socialStyles = {
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
} as const;

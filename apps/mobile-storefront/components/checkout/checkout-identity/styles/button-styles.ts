import { RADIUS } from '@/constants/Colors';

export const buttonStyles = {
  primaryButton: {
    height: 54,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.xl,
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 54,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: RADIUS.xl,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  passiveButton: {
    height: 48,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.xl,
  },
  passiveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
} as const;

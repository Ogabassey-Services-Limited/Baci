import { palette, SHADOWS } from '@/constants/Colors';

export const optionStyles = {
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
} as const;

import { BRAND, palette, RADIUS } from '@/constants/Colors';

export const feedbackStyles = {
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
} as const;

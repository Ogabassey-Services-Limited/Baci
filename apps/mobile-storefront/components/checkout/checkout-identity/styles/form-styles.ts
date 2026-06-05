import { BRAND, palette, RADIUS } from '@/constants/Colors';

export const formStyles = {
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
} as const;

import { BRAND, palette } from '@/constants/Colors';

export const tabStyles = {
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
} as const;

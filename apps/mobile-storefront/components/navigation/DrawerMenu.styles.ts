import { StyleSheet } from 'react-native';
import { BRAND, palette, RADIUS, withAlpha } from '@/constants/Colors';

const styles = StyleSheet.create({
  passThroughContainer: {
    pointerEvents: 'box-none',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: withAlpha(palette.black, 0.6),
    zIndex: 998,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuList: {
    flex: 1,
  },
  menuListContent: {
    paddingTop: 14,
    paddingHorizontal: 12,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: RADIUS.lg,
    marginBottom: 2,
  },
  menuItemActive: {
    backgroundColor: withAlpha(BRAND.primary, 0.06),
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  menuItemLabelActive: {
    fontFamily: 'Inter_700Bold',
    color: BRAND.primary,
  },
  footer: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  authButton: {
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  authButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  versionText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 12,
  },
});

export default styles;

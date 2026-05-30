import { StyleSheet } from 'react-native';
import { RADIUS } from '@/constants/Colors';

export const productDetailScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 60,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerButtons: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 50,
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toast: {
    position: 'absolute',
    bottom: 110,
    left: 20,
    right: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: RADIUS.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

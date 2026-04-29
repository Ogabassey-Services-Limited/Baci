import { StyleSheet } from 'react-native';
import { SHADOWS } from '@/constants/Colors';

export const utilityPurchaseStyles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  successShell: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: {
    width: 68,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSideRight: {
    justifyContent: 'flex-end',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerIconButton: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconCircle: {
    alignItems: 'center',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    width: 52,
    ...SHADOWS.xl,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  errorMessage: { fontSize: 15, textAlign: 'center', marginBottom: 24 },
  backButton: {
    minHeight: 34,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  backButtonText: { fontSize: 14, fontWeight: '600' },
  quickRepeatBase: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    left: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'absolute',
    right: 16,
  },
  quickRepeatButton: {
    ...SHADOWS.lg,
  },
  quickRepeatCopy: {
    flex: 1,
  },
  quickRepeatDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  quickRepeatLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  quickRepeatNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
});

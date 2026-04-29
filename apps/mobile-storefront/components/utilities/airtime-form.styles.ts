import { StyleSheet } from 'react-native';
import { BRAND, SPACING } from '@/constants/Colors';

export const airtimeFormStyles = StyleSheet.create({
  scrollView: { flex: 1 },
  content: { padding: SPACING.md },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, marginBottom: 8 },
  changeButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  changeButtonText: {
    color: BRAND.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  inlineButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 12,
  },
  inlineButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  networkPicker: {
    marginBottom: 16,
  },
  networkPickerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickChipText: { fontSize: 13, fontWeight: '500' },
  selectedNetworkCard: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 14,
  },
  selectedNetworkCopy: {
    flex: 1,
    gap: 2,
  },
  selectedNetworkLogo: {
    height: 34,
    width: 52,
  },
  selectedNetworkLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  selectedNetworkName: {
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderTopWidth: 1,
  },
  payButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});

import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  addButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  addButtonPressable: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 24,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  groups: {
    gap: 20,
    padding: 16,
    paddingBottom: 24,
  },
  optionsScroll: {
    flex: 1,
  },
  productHeader: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  selectionSummary: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
});

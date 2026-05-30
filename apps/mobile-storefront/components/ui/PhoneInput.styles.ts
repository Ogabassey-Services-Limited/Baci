import { StyleSheet } from 'react-native';

export const phoneInputStyles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  containerError: {
    borderWidth: 1,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 4,
  },
  flag: {
    fontSize: 20,
  },
  divider: {
    width: 1,
    height: 24,
  },
  dialCode: {
    fontSize: 15,
    fontWeight: '500',
    paddingLeft: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 14,
    paddingHorizontal: 8,
    paddingRight: 12,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  countryRowSelected: {},
  countryFlag: {
    fontSize: 24,
  },
  countryName: {
    flex: 1,
    fontSize: 15,
  },
  countryDialCode: {
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 15,
  },
});

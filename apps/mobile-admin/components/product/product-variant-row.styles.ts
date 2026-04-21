import { StyleSheet } from 'react-native';

export const productVariantRowStyles = StyleSheet.create({
  addAttributeButton: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  addAttributeLabel: {
    fontWeight: '600',
    marginLeft: 4,
  },
  attributeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  attributeInput: {
    flex: 1,
  },
  attributeRemoveButton: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  attributeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  attributeTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  halfInput: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    padding: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  removeButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  removeLabel: {
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
});

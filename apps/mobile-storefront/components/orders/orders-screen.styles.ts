import { StyleSheet } from 'react-native';

export const ordersScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 88,
  },
  listContent: {
    padding: 16,
    gap: 14,
  },
  emptyListContent: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },
  shopButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 24,
  },
  shopButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    marginTop: 12,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
});

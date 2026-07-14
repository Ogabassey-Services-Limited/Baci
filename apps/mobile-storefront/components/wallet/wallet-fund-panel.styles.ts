import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  accountBank: {
    fontSize: 12,
  },
  accountCard: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 12,
    padding: 14,
  },
  accountCopy: {
    flex: 1,
    gap: 2,
  },
  accountCopyButton: {
    padding: 6,
  },
  accountNumber: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardSubtitle: {
    marginTop: 16,
  },
  cardToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
  },
  cardToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  copyFeedback: {
    fontSize: 12,
    marginTop: 6,
  },
  settingUpRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
});

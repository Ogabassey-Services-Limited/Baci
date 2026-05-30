import { StyleSheet } from 'react-native';

export const errorBoundaryStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  retryButtonPressed: {
    opacity: 0.8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  debugContainer: {
    marginTop: 32,
    padding: 16,
    borderRadius: 8,
    width: '100%',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    fontFamily: 'SpaceMono',
  },
  debugStack: {
    fontSize: 9,
    fontFamily: 'SpaceMono',
    marginTop: 8,
    opacity: 0.8,
  },
});

import { StyleSheet } from 'react-native';
import { SPACING } from '@/constants/Colors';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    paddingTop: SPACING.xl,
    paddingBottom: 100, // Account for tab bar height + safe area
    paddingHorizontal: SPACING.lg,
  },
  brandSection: {
    marginBottom: SPACING.xl,
  },
  tagline: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    lineHeight: 16,
    maxWidth: 220,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 16,
  },
  socialButton: {
    padding: 4,
  },
  socialPressed: {
    opacity: 0.5,
  },
  gridContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.xl,
    gap: 40,
  },
  column: {
    flex: 1,
  },
  columnTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: 1,
  },
  linkItem: {
    paddingVertical: 6,
  },
  linkText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
  },
  contactSection: {
    marginBottom: SPACING.lg,
  },
  contactList: {
    gap: 10,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  contactText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
    flex: 1,
    lineHeight: 16,
  },
  securedSection: {
    marginBottom: SPACING.lg,
  },
  securedByText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: '#6B7280',
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    letterSpacing: -0.3,
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: SPACING.md,
    marginTop: SPACING.sm,
  },
  copyright: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
});

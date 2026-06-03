import { StyleSheet } from 'react-native';
import Colors, { BRAND } from '@/constants/Colors';

export const orderSuccessStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 12,
  },
  eyebrowPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 10,
  },
  eyebrowText: {
    color: BRAND.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    maxWidth: 320,
  },
  orderInfo: {
    width: '100%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderLabel: {
    flex: 1,
    fontSize: 14,
  },
  orderValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  nextSteps: {
    width: '100%',
    marginBottom: 16,
  },
  nextTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  nextStepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  stepIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BRAND.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepBody: {
    flex: 1,
    gap: 4,
  },
  nextStepTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  nextStepText: {
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    gap: 10,
    width: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 10,
  },
  documentButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: BRAND.primary,
    flexDirection: 'row',
    gap: 10,
  },
  documentButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.white,
  },
  googleLogoWrap: {
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    padding: 2,
  },
  reviewButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.white,
  },
});

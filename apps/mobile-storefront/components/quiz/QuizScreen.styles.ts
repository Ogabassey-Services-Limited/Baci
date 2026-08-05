import { StyleSheet } from 'react-native';

export type QuizThemeColors = {
  background: string;
  border: string;
  card: string;
  error: string;
  muted: string;
  primary: string;
  primaryLowOpacity: string;
  primaryForeground: string;
  success: string;
  text: string;
  textSecondary: string;
  warning: string;
};

export function createQuizStyles(colors: QuizThemeColors) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.background, flex: 1 },
    container: {
      backgroundColor: colors.background,
      flexGrow: 1,
      gap: 16,
      padding: 20,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'space-between',
    },
    title: { color: colors.text, fontSize: 28, fontWeight: '800' },
    subtitle: { color: colors.textSecondary, fontSize: 15, marginTop: 4 },
    headerImage: { height: 72, resizeMode: 'contain', width: 72 },
    error: { color: colors.error, fontWeight: '700' },
    introPanel: {
      backgroundColor: colors.primaryLowOpacity,
      borderColor: colors.primary,
      borderRadius: 8,
      borderWidth: 1,
      gap: 4,
      padding: 16,
    },
    introTitle: { color: colors.primary, fontSize: 16, fontWeight: '800' },
    introText: { color: colors.text, fontSize: 15, fontWeight: '700' },
    introMeta: { color: colors.textSecondary, fontSize: 14 },
    eventMeta: { color: colors.textSecondary, fontSize: 14 },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: 16,
    },
    primaryButtonText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontWeight: '800',
    },
    questionCard: {
      backgroundColor: colors.card,
      borderRadius: 8,
      gap: 12,
      padding: 16,
    },
    progressTrack: {
      backgroundColor: colors.muted,
      borderRadius: 4,
      height: 8,
      overflow: 'hidden',
    },
    progressFill: {
      backgroundColor: colors.success,
      borderRadius: 4,
      height: 8,
    },
    timer: { color: colors.warning, fontWeight: '700' },
    passReceipt: { color: colors.textSecondary, fontWeight: '700' },
    question: { color: colors.text, fontSize: 20, fontWeight: '800' },
    answerButton: {
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: 14,
    },
    answerButtonSelected: {
      backgroundColor: colors.primaryLowOpacity,
      borderColor: colors.primary,
    },
    answerButtonDisabled: { opacity: 0.56 },
    answerText: { color: colors.text, fontSize: 16, fontWeight: '700' },
    resultCard: {
      backgroundColor: colors.card,
      borderColor: colors.success,
      borderRadius: 8,
      borderWidth: 1,
      gap: 8,
      padding: 16,
    },
    resultTitle: { color: colors.success, fontSize: 20, fontWeight: '800' },
    resultScore: { color: colors.text, fontSize: 18, fontWeight: '800' },
    prizeWinText: { color: colors.success, fontSize: 16, fontWeight: '800' },
    prizeClaimHint: { color: colors.textSecondary, fontSize: 14 },
  });
}

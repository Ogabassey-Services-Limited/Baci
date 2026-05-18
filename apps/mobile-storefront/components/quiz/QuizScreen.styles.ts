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
    screen: {
      backgroundColor: colors.background,
    },
    container: {
      gap: 16,
      padding: 20,
      backgroundColor: colors.background,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
    },
    subtitle: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: 15,
    },
    headerImage: {
      width: 72,
      height: 72,
      resizeMode: 'contain',
    },
    error: {
      color: colors.error,
      fontWeight: '700',
    },
    eventCard: {
      gap: 8,
      padding: 16,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
    },
    eventTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
    },
    eventPrize: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.success,
    },
    eventMeta: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    primaryButton: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      borderRadius: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
    },
    primaryButtonText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontWeight: '800',
    },
    questionCard: {
      gap: 12,
      padding: 16,
      borderRadius: 8,
      backgroundColor: colors.card,
    },
    progressTrack: {
      height: 8,
      overflow: 'hidden',
      borderRadius: 4,
      backgroundColor: colors.muted,
    },
    progressFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
    },
    timer: {
      color: colors.warning,
      fontWeight: '700',
    },
    question: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
    },
    answerButton: {
      minHeight: 48,
      justifyContent: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
    },
    answerButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLowOpacity,
    },
    answerText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    resultCard: {
      gap: 8,
      padding: 16,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderColor: colors.success,
      borderWidth: 1,
    },
    resultTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.success,
    },
    resultScore: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
  });
}

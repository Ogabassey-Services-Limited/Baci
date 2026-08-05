import { StyleSheet } from 'react-native';
import type { QuizThemeColors } from './QuizScreen.styles';

export function createQuizLeaderboardStyles(colors: QuizThemeColors) {
  return StyleSheet.create({
    screen: { backgroundColor: colors.background, flex: 1 },
    content: { gap: 12, padding: 20, paddingBottom: 40 },
    intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
    eventButton: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 3,
      padding: 15,
    },
    eventButtonSelected: { borderColor: colors.primary },
    eventTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
    eventMeta: { color: colors.textSecondary, fontSize: 12 },
    board: { gap: 8, marginTop: 8 },
    boardTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
    rankRow: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 48,
      paddingVertical: 8,
    },
    currentRankRow: {
      backgroundColor: colors.primaryLowOpacity,
      borderRadius: 10,
      paddingHorizontal: 10,
    },
    rank: { color: colors.primary, fontSize: 16, fontWeight: '900', width: 34 },
    name: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '700' },
    score: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
    state: {
      color: colors.textSecondary,
      fontSize: 14,
      paddingVertical: 24,
      textAlign: 'center',
    },
    error: {
      color: colors.error,
      fontSize: 14,
      paddingVertical: 20,
      textAlign: 'center',
    },
  });
}

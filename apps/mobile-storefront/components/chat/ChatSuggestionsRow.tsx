import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import { BRAND } from '@/constants/Colors';
import { styles } from './styles';
import { SUGGESTIONS } from './types';

type ThemeColors = {
  border: string;
  text: string;
};

interface ChatSuggestionsRowProps {
  colors: ThemeColors;
  isLoading: boolean;
  messagesCount: number;
  onSuggestionPress: (suggestion: string) => void;
}

export function ChatSuggestionsRow({
  colors,
  isLoading,
  messagesCount,
  onSuggestionPress,
}: ChatSuggestionsRowProps) {
  if (messagesCount > 2 || isLoading) {
    return null;
  }

  return (
    <View style={styles.suggestionsContainer}>
      {SUGGESTIONS.map((suggestion) => (
        <Pressable
          key={suggestion.label}
          style={[styles.suggestionChip, { borderColor: colors.border }]}
          onPress={() => onSuggestionPress(suggestion.label)}
          accessibilityRole="button"
          accessibilityLabel={`Suggestion: ${suggestion.label}`}
        >
          <Ionicons name={suggestion.icon} size={14} color={BRAND.primary} />
          <Text style={[styles.suggestionText, { color: colors.text }]}>
            {suggestion.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

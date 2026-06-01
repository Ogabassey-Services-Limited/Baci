import { Text, View } from 'react-native';
import { BRAND } from '@/constants/Colors';
import { styles } from './styles';
import type { ChatMessage } from './types';

interface ChatMessageTheme {
  border: string;
  card: string;
  muted: string;
  text: string;
}

interface ChatMessageRowProps {
  item: ChatMessage;
  santaMode: boolean;
  colors: ChatMessageTheme;
}

export function ChatMessageRow({
  item,
  santaMode,
  colors,
}: ChatMessageRowProps) {
  const isUser = item.role === 'user';

  return (
    <View
      style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.aiMessageContainer,
      ]}
    >
      {!isUser && (
        <View
          accessible={false}
          accessibilityElementsHidden={true}
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.avatar,
            { backgroundColor: santaMode ? BRAND.primary : colors.muted },
          ]}
        >
          <Text style={styles.avatarEmoji}>{santaMode ? '🎅' : '✨'}</Text>
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          isUser
            ? [styles.userBubble, { backgroundColor: BRAND.primary }]
            : [
                styles.aiBubble,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ],
        ]}
      >
        <Text
          style={[
            styles.messageText,
            { color: isUser ? '#FFFFFF' : colors.text },
          ]}
        >
          {item.text}
        </Text>
      </View>
    </View>
  );
}

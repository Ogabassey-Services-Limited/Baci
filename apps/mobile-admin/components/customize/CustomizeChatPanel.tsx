import { Ionicons } from '@expo/vector-icons';
import type { RefObject } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { AppKeyboardContainer } from '@/components/ui/AppKeyboardContainer';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { CustomizeWelcomeState } from './CustomizeWelcomeState';

export interface CustomizeMessage {
  content: string;
  id: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
}

interface CustomizeChatPanelProps {
  colors: ThemeColors;
  flatListRef: RefObject<FlatList<CustomizeMessage> | null>;
  inputText: string;
  isProcessingAI: boolean;
  messages: CustomizeMessage[];
  onInputTextChange: (text: string) => void;
  onSend: () => void;
  onSuggestionSelect: (prompt: string) => void;
  shadowStyle: StyleProp<ViewStyle>;
}

export function CustomizeChatPanel({
  colors,
  flatListRef,
  inputText,
  isProcessingAI,
  messages,
  onInputTextChange,
  onSend,
  onSuggestionSelect,
  shadowStyle,
}: CustomizeChatPanelProps) {
  const hasInput = inputText.trim().length > 0;

  return (
    <AppKeyboardContainer
      align="start"
      keyboardVerticalOffset={100}
      scrollEnabled={false}
      style={styles.container}
    >
      <View style={styles.content}>
        {messages.length === 0 ? (
          <CustomizeWelcomeState
            colors={colors}
            onSuggestionSelect={onSuggestionSelect}
          />
        ) : (
          <FlatList
            ref={flatListRef}
            contentContainerStyle={styles.messagesList}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ChatBubble colors={colors} message={item} />
            )}
            showsVerticalScrollIndicator={false}
          />
        )}

        {isProcessingAI ? (
          <View
            style={[
              styles.processingContainer,
              { backgroundColor: colors.card },
            ]}
          >
            <ActivityIndicator size="small" color={colors.primary} />
            <Text
              style={[styles.processingText, { color: colors.textSecondary }]}
            >
              Thinking...
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.inputContainer,
            { backgroundColor: colors.card },
            shadowStyle,
          ]}
        >
          <TextInput
            accessibilityLabel="Customize message"
            editable={!isProcessingAI}
            maxLength={500}
            multiline
            onChangeText={onInputTextChange}
            placeholder="Describe what you want to change..."
            placeholderTextColor={colors.textMuted}
            style={[
              styles.textInput,
              { backgroundColor: colors.background, color: colors.text },
            ]}
            value={inputText}
          />
          <Pressable
            accessibilityLabel="Send customize message"
            disabled={!hasInput || isProcessingAI}
            onPress={onSend}
            style={[
              styles.sendButton,
              {
                backgroundColor: hasInput ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons
              name="send"
              size={20}
              color={hasInput ? '#FFFFFF' : colors.textMuted}
            />
          </Pressable>
        </View>
      </View>
    </AppKeyboardContainer>
  );
}

interface ChatBubbleProps {
  colors: ThemeColors;
  message: CustomizeMessage;
}

function ChatBubble({ colors, message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <View
      style={[
        styles.messageBubble,
        isUser
          ? [styles.userBubble, { backgroundColor: colors.primary }]
          : isSystem
            ? [
                styles.assistantBubble,
                { backgroundColor: colors.errorLight ?? colors.card },
              ]
            : [styles.assistantBubble, { backgroundColor: colors.card }],
      ]}
    >
      {!isUser ? (
        <View style={styles.avatarContainer}>
          <Ionicons
            name={isSystem ? 'alert-circle' : 'sparkles'}
            size={16}
            color={isSystem ? colors.error : colors.primary}
          />
        </View>
      ) : null}
      <Text
        style={[
          styles.messageText,
          isUser
            ? styles.userText
            : isSystem
              ? [styles.assistantText, { color: colors.error }]
              : [styles.assistantText, { color: colors.text }],
        ]}
      >
        {message.content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  messagesList: {
    gap: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  messageBubble: {
    alignItems: 'flex-start',
    borderRadius: RADIUS.xl,
    flexDirection: 'row',
    gap: SPACING.sm,
    maxWidth: '92%',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  userBubble: {
    alignSelf: 'flex-end',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
  },
  avatarContainer: {
    paddingTop: 2,
  },
  messageText: {
    flexShrink: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    lineHeight: 21,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {},
  processingContainer: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  processingText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  inputContainer: {
    alignItems: 'flex-end',
    borderRadius: RADIUS['2xl'],
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    padding: SPACING.sm,
  },
  textInput: {
    borderRadius: RADIUS.xl,
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    maxHeight: 140,
    minHeight: 48,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    textAlignVertical: 'top',
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});

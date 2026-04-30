import { Ionicons } from '@expo/vector-icons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import type { RefObject } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { CHAT_POWERED_BY_LABEL } from './constants';
import { styles } from './styles';
import { TypingIndicator } from './TypingIndicator';
import { type ChatMessage, SUGGESTIONS } from './types';

interface ChatModalProps {
  visible: boolean;
  santaMode: boolean;
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  flatListRef: RefObject<FlashListRef<ChatMessage> | null>;
  inputRef: RefObject<TextInput | null>;
  onClose: () => void;
  onSend: (text: string) => void;
  onChangeInput: (text: string) => void;
  onSuggestionPress: (suggestion: string) => void;
  onScrollToBottom: () => void;
}

export function ChatModal({
  visible,
  santaMode,
  messages,
  input,
  isLoading,
  flatListRef,
  inputRef,
  onClose,
  onSend,
  onChangeInput,
  onSuggestionPress,
  onScrollToBottom,
}: ChatModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
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
  };

  const renderSuggestions = () => {
    if (messages.length > 2 || isLoading) return null;
    return (
      <View style={styles.suggestionsContainer}>
        {SUGGESTIONS.map((s) => (
          <Pressable
            key={s.label}
            style={[styles.suggestionChip, { borderColor: colors.border }]}
            onPress={() => onSuggestionPress(s.label)}
            accessibilityRole="button"
            accessibilityLabel={`Suggestion: ${s.label}`}
          >
            <Ionicons name={s.icon} size={14} color={BRAND.primary} />
            <Text style={[styles.suggestionText, { color: colors.text }]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView
        style={[styles.modalContainer, { backgroundColor: colors.background }]}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: santaMode ? BRAND.primary : colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.headerAvatar,
                {
                  backgroundColor: santaMode
                    ? 'rgba(255,255,255,0.2)'
                    : colors.muted,
                },
              ]}
            >
              <Text style={styles.headerAvatarEmoji}>
                {santaMode ? '🎅' : '✨'}
              </Text>
            </View>
            <View>
              <Text
                style={[
                  styles.headerTitle,
                  { color: santaMode ? '#FFFFFF' : colors.text },
                ]}
              >
                {santaMode ? 'Santa AI' : 'Ogabassey AI'}
              </Text>
              <Text
                style={[
                  styles.headerSubtitle,
                  {
                    color: santaMode
                      ? 'rgba(255,255,255,0.7)'
                      : colors.textSecondary,
                  },
                ]}
              >
                Online
              </Text>
            </View>
          </View>
          <Pressable
            style={[
              styles.closeButton,
              {
                backgroundColor: santaMode
                  ? 'rgba(255,255,255,0.2)'
                  : colors.muted,
              },
            ]}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close chat"
          >
            <Ionicons
              name="close"
              size={20}
              color={santaMode ? '#FFFFFF' : colors.text}
            />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.messagesWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <FlashList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.messagesList,
              { backgroundColor: santaMode ? '#FFF5F5' : colors.background },
            ]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={onScrollToBottom}
            ListFooterComponent={
              isLoading ? (
                <View style={styles.loadingContainer}>
                  <View
                    style={[
                      styles.loadingBubble,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <TypingIndicator />
                  </View>
                </View>
              ) : null
            }
          />

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: santaMode ? '#FFF5F5' : colors.background,
                borderTopColor: colors.border,
              },
            ]}
          >
            {renderSuggestions()}
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: santaMode ? BRAND.primaryLight : colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder={
                  santaMode ? 'Tell Santa your wish...' : 'Type your message...'
                }
                placeholderTextColor={colors.placeholder}
                value={input}
                onChangeText={onChangeInput}
                onSubmitEditing={() => onSend(input)}
                returnKeyType="send"
                editable={!isLoading}
                multiline={false}
              />
              <Pressable
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: BRAND.primary,
                    opacity: !input.trim() || isLoading ? 0.5 : 1,
                  },
                ]}
                onPress={() => onSend(input)}
                disabled={!input.trim() || isLoading}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                <Ionicons
                  name={santaMode ? 'gift' : 'send'}
                  size={18}
                  color="#FFFFFF"
                />
              </Pressable>
            </View>
            <Text style={[styles.poweredBy, { color: colors.textSecondary }]}>
              {CHAT_POWERED_BY_LABEL}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

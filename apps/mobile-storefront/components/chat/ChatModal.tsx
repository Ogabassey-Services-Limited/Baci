import Ionicons from '@react-native-vector-icons/ionicons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import type { RefObject } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GadgetPatternBackground } from '@/components/storefront/GadgetPatternBackground';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { ChatSuggestionsRow } from './ChatSuggestionsRow';
import { CHAT_POWERED_BY_LABEL } from './constants';
import { styles } from './styles';
import { TypingIndicator } from './TypingIndicator';
import type { ChatMessage } from './types';

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
  const insets = useSafeAreaInsets();

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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View
        style={[
          styles.modalContainer,
          { backgroundColor: santaMode ? '#FFF5F5' : colors.background },
        ]}
      >
        {/* Header - safe area protected dynamically for iOS and Android clocks */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: santaMode ? BRAND.primary : colors.card,
              borderBottomColor: colors.border,
              paddingTop: insets.top + 12,
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

        {/* Global Drift-Free Keyboard protection enabled on all platforms */}
        <AppKeyboardContainer style={styles.messagesWrapper} enabled={true}>
          <View style={{ flex: 1, position: 'relative' }}>
            <GadgetPatternBackground
              colorScheme={colorScheme ?? 'light'}
              backgroundColor={santaMode ? '#FFF5F5' : colors.background}
            />

            <FlashList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.messagesList,
                { backgroundColor: 'transparent' },
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
          </View>

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: santaMode ? '#FFF5F5' : colors.background,
                borderTopColor: colors.border,
                paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
              },
            ]}
            testID="chat-input-container"
          >
            <ChatSuggestionsRow
              colors={colors}
              isLoading={isLoading}
              messagesCount={messages.length}
              onSuggestionPress={onSuggestionPress}
            />
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
                accessibilityLabel="Chat message input"
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
        </AppKeyboardContainer>
      </View>
    </Modal>
  );
}

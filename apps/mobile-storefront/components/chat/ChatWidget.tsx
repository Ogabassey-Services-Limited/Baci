/**
 * ChatWidget - React Native AI Chat Component
 * 2026 Best Practice Implementation
 *
 * Features:
 * - Draggable floating action button (pan gesture)
 * - Snaps to edges when released
 * - Full-screen modal chat interface
 * - Streaming AI responses
 * - Santa/Standard mode theming
 * - Haptic feedback
 * - Keyboard-aware input
 * - WCAG AA accessibility compliant
 */

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createLogger } from '@/lib/logger';

const log = createLogger('ChatWidget');
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Colors, { BRAND, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useUIStore } from '@/stores/ui-store';

/**
 * Screens where the chat widget should be hidden:
 * - Checkout flows (form interference, payment focus)
 * - Auth screens (user not yet engaged)
 * - Order success (celebration screen, CTAs prominent)
 * - Modal screens (overlay stacking issues)
 */
const HIDDEN_ROUTES = [
  '/checkout',
  '/bnpl-checkout',
  '/order-success',
  '/auth/login',
  '/modal',
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// API base URL - uses the web app's API
const API_BASE_URL = 'https://ogabassey.usebaci.com';

// FAB dimensions and margins
const FAB_SIZE = 60;
const EDGE_MARGIN = 16;
const SNAP_THRESHOLD = SCREEN_WIDTH / 2;

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

interface ChatWidgetProps {
  /** Enable Santa theme mode */
  santaMode?: boolean;
  /** Bottom offset for positioning above tab bar */
  bottomOffset?: number;
}

const SUGGESTIONS = [
  { label: 'Track my order', icon: 'location-outline' as const },
  { label: 'Best gaming phones', icon: 'flash-outline' as const },
  { label: "I've sent my payment", icon: 'card-outline' as const },
  { label: 'Contact support', icon: 'headset-outline' as const },
];

const PROACTIVE_MESSAGES = [
  'Looking for a new phone?',
  'Need help checking an IMEI?',
  'Want to see gaming laptops?',
  'I can help you swap your device!',
  'Searching for a specific spec?',
  'Check out our daily deals!',
  'Need a repair quote?',
];

export function ChatWidget({
  santaMode = false,
  bottomOffset = 90,
}: ChatWidgetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const pathname = usePathname();

  // Check if chat should be hidden on current screen
  const shouldHide = HIDDEN_ROUTES.some((route) => pathname?.startsWith(route));

  const isChatOpen = useUIStore((state) => state.isChatOpen);
  const chatInitialMessage = useUIStore((state) => state.chatInitialMessage);
  const openChat = useUIStore((state) => state.openChat);
  const closeChat = useUIStore((state) => state.closeChat);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [proactiveMsg, setProactiveMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const nudgeFadeAnim = useRef(new Animated.Value(0)).current;

  // Draggable FAB position - starts at bottom right
  const pan = useRef(
    new Animated.ValueXY({
      x: SCREEN_WIDTH - FAB_SIZE - EDGE_MARGIN,
      y: SCREEN_HEIGHT - bottomOffset - FAB_SIZE,
    })
  ).current;

  // Track if user moved significantly (to distinguish tap from drag)
  const hasMoved = useRef(false);

  // Pan responder for drag gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture if user moved more than 5px
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        hasMoved.current = false;
        setIsDragging(true);
        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        // Set offset to current animated value
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5) {
          hasMoved.current = true;
        }
        // Note: useNativeDriver: false is required here because we access
        // ._value directly in onPanResponderRelease for edge snapping.
        // To use native driver, refactor to Reanimated's useSharedValue.
        // Low priority as FAB drag frequency is low.
        Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        })(_, gestureState);
      },
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        setIsDragging(false);

        // Get current position
        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;

        // Snap to nearest edge (left or right)
        const snapToRight = currentX + FAB_SIZE / 2 > SNAP_THRESHOLD;
        const targetX = snapToRight
          ? SCREEN_WIDTH - FAB_SIZE - EDGE_MARGIN
          : EDGE_MARGIN;

        // Clamp Y to screen bounds
        const minY = 100; // Below status bar
        const maxY = SCREEN_HEIGHT - bottomOffset - FAB_SIZE;
        const targetY = Math.min(Math.max(currentY, minY), maxY);

        // Animate to snapped position
        Animated.spring(pan, {
          toValue: { x: targetX, y: targetY },
          useNativeDriver: false,
          friction: 7,
          tension: 40,
        }).start();

        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      },
    })
  ).current;

  // Proactive nudge logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isChatOpen) {
        const randomMsg =
          PROACTIVE_MESSAGES[
            Math.floor(Math.random() * PROACTIVE_MESSAGES.length)
          ];
        setProactiveMsg(randomMsg);

        // Fade in animation
        Animated.timing(nudgeFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isChatOpen, nudgeFadeAnim]);

  // Hide proactive message when chat opens
  useEffect(() => {
    if (isChatOpen) {
      setProactiveMsg(null);
      nudgeFadeAnim.setValue(0);
    }
  }, [isChatOpen, nudgeFadeAnim]);

  // Pulse animation for FAB (only when not dragging)
  useEffect(() => {
    if (isDragging) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, isDragging]);

  // Initialize with welcome message
  useEffect(() => {
    if (isChatOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'model',
          text: santaMode
            ? 'Ho ho ho! How can Santa AI help you today?'
            : 'Hello! How can I help you today?',
          timestamp: new Date(),
        },
      ]);
    }
  }, [isChatOpen, messages.length, santaMode]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleOpen = useCallback(() => {
    // Only open if we didn't drag
    if (hasMoved.current) {
      hasMoved.current = false;
      return;
    }
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    openChat();
  }, [openChat]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    closeChat();
  }, [closeChat]);

  const handleSend = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isLoading) return;

      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: messageText.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);
      scrollToBottom();

      try {
        const endpoint = santaMode
          ? `${API_BASE_URL}/api/chat/santa`
          : `${API_BASE_URL}/api/chat`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              ...messages.map((m) => ({
                role: m.role === 'model' ? 'assistant' : 'user',
                content: m.text,
              })),
              { role: 'user', content: messageText },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error('Chat service unavailable');
        }

        // Parse streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let aiResponseText = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            aiResponseText += chunk;
          }
        }

        // Clean the response text
        const displayText = aiResponseText
          .replace(/ACTION:ADD_TO_CART\|PRODUCT:[^|]+\|PRICE:[^\s]+/g, '')
          .trim();

        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'model',
          text: displayText || 'I apologize, I could not process that request.',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMessage]);

        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        log.error('Chat error:', error);

        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'model',
          text: santaMode
            ? "Ho ho ho! Santa's workshop is a bit busy right now. Please try again!"
            : "I'm having trouble connecting right now. Please try again later.",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        scrollToBottom();
      }
    },
    [isLoading, messages, santaMode, scrollToBottom]
  );

  // Auto-send initial message if provided by UIStore
  useEffect(() => {
    if (
      isChatOpen &&
      chatInitialMessage &&
      messages.length === 1 &&
      !isLoading
    ) {
      // Small delay to ensure welcome message is settled
      const timer = setTimeout(() => {
        handleSend(chatInitialMessage);
        // Clear it from the store so it doesn't repeat on subsequent opens
        useUIStore.getState().openChat(undefined);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isChatOpen, chatInitialMessage, messages.length, isLoading, handleSend]);

  const handleSuggestionPress = useCallback(
    (suggestion: string) => {
      handleSend(suggestion);
    },
    [handleSend]
  );

  const dismissNudge = useCallback(() => {
    Animated.timing(nudgeFadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setProactiveMsg(null));
  }, [nudgeFadeAnim]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
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
    },
    [colors, santaMode]
  );

  const renderSuggestions = useCallback(() => {
    if (messages.length > 2 || isLoading) return null;

    return (
      <View style={styles.suggestionsContainer}>
        {SUGGESTIONS.map((suggestion, index) => (
          <Pressable
            key={index}
            style={[styles.suggestionChip, { borderColor: colors.border }]}
            onPress={() => handleSuggestionPress(suggestion.label)}
          >
            <Ionicons name={suggestion.icon} size={14} color={BRAND.primary} />
            <Text style={[styles.suggestionText, { color: colors.text }]}>
              {suggestion.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }, [messages.length, isLoading, colors, handleSuggestionPress]);

  // Calculate nudge position based on FAB position
  const isOnRight = useRef(true);
  pan.x.addListener(({ value }) => {
    isOnRight.current = value + FAB_SIZE / 2 > SNAP_THRESHOLD;
  });

  // Hide chat widget on specific screens (checkout, auth, order-success, etc.)
  if (shouldHide) {
    return null;
  }

  return (
    <>
      {/* Draggable Floating Action Button */}
      <Animated.View
        style={[
          styles.fabContainer,
          {
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Proactive Nudge - Horizontal thought bubble */}
        {proactiveMsg && !isChatOpen && !isDragging && (
          <Animated.View
            style={[
              styles.nudgeContainer,
              isOnRight.current ? styles.nudgeRight : styles.nudgeLeft,
              { opacity: nudgeFadeAnim },
            ]}
          >
            <View
              style={[
                styles.nudgeBubble,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.nudgeText, { color: colors.text }]}>
                {proactiveMsg}
              </Text>
              <Pressable style={styles.nudgeClose} onPress={dismissNudge}>
                <Ionicons name="close" size={10} color={colors.textSecondary} />
              </Pressable>
            </View>
            {/* Thought bubble tail dots */}
            <View
              style={[
                styles.nudgeTailContainer,
                isOnRight.current
                  ? styles.nudgeTailRight
                  : styles.nudgeTailLeft,
              ]}
            >
              <View
                style={[
                  styles.nudgeDot1,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              />
              <View
                style={[
                  styles.nudgeDot2,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              />
            </View>
          </Animated.View>
        )}

        <Animated.View
          style={{
            transform: [{ scale: isDragging ? 1.1 : pulseAnim }],
          }}
        >
          <Pressable
            style={[
              styles.fab,
              {
                backgroundColor: santaMode ? BRAND.primary : colors.card,
                borderColor: isDragging ? BRAND.primary : colors.border,
                borderWidth: isDragging ? 2 : 1,
              },
            ]}
            onPress={handleOpen}
            accessibilityRole="button"
            accessibilityLabel="Open chat assistant. Drag to move."
            accessibilityHint="Double tap to open chat, or drag to reposition"
          >
            {santaMode ? (
              <Text style={styles.fabEmoji}>🎅</Text>
            ) : (
              <Ionicons name="sparkles" size={28} color={BRAND.primary} />
            )}
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* Drag indicator */}
        {isDragging && (
          <View style={styles.dragIndicator}>
            <Text style={styles.dragIndicatorText}>Drag to move</Text>
          </View>
        )}
      </Animated.View>

      {/* Chat Modal */}
      <Modal
        visible={isChatOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <SafeAreaView
          style={[
            styles.modalContainer,
            { backgroundColor: colors.background },
          ]}
        >
          {/* Header */}
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

          {/* Messages */}
          <KeyboardAvoidingView
            style={styles.messagesWrapper}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[
                styles.messagesList,
                { backgroundColor: santaMode ? '#FFF5F5' : colors.background },
              ]}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={scrollToBottom}
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
                      <ActivityIndicator size="small" color={BRAND.primary} />
                    </View>
                  </View>
                ) : null
              }
            />

            {/* Input Area */}
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
                      borderColor: santaMode
                        ? BRAND.primaryLight
                        : colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder={
                    santaMode
                      ? 'Tell Santa your wish...'
                      : 'Type your message...'
                  }
                  placeholderTextColor={colors.placeholder}
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={() => handleSend(input)}
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
                  onPress={() => handleSend(input)}
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
                Powered by Google Gemini
              </Text>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1000,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.xl,
  },
  fabEmoji: {
    fontSize: 32,
  },
  aiBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: BRAND.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  aiBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  dragIndicator: {
    position: 'absolute',
    top: -30,
    left: FAB_SIZE / 2 - 40,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  dragIndicatorText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },
  nudgeContainer: {
    position: 'absolute',
    bottom: FAB_SIZE + 12,
    width: 260,
  },
  nudgeRight: {
    right: -8,
    alignItems: 'flex-end',
  },
  nudgeLeft: {
    left: -8,
    alignItems: 'flex-start',
  },
  nudgeBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 32,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: '100%',
    ...SHADOWS.lg,
  },
  nudgeText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    flex: 1,
  },
  nudgeClose: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nudgeTailContainer: {
    flexDirection: 'row',
    marginTop: 2,
  },
  nudgeTailRight: {
    marginRight: 12,
    justifyContent: 'flex-end',
  },
  nudgeTailLeft: {
    marginLeft: 12,
    justifyContent: 'flex-start',
  },
  nudgeDot1: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 4,
  },
  nudgeDot2: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 1,
  },
  modalContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarEmoji: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesWrapper: {
    flex: 1,
  },
  messagesList: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    alignItems: 'flex-end',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  aiMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.xs,
  },
  avatarEmoji: {
    fontSize: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS['2xl'],
  },
  userBubble: {
    borderBottomRightRadius: RADIUS.sm,
    marginLeft: 'auto',
  },
  aiBubble: {
    borderBottomLeftRadius: RADIUS.sm,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },
  loadingBubble: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS['2xl'],
    borderBottomLeftRadius: RADIUS.sm,
    borderWidth: 1,
  },
  inputContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  poweredBy: {
    textAlign: 'center',
    fontSize: 10,
    marginTop: SPACING.xs,
  },
});

import Ionicons from '@react-native-vector-icons/ionicons';
import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { getChatWidgetBottomOffset } from '@/constants/layout';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '@/stores/ui-store';
import { ChatModal } from './ChatModal';
import { HIDDEN_ROUTES } from './constants';
import { styles } from './styles';
import type { ChatWidgetProps } from './types';
import { useChat } from './use-chat';
import { useDraggableFab } from './use-draggable-fab';
import { useProactiveNudge } from './use-proactive-nudge';

export function ChatWidget({
  santaMode = false,
  bottomOffset = 90,
}: ChatWidgetProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const effectiveBottomOffset = getChatWidgetBottomOffset(
    bottomOffset,
    insets.bottom
  );

  const {
    isChatOpen,
    openChat,
    closeChat,
    isChatDismissed,
    dismissChat,
    resetChatDismissal,
  } = useUIStore(
    useShallow((state) => ({
      isChatOpen: state.isChatOpen,
      openChat: state.openChat,
      closeChat: state.closeChat,
      isChatDismissed: state.isChatDismissed,
      dismissChat: state.dismissChat,
      resetChatDismissal: state.resetChatDismissal,
    }))
  );

  // Automatically restore chat widget when user returns to home screen
  useEffect(() => {
    if (pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/') {
      resetChatDismissal();
    }
  }, [pathname, resetChatDismissal]);

  const {
    pan,
    panResponder,
    pulseAnim,
    isDragging,
    isOverDismissZone,
    hasMoved,
    isOnRight,
  } = useDraggableFab(effectiveBottomOffset, dismissChat, handleOpen);

  const { proactiveMsg, nudgeFadeAnim, dismissNudge } =
    useProactiveNudge(isChatOpen);

  const chat = useChat(santaMode);

  // Check if chat should be hidden on current screen or if dismissed by user
  const shouldHide =
    isChatDismissed ||
    HIDDEN_ROUTES.some((route) => pathname?.startsWith(route));

  function handleOpen() {
    // Only open if we didn't drag
    if (hasMoved.current) {
      hasMoved.current = false;
      return;
    }
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    openChat();
  }

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
            left: pan.x,
            top: pan.y,
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
            accessibilityRole="button"
            accessibilityLabel="Open chat assistant. Drag to move."
            accessibilityHint="Double tap to open chat, or drag to reposition"
            pointerEvents="none"
            onPress={handleOpen}
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

      {/* Dynamic Dismiss Zone at bottom center when dragging */}
      {isDragging && (
        <View style={styles.dismissZone}>
          <Animated.View
            style={[
              styles.dismissCircle,
              {
                backgroundColor: isOverDismissZone ? '#FF3B30' : colors.card,
                borderColor: isOverDismissZone ? '#FF3B30' : '#FF3B30',
                transform: [{ scale: isOverDismissZone ? 1.15 : 1 }],
              },
            ]}
          >
            <Ionicons
              name={isOverDismissZone ? 'trash' : 'trash-outline'}
              size={22}
              color={isOverDismissZone ? '#FFFFFF' : '#FF3B30'}
            />
          </Animated.View>
          <Text
            style={[
              styles.dismissText,
              { color: isOverDismissZone ? '#FF3B30' : colors.textSecondary },
            ]}
          >
            {isOverDismissZone ? 'Release to dismiss' : 'Drag here to dismiss'}
          </Text>
        </View>
      )}

      {/* Chat Modal */}
      <ChatModal
        visible={isChatOpen}
        santaMode={santaMode}
        messages={chat.messages}
        input={chat.input}
        isLoading={chat.isLoading}
        flatListRef={chat.flatListRef}
        inputRef={chat.inputRef}
        onClose={closeChat}
        onSend={chat.handleSend}
        onChangeInput={chat.setInput}
        onSuggestionPress={chat.handleSuggestionPress}
        onScrollToBottom={chat.scrollToBottom}
      />
    </>
  );
}

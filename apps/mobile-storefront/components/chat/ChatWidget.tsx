import Ionicons from '@react-native-vector-icons/ionicons';
import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Text, View, Animated as RNAnimated } from 'react-native';
import { GestureDetector, Touchable } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { getChatWidgetBottomOffset } from '@/constants/layout';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '@/stores/ui-store';
import { ChatModal } from './ChatModal';
import { EDGE_MARGIN, HIDDEN_ROUTES } from './constants';
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
    composedGesture,
    translateX,
    translateY,
    scale,
    isDragging,
    isOverDismissZone,
    isOnRight,
  } = useDraggableFab(effectiveBottomOffset, dismissChat, handleOpen);

  const { proactiveMsg, nudgeFadeAnim, dismissNudge } =
    useProactiveNudge(isChatOpen);

  const chat = useChat(santaMode);

  // Check if chat should be hidden on current screen or if dismissed by user
  const shouldHide =
    isChatDismissed ||
    HIDDEN_ROUTES.some((route) => pathname?.startsWith(route));

  // Reanimated style for the dynamic translation of the FAB container
  const animatedFabStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });

  // Reanimated style for the scale pulse of the FAB
  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
      ],
    };
  });

  function handleOpen() {
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
      {/* Draggable Floating Action Button Container (Reanimated) */}
      <Animated.View
        style={[
          styles.fabContainer,
          {
            right: EDGE_MARGIN,
            bottom: effectiveBottomOffset,
          },
          animatedFabStyle,
        ]}
      >
        {/* Proactive Nudge - Horizontal thought bubble (RN legacy Animated) */}
        {proactiveMsg && !isChatOpen && !isDragging && (
          <RNAnimated.View
            style={[
              styles.nudgeContainer,
              isOnRight ? styles.nudgeRight : styles.nudgeLeft,
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
              <Touchable
                activeOpacity={0.3}
                animationDuration={{ in: 0, out: 150 }}
                style={styles.nudgeClose}
                onPress={dismissNudge}
              >
                <Ionicons name="close" size={10} color={colors.textSecondary} />
              </Touchable>
            </View>
            {/* Thought bubble tail dots */}
            <View
              style={[
                styles.nudgeTailContainer,
                isOnRight ? styles.nudgeTailRight : styles.nudgeTailLeft,
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
          </RNAnimated.View>
        )}

        {/* GestureDetector wraps only the FAB itself */}
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={animatedIconStyle}>
            <Touchable
              activeOpacity={0.7}
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
              accessible={true}
            >
              {santaMode ? (
                <Text style={styles.fabEmoji}>🎅</Text>
              ) : (
                <Ionicons name="sparkles" size={28} color={BRAND.primary} />
              )}
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
            </Touchable>
          </Animated.View>
        </GestureDetector>

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
          <View
            style={[
              styles.dismissCircle,
              {
                backgroundColor: isOverDismissZone ? '#FF3B30' : colors.card,
                borderColor: '#FF3B30',
                transform: [{ scale: isOverDismissZone ? 1.15 : 1 }],
              },
            ]}
          >
            <Ionicons
              name={isOverDismissZone ? 'trash' : 'trash-outline'}
              size={22}
              color={isOverDismissZone ? '#FFFFFF' : '#FF3B30'}
            />
          </View>
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

/**
 * Customize Website Screen - AI Copilot
 * Full AI-powered storefront customization via natural language chat.
 * Replaces the basic color picker with Copilot functionality matching the web builder.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  // Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useBuilderConfig } from '@/hooks/useBuilderConfig';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';

// const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Prompt suggestions for quick actions
const PROMPT_SUGGESTIONS = [
  {
    icon: 'color-palette',
    label: 'Make it blue',
    prompt: 'Change the primary color to blue',
  },
  {
    icon: 'add-circle',
    label: 'Add testimonials',
    prompt: 'Add a testimonials section with customer reviews',
  },
  {
    icon: 'sparkles',
    label: 'Make it festive',
    prompt: 'Add festive red and gold colors for the holiday season',
  },
  {
    icon: 'text',
    label: 'Update hero text',
    prompt: 'Change the hero title to "Welcome to our store"',
  },
];

interface ChatBubbleProps {
  message: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  };
  colors: ReturnType<typeof useTheme>['colors'];
}

function ChatBubble({ message, colors }: ChatBubbleProps) {
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
                styles.systemBubble,
                { backgroundColor: colors.errorLight || '#FEE2E2' },
              ]
            : [styles.assistantBubble, { backgroundColor: colors.card }],
      ]}
    >
      {!isUser && (
        <View style={styles.avatarContainer}>
          <Ionicons
            name={isSystem ? 'alert-circle' : 'sparkles'}
            size={16}
            color={isSystem ? colors.error : colors.primary}
          />
        </View>
      )}
      <Text
        style={[
          styles.messageText,
          isUser
            ? styles.userText
            : isSystem
              ? [styles.systemText, { color: colors.error }]
              : [styles.assistantText, { color: colors.text }],
        ]}
      >
        {message.content}
      </Text>
    </View>
  );
}

export default function CustomizeScreen() {
  const { colors, shadows } = useTheme();
  const { storeUrl } = useMerchant();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const [inputText, setInputText] = useState('');
  const [viewMode, setViewMode] = useState<'chat' | 'preview'>('chat');
  const [previewKey, setPreviewKey] = useState(0); // Force WebView refresh

  const {
    config,
    isLoadingConfig,
    configError,
    messages,
    sendMessage,
    isProcessingAI,
    saveDraft,
    isSavingDraft,
    publish,
    isPublishing,
    hasUnsavedChanges,
    // isPublished,
  } = useBuilderConfig();

  // Cleanup timers on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      // Clear any existing timeout before setting a new one
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          flatListRef.current?.scrollToEnd({ animated: true });
        }
        scrollTimeoutRef.current = null;
      }, 100);
    }
  }, [messages.length]);

  // Refresh preview when config changes
  useEffect(() => {
    if (config) {
      setPreviewKey((prev) => prev + 1);
    }
  }, [config]);

  const handleSend = async () => {
    if (!inputText.trim() || isProcessingAI) return;

    const prompt = inputText.trim();
    setInputText('');

    try {
      await sendMessage(prompt);
    } catch (error) {
      console.error('AI request failed:', error);
    }
  };

  const handleSuggestion = (prompt: string) => {
    setInputText(prompt);
  };

  const handleSaveDraft = () => {
    saveDraft(undefined, {
      onSuccess: () => {
        Alert.alert('Saved', 'Your changes have been saved as a draft.');
      },
      onError: (error) => {
        Alert.alert('Error', error.message || 'Failed to save draft');
      },
    });
  };

  const handlePublish = () => {
    Alert.alert(
      'Publish Changes',
      'This will make your changes live on your storefront. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: () => {
            publish(undefined, {
              onSuccess: () => {
                Alert.alert('Published!', 'Your storefront has been updated.', [
                  { text: 'OK', onPress: () => router.back() },
                ]);
              },
              onError: (error) => {
                Alert.alert('Error', error.message || 'Failed to publish');
              },
            });
          },
        },
      ]
    );
  };

  // Loading state
  if (isLoadingConfig) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <Stack.Screen
          options={{
            title: 'AI Copilot',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <ScreenSkeleton variant="settings" cards={3} />
      </SafeAreaView>
    );
  }

  // Error state
  if (configError) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <Stack.Screen
          options={{
            title: 'AI Copilot',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline" size={48} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.text }]}>
            Failed to load configuration
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            {configError.message}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Build preview URL - ensure https:// prefix
  const getPreviewUrl = () => {
    if (!storeUrl) return '';
    const urlWithProtocol = storeUrl.startsWith('http')
      ? storeUrl
      : `https://${storeUrl}`;
    return `${urlWithProtocol}?preview=true&t=${previewKey}`;
  };
  const previewUrl = getPreviewUrl();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <Stack.Screen
        options={{
          title: 'AI Copilot',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerRight: () => (
            <View style={styles.headerActions}>
              {hasUnsavedChanges && (
                <Pressable
                  onPress={handleSaveDraft}
                  disabled={isSavingDraft}
                  style={styles.headerButton}
                >
                  {isSavingDraft ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.textSecondary}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.headerButtonText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Save
                    </Text>
                  )}
                </Pressable>
              )}
              <Pressable
                onPress={handlePublish}
                disabled={isPublishing || !config}
                style={[
                  styles.publishButton,
                  { backgroundColor: colors.primary },
                ]}
              >
                {isPublishing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.publishButtonText}>Publish</Text>
                )}
              </Pressable>
            </View>
          ),
        }}
      />

      {/* View Mode Toggle */}
      <View style={[styles.toggleContainer, { backgroundColor: colors.card }]}>
        <Pressable
          style={[
            styles.toggleButton,
            viewMode === 'chat' && [
              styles.toggleActive,
              { backgroundColor: colors.primary },
            ],
          ]}
          onPress={() => setViewMode('chat')}
        >
          <Ionicons
            name="chatbubbles"
            size={18}
            color={viewMode === 'chat' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text
            style={[
              styles.toggleText,
              { color: viewMode === 'chat' ? '#FFFFFF' : colors.textSecondary },
            ]}
          >
            Chat
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.toggleButton,
            viewMode === 'preview' && [
              styles.toggleActive,
              { backgroundColor: colors.primary },
            ],
          ]}
          onPress={() => setViewMode('preview')}
        >
          <Ionicons
            name="eye"
            size={18}
            color={viewMode === 'preview' ? '#FFFFFF' : colors.textSecondary}
          />
          <Text
            style={[
              styles.toggleText,
              {
                color:
                  viewMode === 'preview' ? '#FFFFFF' : colors.textSecondary,
              },
            ]}
          >
            Preview
          </Text>
        </Pressable>
      </View>

      {viewMode === 'chat' ? (
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={100}
        >
          {/* Messages */}
          {messages.length === 0 ? (
            <View style={styles.welcomeContainer}>
              <View
                style={[
                  styles.welcomeIcon,
                  { backgroundColor: `${colors.primary}20` },
                ]}
              >
                <Ionicons name="sparkles" size={40} color={colors.primary} />
              </View>
              <Text style={[styles.welcomeTitle, { color: colors.text }]}>
                Hi! I'm your AI Copilot
              </Text>
              <Text
                style={[
                  styles.welcomeSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                Tell me how you'd like to customize your store. I can change
                colors, add sections, update content, and more!
              </Text>

              {/* Suggestions */}
              <View style={styles.suggestionsContainer}>
                {PROMPT_SUGGESTIONS.map((suggestion, index) => (
                  <Pressable
                    key={index}
                    style={[
                      styles.suggestionChip,
                      { backgroundColor: colors.card },
                    ]}
                    onPress={() => handleSuggestion(suggestion.prompt)}
                  >
                    <Ionicons
                      name={suggestion.icon as keyof typeof Ionicons.glyphMap}
                      size={16}
                      color={colors.primary}
                    />
                    <Text
                      style={[styles.suggestionText, { color: colors.text }]}
                    >
                      {suggestion.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ChatBubble message={item} colors={colors} />
              )}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Processing Indicator */}
          {isProcessingAI && (
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
          )}

          {/* Input */}
          <View
            style={[
              styles.inputContainer,
              { backgroundColor: colors.card },
              shadows.md,
            ]}
          >
            <TextInput
              style={[
                styles.textInput,
                { color: colors.text, backgroundColor: colors.background },
              ]}
              placeholder="Describe what you want to change..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!isProcessingAI}
            />
            <Pressable
              style={[
                styles.sendButton,
                {
                  backgroundColor: inputText.trim()
                    ? colors.primary
                    : colors.border,
                },
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isProcessingAI}
            >
              <Ionicons
                name="send"
                size={20}
                color={inputText.trim() ? '#FFFFFF' : colors.textMuted}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : (
        /* Preview WebView */
        <View style={styles.previewContainer}>
          {previewUrl ? (
            <WebView
              key={previewKey}
              source={{ uri: previewUrl }}
              style={styles.webview}
              startInLoadingState
              renderLoading={() => (
                <View
                  style={[
                    styles.webviewLoading,
                    { backgroundColor: colors.background },
                  ]}
                >
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              )}
            />
          ) : (
            <View style={[styles.noPreview, { backgroundColor: colors.card }]}>
              <Ionicons
                name="globe-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text
                style={[styles.noPreviewText, { color: colors.textSecondary }]}
              >
                Preview not available
              </Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  errorText: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerButton: {
    paddingHorizontal: SPACING.sm,
  },
  headerButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  publishButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  publishButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  toggleContainer: {
    flexDirection: 'row',
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: SPACING.xs,
  },
  toggleActive: {},
  toggleText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  chatContainer: {
    flex: 1,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  welcomeTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.sm,
  },
  welcomeSubtitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.xl,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
  },
  suggestionText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  messagesList: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  systemBubble: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  avatarContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 22,
    flex: 1,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {},
  systemText: {},
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  processingText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SPACING.sm,
    margin: SPACING.md,
    borderRadius: RADIUS.xl,
    gap: SPACING.sm,
  },
  textInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    flex: 1,
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
  },
  webviewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  noPreviewText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
});

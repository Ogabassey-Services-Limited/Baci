import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { errorBoundaryStyles as styles } from './error-boundary.styles';
import type { ErrorContent } from './error-boundary-content';

type ErrorBoundaryColors = (typeof Colors)['light'];

interface ErrorFallbackViewProps {
  colors: ErrorBoundaryColors;
  content: ErrorContent;
  onRetry: () => void;
  debugContext?: string;
  error?: Error | null;
}

export function ErrorFallbackView({
  colors,
  content,
  onRetry,
  debugContext,
  error,
}: ErrorFallbackViewProps) {
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: colors.muted }]}>
          <Ionicons
            name={content.icon}
            size={64}
            color={colors.mutedForeground}
          />
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>
          {content.title}
        </Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {content.message}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            { backgroundColor: colors.primary },
            pressed && styles.retryButtonPressed,
          ]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={content.buttonText}
          accessibilityHint="Attempts to recover from the error"
        >
          <Ionicons name="refresh" size={20} color={colors.primaryForeground} />
          <Text
            style={[
              styles.retryButtonText,
              { color: colors.primaryForeground },
            ]}
          >
            {content.buttonText}
          </Text>
        </Pressable>

        {typeof __DEV__ !== 'undefined' && __DEV__ && error && (
          <View
            style={[
              styles.debugContainer,
              { backgroundColor: colors.destructive },
            ]}
          >
            <Text
              style={[
                styles.debugTitle,
                { color: colors.destructiveForeground },
              ]}
            >
              {debugContext ? `Debug Info (${debugContext}):` : 'Debug Info:'}
            </Text>
            <Text
              style={[
                styles.debugText,
                { color: colors.destructiveForeground },
              ]}
            >
              {error.message}
            </Text>
            {error.stack && (
              <Text
                style={[
                  styles.debugStack,
                  { color: colors.destructiveForeground },
                ]}
                numberOfLines={5}
              >
                {error.stack}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

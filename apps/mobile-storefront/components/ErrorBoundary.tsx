/**
 * Global Error Boundary Component
 * Provides graceful error handling with retry functionality
 * Handles network errors, Supabase failures, and unexpected crashes
 *
 * 2026 Best Practice: Error boundaries with theming and comprehensive logging
 */

import { Ionicons } from '@expo/vector-icons';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  Appearance,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ColorSchemeName,
} from 'react-native';
import Colors, { BRAND } from '@/constants/Colors';
import { createLogger } from '@/lib/logger';

const log = createLogger('ErrorBoundary');

/**
 * Error logging utility
 * In production, this would send errors to a service like Sentry or Crashlytics
 */
function logError(error: Error, errorInfo?: ErrorInfo, context?: string): void {
  const timestamp = new Date().toISOString();
  const errorReport = {
    timestamp,
    context: context || 'ErrorBoundary',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    componentStack: errorInfo?.componentStack,
  };

  // Always log in development (logger handles __DEV__ check)
  log.error('Error caught', errorReport);

  // In production, send to error tracking service
  // TODO: Integrate with Sentry or Crashlytics
  // Example: Sentry.captureException(error, { extra: errorReport });
}

interface Props {
  children: ReactNode;
  onReset?: () => void;
  /** Optional context name for better error logging */
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorType: 'network' | 'supabase' | 'general';
  colorScheme: ColorSchemeName;
}

// 2026 Best Practice: Define explicit type for error content
type ErrorIconName = 'alert-circle-outline' | 'wifi-outline' | 'server-outline';
interface ErrorContent {
  icon: ErrorIconName;
  title: string;
  message: string;
  buttonText: string;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  private colorSchemeSubscription: ReturnType<
    typeof Appearance.addChangeListener
  > | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorType: 'general',
      colorScheme: Appearance.getColorScheme(),
    };
  }

  componentDidMount() {
    // Subscribe to color scheme changes for dynamic theming
    this.colorSchemeSubscription = Appearance.addChangeListener(
      ({ colorScheme }) => {
        this.setState({ colorScheme });
      }
    );
  }

  componentWillUnmount() {
    // Clean up subscription
    this.colorSchemeSubscription?.remove();
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Determine error type based on error message content
    let errorType: 'network' | 'supabase' | 'general' = 'general';

    const errorMessage = error.message.toLowerCase();

    if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('no internet')
    ) {
      errorType = 'network';
    } else if (
      errorMessage.includes('supabase') ||
      errorMessage.includes('postgresterror') ||
      errorMessage.includes('autherror') ||
      errorMessage.includes('pgrst')
    ) {
      errorType = 'supabase';
    }

    return {
      hasError: true,
      error,
      errorType,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error with context for debugging
    logError(error, errorInfo, this.props.context);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorType: 'general',
    });
    this.props.onReset?.();
  };

  getErrorContent() {
    const { errorType } = this.state;

    switch (errorType) {
      case 'network':
        return {
          icon: 'wifi-outline' as const,
          title: 'Connection Error',
          message:
            'Unable to connect to the server. Please check your internet connection and try again.',
          buttonText: 'Retry',
        };
      case 'supabase':
        return {
          icon: 'server-outline' as const,
          title: 'Service Unavailable',
          message:
            'Our servers are temporarily unavailable. Please try again in a moment.',
          buttonText: 'Try Again',
        };
      default:
        return {
          icon: 'alert-circle-outline' as const,
          title: 'Something Went Wrong',
          message:
            'An unexpected error occurred. We apologize for the inconvenience.',
          buttonText: 'Retry',
        };
    }
  }

  render() {
    if (this.state.hasError) {
      const content = this.getErrorContent();
      const isDark = this.state.colorScheme === 'dark';
      const colors = Colors[isDark ? 'dark' : 'light'];

      return (
        <View
          style={[
            styles.container,
            { backgroundColor: colors.background },
          ]}
        >
          <View style={styles.content}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.muted },
              ]}
            >
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
              onPress={this.handleRetry}
              accessibilityRole="button"
              accessibilityLabel={content.buttonText}
              accessibilityHint="Attempts to recover from the error"
            >
              <Ionicons name="refresh" size={20} color={colors.primaryForeground} />
              <Text style={[styles.retryButtonText, { color: colors.primaryForeground }]}>
                {content.buttonText}
              </Text>
            </Pressable>

            {__DEV__ && this.state.error && (
              <View
                style={[
                  styles.debugContainer,
                  { backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2' },
                ]}
              >
                <Text
                  style={[
                    styles.debugTitle,
                    { color: isDark ? '#FECACA' : '#991B1B' },
                  ]}
                >
                  Debug Info ({this.props.context || 'unknown context'}):
                </Text>
                <Text
                  style={[
                    styles.debugText,
                    { color: isDark ? '#FCA5A5' : '#7F1D1D' },
                  ]}
                >
                  {this.state.error.message}
                </Text>
                {this.state.error.stack && (
                  <Text
                    style={[
                      styles.debugStack,
                      { color: isDark ? '#FCA5A5' : '#7F1D1D' },
                    ]}
                    numberOfLines={5}
                  >
                    {this.state.error.stack}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

/**
 * Fallback component for expo-router ErrorBoundary
 * Used when ErrorBoundary is exported from expo-router
 * Supports light/dark mode theming
 */
export function ErrorFallback({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  const colorScheme = Appearance.getColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  // Log error for debugging
  logError(error, undefined, 'expo-router-fallback');

  // Determine error content based on error type
  const errorMessage = error.message.toLowerCase();
  let content: ErrorContent = {
    icon: 'alert-circle-outline',
    title: 'Something Went Wrong',
    message:
      'An unexpected error occurred. We apologize for the inconvenience.',
    buttonText: 'Retry',
  };

  if (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('failed to fetch') ||
    errorMessage.includes('no internet')
  ) {
    content = {
      icon: 'wifi-outline',
      title: 'Connection Error',
      message:
        'Unable to connect to the server. Please check your internet connection and try again.',
      buttonText: 'Retry',
    };
  } else if (
    errorMessage.includes('supabase') ||
    errorMessage.includes('postgresterror') ||
    errorMessage.includes('autherror')
  ) {
    content = {
      icon: 'server-outline',
      title: 'Service Unavailable',
      message:
        'Our servers are temporarily unavailable. Please try again in a moment.',
      buttonText: 'Try Again',
    };
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View
          style={[styles.iconContainer, { backgroundColor: colors.muted }]}
        >
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
          onPress={retry}
          accessibilityRole="button"
          accessibilityLabel={content.buttonText}
          accessibilityHint="Attempts to recover from the error"
        >
          <Ionicons name="refresh" size={20} color={colors.primaryForeground} />
          <Text
            style={[styles.retryButtonText, { color: colors.primaryForeground }]}
          >
            {content.buttonText}
          </Text>
        </Pressable>

        {__DEV__ && error && (
          <View
            style={[
              styles.debugContainer,
              { backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2' },
            ]}
          >
            <Text
              style={[
                styles.debugTitle,
                { color: isDark ? '#FECACA' : '#991B1B' },
              ]}
            >
              Debug Info:
            </Text>
            <Text
              style={[
                styles.debugText,
                { color: isDark ? '#FCA5A5' : '#7F1D1D' },
              ]}
            >
              {error.message}
            </Text>
            {error.stack && (
              <Text
                style={[
                  styles.debugStack,
                  { color: isDark ? '#FCA5A5' : '#7F1D1D' },
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  retryButtonPressed: {
    opacity: 0.8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  debugContainer: {
    marginTop: 32,
    padding: 16,
    borderRadius: 8,
    width: '100%',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    fontFamily: 'SpaceMono',
  },
  debugStack: {
    fontSize: 9,
    fontFamily: 'SpaceMono',
    marginTop: 8,
    opacity: 0.8,
  },
});

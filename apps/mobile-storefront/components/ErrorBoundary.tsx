/**
 * Global Error Boundary Component
 * Provides graceful error handling with retry functionality
 * Handles network errors, Supabase failures, and unexpected crashes
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND } from '@/constants/Colors';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorType: 'network' | 'supabase' | 'general';
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorType: 'general',
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Determine error type
    let errorType: 'network' | 'supabase' | 'general' = 'general';

    if (
      error.message.includes('Network') ||
      error.message.includes('fetch') ||
      error.message.includes('timeout') ||
      error.message.includes('ECONNREFUSED')
    ) {
      errorType = 'network';
    } else if (
      error.message.includes('Supabase') ||
      error.message.includes('PostgrestError') ||
      error.message.includes('AuthError')
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
    // Log error to console (could also send to error tracking service)
    console.error('Error Boundary caught an error:', error, errorInfo);
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
          message: 'Unable to connect to the server. Please check your internet connection and try again.',
          buttonText: 'Retry',
        };
      case 'supabase':
        return {
          icon: 'server-outline' as const,
          title: 'Service Unavailable',
          message: 'Our servers are temporarily unavailable. Please try again in a moment.',
          buttonText: 'Try Again',
        };
      default:
        return {
          icon: 'alert-circle-outline' as const,
          title: 'Something Went Wrong',
          message: 'An unexpected error occurred. We apologize for the inconvenience.',
          buttonText: 'Retry',
        };
    }
  }

  render() {
    if (this.state.hasError) {
      const content = this.getErrorContent();

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name={content.icon} size={64} color="#9CA3AF" />
            </View>

            <Text style={styles.title}>{content.title}</Text>
            <Text style={styles.message}>{content.message}</Text>

            <Pressable
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.retryButtonPressed,
              ]}
              onPress={this.handleRetry}
            >
              <Ionicons name="refresh" size={20} color="#FFF" />
              <Text style={styles.retryButtonText}>{content.buttonText}</Text>
            </Pressable>

            {__DEV__ && this.state.error && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Debug Info:</Text>
                <Text style={styles.debugText}>{this.state.error.message}</Text>
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
 */
export function ErrorFallback({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  // Determine error type
  let errorType: 'network' | 'supabase' | 'general' = 'general';
  let content = {
    icon: 'alert-circle-outline' as const,
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. We apologize for the inconvenience.',
    buttonText: 'Retry',
  };

  if (
    error.message.includes('Network') ||
    error.message.includes('fetch') ||
    error.message.includes('timeout')
  ) {
    content = {
      icon: 'wifi-outline' as const,
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection and try again.',
      buttonText: 'Retry',
    };
  } else if (
    error.message.includes('Supabase') ||
    error.message.includes('PostgrestError')
  ) {
    content = {
      icon: 'server-outline' as const,
      title: 'Service Unavailable',
      message: 'Our servers are temporarily unavailable. Please try again in a moment.',
      buttonText: 'Try Again',
    };
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name={content.icon} size={64} color="#9CA3AF" />
        </View>

        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.message}>{content.message}</Text>

        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.retryButtonPressed,
          ]}
          onPress={retry}
        >
          <Ionicons name="refresh" size={20} color="#FFF" />
          <Text style={styles.retryButtonText}>{content.buttonText}</Text>
        </Pressable>

        {__DEV__ && error && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>Debug Info:</Text>
            <Text style={styles.debugText}>{error.message}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BRAND.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  retryButtonPressed: {
    opacity: 0.8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  debugContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    width: '100%',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    color: '#7F1D1D',
    fontFamily: 'SpaceMono',
  },
});

export default GlobalErrorBoundary;

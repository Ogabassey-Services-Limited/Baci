import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ThemeColors } from '@/constants/theme';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { isValidPreviewUrl } from './is-valid-preview-url';

interface CustomizePreviewPaneProps {
  colors: ThemeColors;
  previewKey: number;
  previewUrl: string;
}

export function CustomizePreviewPane({
  colors,
  previewKey,
  previewUrl,
}: CustomizePreviewPaneProps) {
  const [failedPreviewSignature, setFailedPreviewSignature] = useState<
    string | null
  >(null);
  const previewSignature = `${previewKey}:${previewUrl}`;
  const canRenderPreview =
    isValidPreviewUrl(previewUrl) &&
    failedPreviewSignature !== previewSignature;

  return (
    <View style={styles.container}>
      {canRenderPreview ? (
        <WebView
          key={previewKey}
          onError={(event) => {
            console.error('Preview WebView failed to load', event.nativeEvent);
            setFailedPreviewSignature(previewSignature);
          }}
          onShouldStartLoadWithRequest={(request) =>
            isValidPreviewUrl(request.url)
          }
          originWhitelist={['https://*']}
          renderLoading={() => (
            <View
              style={[
                styles.loadingContainer,
                { backgroundColor: colors.background },
              ]}
            >
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          source={{ uri: previewUrl }}
          startInLoadingState
          style={styles.webview}
        />
      ) : (
        <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            Preview not available
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  webview: {
    borderRadius: 20,
    flex: 1,
    overflow: 'hidden',
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    borderRadius: 20,
    flex: 1,
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.lg,
  },
});

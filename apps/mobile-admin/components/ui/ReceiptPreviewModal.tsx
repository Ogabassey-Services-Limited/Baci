/**
 * ReceiptPreviewModal
 * Full-screen in-app preview of receipt/invoice HTML before sharing as PDF.
 * Uses react-native-webview (already installed) to render the HTML template.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import WebView from 'react-native-webview';
import { AppPageSheet } from '@/components/ui/AppPageSheet';
import { useTheme } from '@/hooks/useTheme';

interface ReceiptPreviewModalProps {
  visible: boolean;
  html: string;
  onClose: () => void;
  onShare: () => void;
  isPaid: boolean;
}

export function ReceiptPreviewModal({
  visible,
  html,
  onClose,
  onShare,
  isPaid,
}: ReceiptPreviewModalProps) {
  const { colors } = useTheme();
  const title = isPaid ? 'Receipt Preview' : 'Invoice Preview';
  const footer = (
    <Pressable
      onPress={onShare}
      style={({ pressed }) => [
        styles.shareBtn,
        { backgroundColor: isPaid ? '#059669' : colors.primary },
        pressed && { opacity: 0.7 }
      ]}
      accessibilityRole="button"
      accessibilityLabel="Share as PDF"
      accessibilityHint="Shares the receipt preview as a PDF document"
    >
      <Ionicons name="share-outline" size={20} color="#FFF" />
      <Text style={styles.shareBtnText}>Share as PDF</Text>
    </Pressable>
  );

  return (
    <AppPageSheet
      closeLabel="Close preview"
      footer={footer}
      onClose={onClose}
      scrollEnabled={false}
      title={title}
      visible={visible}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.webviewContainer}>
          {html ? (
            <WebView
              source={{ html }}
              style={styles.webview}
              scrollEnabled
              bounces={false}
              showsVerticalScrollIndicator={false}
              scalesPageToFit
              originWhitelist={['about:blank']}
              mixedContentMode="never"
              javaScriptEnabled={false}
            />
          ) : null}
        </View>
      </View>
    </AppPageSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webviewContainer: {
    flex: 1,
    marginHorizontal: -20,
    marginTop: -20,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  shareBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});

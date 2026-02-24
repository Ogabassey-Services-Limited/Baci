/**
 * ReceiptPreviewModal
 * Full-screen in-app preview of receipt/invoice HTML before sharing as PDF.
 * Uses react-native-webview (already installed) to render the HTML template.
 */

import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
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
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
              paddingTop: Platform.OS === 'ios' ? insets.top : 12,
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <Pressable
              onPress={onClose}
              style={[
                styles.headerBtn,
                { backgroundColor: colors.backgroundLight },
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close preview"
              accessibilityHint="Closes the receipt preview modal"
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isPaid ? 'Receipt Preview' : 'Invoice Preview'}
          </Text>
          <View style={styles.headerRight} />
        </View>

        {/* WebView Preview */}
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

        {/* Bottom Action Bar */}
        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              borderTopColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        >
          <Pressable
            onPress={onShare}
            style={[
              styles.shareBtn,
              { backgroundColor: isPaid ? '#059669' : colors.primary },
            ]}
            accessibilityRole="button"
            accessibilityHint="Generates a PDF of the receipt and opens the share sheet"
          >
            <Ionicons name="share-outline" size={20} color="#FFF" />
            <Text style={styles.shareBtnText}>Share as PDF</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    width: 60,
    alignItems: 'flex-start',
  },
  headerRight: {
    width: 60,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
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

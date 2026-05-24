import Ionicons from "@react-native-vector-icons/ionicons/static";
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';

interface ReceiptPreviewModalProps {
  visible: boolean;
  html: string;
  onClose: () => void;
  isPaid: boolean;
}

export function ReceiptPreviewModal({
  visible,
  html,
  onClose,
  isPaid,
}: ReceiptPreviewModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (!html || isSharing) return;
    setIsSharing(true);

    try {
      // Dynamic import: avoids crash if native modules aren't linked yet
      // (requires dev client rebuild after adding expo-print/expo-sharing)
      const Print = await import('expo-print');
      const Sharing = await import('expo-sharing');

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: isPaid ? 'Share Receipt' : 'Share Invoice',
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      // User cancelled the share dialog — not an error
      if (
        err instanceof Error &&
        !err.message.includes('cancelled') &&
        !err.message.includes('canceled')
      ) {
        Alert.alert(
          'Share Failed',
          'Could not generate PDF. Please try again.'
        );
      }
    } finally {
      setIsSharing(false);
    }
  };

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
              style={[styles.headerBtn, { backgroundColor: colors.muted }]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close preview"
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
            onPress={handleShare}
            disabled={isSharing}
            style={[
              styles.shareBtn,
              {
                backgroundColor: isPaid ? '#059669' : BRAND.primary,
                opacity: isSharing ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Share as PDF"
          >
            {isSharing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="share-outline" size={20} color="#FFF" />
            )}
            <Text style={styles.shareBtnText}>
              {isSharing ? 'Generating PDF...' : 'Share as PDF'}
            </Text>
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

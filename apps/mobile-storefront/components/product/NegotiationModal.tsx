/**
 * Negotiation Modal Component
 * 2026 Ogabassey Design - Matches web implementation
 * Features: Progressive negotiation, counter offers, evidence upload
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// 2026 Best Practice: Dynamic imports for native modules to prevent evaluation-time crashes
let Haptics: typeof import('expo-haptics') | null = null;
let ImagePicker: typeof import('expo-image-picker') | null = null;

const loadNativeModules = async () => {
  if (Platform.OS === 'web') return;
  try {
    const [haptic, picker] = await Promise.all([
      import('expo-haptics'),
      import('expo-image-picker'),
    ]);
    Haptics = haptic;
    ImagePicker = picker;
  } catch (e) {
    console.debug(
      '[NegotiationModal] Native modules ignored or failed to load:',
      e
    );
  }
};

loadNativeModules();

import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import { BRAND, palette, SHADOWS } from '@/constants/Colors';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/stores/cart-store';

const log = createLogger('NegotiationModal');

type NegotiationStatus =
  | 'input'
  | 'processing'
  | 'success'
  | 'failed'
  | 'upload'
  | 'submitted';

interface NegotiationModalProps {
  visible: boolean;
  onClose: () => void;
  productId: string;
  merchantId: string;
  productName: string;
  currentPrice: number;
  onSuccess: (negotiatedPrice: number) => void;
  type?: 'single' | 'total';
  itemId?: string;
}

export function NegotiationModal({
  visible,
  onClose,
  productId,
  merchantId,
  productName,
  currentPrice,
  onSuccess,
  type = 'single',
  itemId,
}: NegotiationModalProps) {
  const [status, setStatus] = useState<NegotiationStatus>('input');
  const [offer, setOffer] = useState('');
  const [message, setMessage] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  const [counterOffer, setCounterOffer] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<string | null>(null);
  const [uploadLink, setUploadLink] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setOffer('');
      setStatus('input');
      setMessage('');
      setAttemptCount(0);
      setCounterOffer(null);
      setUploadFile(null);
      setUploadLink('');
    }
  }, [visible]);

  const triggerHaptic = (
    style?: import('expo-haptics').ImpactFeedbackStyle
  ) => {
    if (Platform.OS === 'ios' && Haptics) {
      Haptics.impactAsync(style ?? Haptics.ImpactFeedbackStyle.Light).catch(
        () => {}
      );
    }
  };

  if (!visible) return null;

  const handleSubmit = () => {
    if (!offer) return;

    setStatus('processing');
    triggerHaptic(Haptics?.ImpactFeedbackStyle?.Medium);

    const offerAmount = Number.parseFloat(offer.replace(/[^0-9.]/g, ''));

    if (Number.isNaN(offerAmount) || offerAmount <= 0) {
      Alert.alert('Invalid Offer', 'Please enter a valid price.');
      setStatus('input');
      return;
    }

    // Simulate AI thinking delay
    setTimeout(() => {
      const discountPercentage = 1 - offerAmount / currentPrice;

      // 5% Hard Floor - instant acceptance
      if (discountPercentage <= 0.05) {
        setStatus('success');
        triggerHaptic(Haptics?.ImpactFeedbackStyle?.Heavy);
        onSuccess(offerAmount);
        return;
      }

      // Rejection Logic - Determine Counter Offer
      let counterDiscount: number;
      let replyMessage: string;

      if (attemptCount === 0) {
        // First Try: Counter with 2% off
        counterDiscount = 0.02;
        replyMessage = "That's a bit low. But I can do:";
      } else if (attemptCount === 1) {
        // Second Try: Counter with 4% off
        counterDiscount = 0.04;
        replyMessage = "We're getting closer. The best I can do is:";
      } else {
        // Third+ Try: Counter with Floor (5% off)
        counterDiscount = 0.05;
        replyMessage = 'This is my absolute final offer:';
      }

      const proposedCounter = Math.floor(currentPrice * (1 - counterDiscount));

      if (attemptCount >= 2) {
        setStatus('upload');
        setMessage(
          "You're looking for a serious discount! Upload evidence of a lower price elsewhere and a merchant will review your request."
        );
      } else {
        // Update State for counter-offer
        setStatus('failed');
        setCounterOffer(proposedCounter);
        setMessage(replyMessage);
        setAttemptCount((prev) => prev + 1);
        triggerHaptic(Haptics?.ImpactFeedbackStyle?.Medium);
      }
    }, 1500);
  };

  const submitMerchantRequest = async (evidenceUrl?: string) => {
    if (!merchantId) {
      Alert.alert('Error', 'Unable to identify merchant. Please try again.');
      return;
    }

    setStatus('processing');
    const offerAmount =
      Number.parseFloat(offer.replace(/[^0-9.]/g, '')) || currentPrice * 0.9;

    try {
      // Get authenticated user if available (null for guests)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from('negotiation_requests').insert({
        merchant_id: merchantId,
        session_id: `mobile-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`}`,
        customer_id: user?.id ?? null,
        type,
        item_info:
          type === 'single'
            ? {
                id: itemId || productId,
                name: productName,
                current_price: currentPrice,
              }
            : null,
        offered_price: offerAmount,
        evidence_url: evidenceUrl || null,
        status: 'pending',
      });

      if (error) throw error;

      setStatus('submitted');
      setMessage(
        "Request submitted! We'll notify you as soon as the merchant reviews your offer."
      );
      triggerHaptic(Haptics?.ImpactFeedbackStyle?.Heavy);
    } catch (error) {
      log.error('Failed to submit request:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
      setStatus('upload');
    }
  };

  const handleAcceptCounter = () => {
    if (counterOffer) {
      setStatus('success');
      triggerHaptic(Haptics?.ImpactFeedbackStyle?.Heavy);
      onSuccess(counterOffer);
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile && !uploadLink) {
      Alert.alert('Evidence Required', 'Please add a photo or link as proof.');
      return;
    }
    submitMerchantRequest(uploadLink || uploadFile || 'uploaded_evidence');
  };

  const pickImage = async () => {
    if (!ImagePicker) {
      Alert.alert(
        'Not Supported',
        'Image picking is not supported on this platform.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadFile(result.assets[0].uri);
      triggerHaptic();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal={true}
    >
      <AppKeyboardContainer
        style={styles.overlay}
      >
        <Pressable
          style={styles.backdrop}
          onPress={status === 'processing' ? undefined : onClose}
          accessibilityLabel="Close negotiation dialog"
          accessibilityRole="button"
        />

        <Animated.View
          entering={FadeInDown.duration(200).springify()}
          exiting={FadeOut.duration(150)}
          style={styles.modalContainer}
        >
          {/* Dark Header - Ogabassey Style */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="hand-right" size={18} color={BRAND.primary} />
              <Text style={styles.headerTitle}>NEGOTIATE PRICE</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={12}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={palette.gray[400]} />
            </Pressable>
          </View>

          {/* White Content Area */}
          <View style={styles.content}>
            {/* Product Info - Always Visible */}
            <View style={styles.productInfo}>
              <Text style={styles.productLabel}>PRODUCT</Text>
              <Text style={styles.productName} numberOfLines={1}>
                {productName}
              </Text>
              <Text style={styles.priceRow}>
                <Text style={styles.priceLabel}>Current Price: </Text>
                <Text style={styles.priceValue}>
                  {formatPrice(currentPrice)}
                </Text>
              </Text>
            </View>

            {/* Input State */}
            {status === 'input' && (
              <Animated.View entering={FadeIn.duration(200)}>
                <Text style={styles.inputLabel}>Your Offer (₦)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.priceInput}
                    value={offer}
                    onChangeText={setOffer}
                    placeholder="Enter amount..."
                    placeholderTextColor={palette.gray[400]}
                    keyboardType="numeric"
                    // autoFocus removed for accessibility compliance (jsx-a11y/no-autofocus)
                  />
                </View>
                <Pressable
                  style={styles.submitButton}
                  onPress={handleSubmit}
                  accessibilityLabel="Submit your offer"
                  accessibilityRole="button"
                >
                  <Text style={styles.submitButtonText}>Submit Offer</Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Processing State */}
            {status === 'processing' && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={styles.centerContainer}
              >
                <ActivityIndicator size="large" color={BRAND.primary} />
                <Text style={styles.processingText}>
                  Reviewing your offer...
                </Text>
                <Text style={styles.processingSubtext}>
                  Checking with sales manager
                </Text>
              </Animated.View>
            )}

            {/* Success State */}
            {status === 'success' && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={styles.centerContainer}
              >
                <View style={styles.successCircle}>
                  <Ionicons name="checkmark-circle" size={28} color="#16A34A" />
                </View>
                <Text style={styles.successTitle}>Offer Accepted!</Text>
                <Text style={styles.successSubtext}>
                  Price has been updated in your cart.
                </Text>
                <Pressable
                  style={styles.doneButton}
                  onPress={onClose}
                  accessibilityLabel="Done"
                  accessibilityRole="button"
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Counter Offer State (failed) */}
            {status === 'failed' && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={styles.centerContainer}
              >
                <View style={styles.amberCircle}>
                  <Ionicons name="hand-right" size={28} color="#D97706" />
                </View>
                <Text style={styles.counterTitle}>Counter Offer</Text>
                <Text style={styles.counterMessage}>{message}</Text>

                {counterOffer && (
                  <View style={styles.counterOfferBox}>
                    <Text style={styles.counterOfferPrice}>
                      {formatPrice(counterOffer)}
                    </Text>
                  </View>
                )}

                <View style={styles.buttonColumn}>
                  {counterOffer && (
                    <Pressable
                      style={styles.acceptButton}
                      onPress={handleAcceptCounter}
                      accessibilityLabel={`Accept ${formatPrice(counterOffer)}`}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#FFF"
                        style={styles.buttonIcon}
                      />
                      <Text style={styles.acceptButtonText}>
                        Accept {formatPrice(counterOffer)}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.tryAgainButton}
                    onPress={() => setStatus('input')}
                    accessibilityLabel="Negotiate again"
                    accessibilityRole="button"
                  >
                    <Text style={styles.tryAgainButtonText}>
                      Negotiate Again
                    </Text>
                  </Pressable>

                  {/* I Saw It Cheaper - Only after 2+ attempts */}
                  {attemptCount >= 2 && (
                    <Pressable
                      style={styles.cheaperButton}
                      onPress={() => setStatus('upload')}
                      accessibilityLabel="I saw it cheaper"
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name="cloud-upload-outline"
                        size={18}
                        color="#1D4ED8"
                        style={styles.buttonIcon}
                      />
                      <Text style={styles.cheaperButtonText}>
                        I Saw It Cheaper
                      </Text>
                    </Pressable>
                  )}
                </View>
              </Animated.View>
            )}

            {/* Upload Evidence State */}
            {status === 'upload' && (
              <Animated.View entering={FadeIn.duration(200)}>
                <View style={styles.uploadInfoBox}>
                  <Text style={styles.uploadInfoTitle}>
                    📸 Saw it cheaper elsewhere?
                  </Text>
                  <Text style={styles.uploadInfoText}>
                    Upload proof (screenshot, photo) and we'll try to match or
                    beat that price!
                  </Text>
                </View>

                <Text style={styles.inputLabel}>Upload Proof (Required)</Text>
                <Pressable style={styles.uploadBox} onPress={pickImage}>
                  {uploadFile ? (
                    <View style={styles.uploadedRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#16A34A"
                      />
                      <Text style={styles.uploadedText}>Image added</Text>
                    </View>
                  ) : (
                    <View style={styles.uploadPlaceholder}>
                      <Ionicons
                        name="image-outline"
                        size={24}
                        color="#1D4ED8"
                      />
                      <Text style={styles.uploadPlaceholderText}>
                        Tap to select image
                      </Text>
                    </View>
                  )}
                </Pressable>

                <Text style={styles.inputLabel}>Link (Optional)</Text>
                <TextInput
                  style={styles.linkInput}
                  value={uploadLink}
                  onChangeText={setUploadLink}
                  placeholder="https://example.com/product"
                  placeholderTextColor={palette.gray[400]}
                  keyboardType="url"
                  autoCapitalize="none"
                />

                <View style={styles.uploadButtonRow}>
                  <Pressable
                    style={styles.backButton}
                    onPress={() => setStatus('failed')}
                    accessibilityLabel="Go back"
                    accessibilityRole="button"
                  >
                    <Text style={styles.backButtonText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={styles.sendReviewButton}
                    onPress={handleUploadSubmit}
                    accessibilityLabel="Send for review"
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="cloud-upload"
                      size={18}
                      color="#FFF"
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.sendReviewButtonText}>
                      Send for Review
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {/* Submitted State */}
            {status === 'submitted' && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={styles.centerContainer}
              >
                <View style={styles.successCircle}>
                  <Ionicons name="checkmark-circle" size={28} color="#16A34A" />
                </View>
                <Text style={styles.successTitle}>Request Sent</Text>
                <Text style={styles.successSubtext}>{message}</Text>
                <Pressable
                  style={styles.doneButton}
                  onPress={onClose}
                  accessibilityLabel="Got it"
                  accessibilityRole="button"
                >
                  <Text style={styles.doneButtonText}>Got it</Text>
                </Pressable>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </AppKeyboardContainer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    ...SHADOWS.lg,
  },
  // Dark Header
  header: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  closeButton: {
    padding: 4,
  },
  // White Content
  content: {
    padding: 24,
  },
  productInfo: {
    marginBottom: 24,
  },
  productLabel: {
    fontSize: 10,
    color: palette.gray[500],
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.gray[900],
    marginBottom: 4,
  },
  priceRow: {
    fontSize: 14,
  },
  priceLabel: {
    color: palette.gray[500],
  },
  priceValue: {
    color: palette.gray[900],
    fontWeight: '600',
  },
  // Input State
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: palette.gray[700],
    marginBottom: 8,
  },
  inputContainer: {
    marginBottom: 24,
  },
  priceInput: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.gray[300],
    borderRadius: 12,
    fontSize: 18,
    fontWeight: '700',
    color: palette.gray[900],
  },
  submitButton: {
    backgroundColor: BRAND.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Processing State
  centerContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '500',
    color: palette.gray[600],
    marginTop: 16,
  },
  processingSubtext: {
    fontSize: 12,
    color: palette.gray[400],
    marginTop: 8,
  },
  // Success State
  successCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.gray[900],
    marginBottom: 4,
  },
  successSubtext: {
    fontSize: 14,
    color: palette.gray[500],
    marginBottom: 16,
    textAlign: 'center',
  },
  doneButton: {
    backgroundColor: palette.gray[900],
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  doneButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Counter Offer State
  amberCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  counterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.gray[900],
    marginBottom: 4,
  },
  counterMessage: {
    fontSize: 14,
    color: palette.gray[500],
    marginBottom: 8,
    textAlign: 'center',
  },
  counterOfferBox: {
    backgroundColor: palette.gray[50],
    borderWidth: 1,
    borderColor: palette.gray[100],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 24,
  },
  counterOfferPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.gray[900],
  },
  buttonColumn: {
    width: '100%',
    gap: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  acceptButton: {
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  tryAgainButton: {
    backgroundColor: palette.gray[100],
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  tryAgainButtonText: {
    color: palette.gray[900],
    fontSize: 16,
    fontWeight: '700',
  },
  cheaperButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cheaperButtonText: {
    color: '#1D4ED8',
    fontSize: 16,
    fontWeight: '700',
  },
  // Upload State
  uploadInfoBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  uploadInfoTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  uploadInfoText: {
    fontSize: 12,
    color: '#1D4ED8',
    lineHeight: 18,
  },
  uploadBox: {
    borderWidth: 1,
    borderColor: palette.gray[300],
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  uploadPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadPlaceholderText: {
    fontSize: 14,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadedText: {
    fontSize: 14,
    color: '#16A34A',
    fontWeight: '600',
  },
  linkInput: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.gray[300],
    borderRadius: 12,
    fontSize: 14,
    color: palette.gray[900],
    marginBottom: 16,
  },
  uploadButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  backButton: {
    flex: 1,
    backgroundColor: palette.gray[100],
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: palette.gray[700],
    fontSize: 16,
    fontWeight: '700',
  },
  sendReviewButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendReviewButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

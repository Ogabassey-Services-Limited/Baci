import Ionicons from "@react-native-vector-icons/ionicons/static";
import { formatPrice } from '@/stores/cart-store';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import AppKeyboardAwareScrollView from '@/components/ui/AppKeyboardAwareScrollView';
import { BRAND, palette } from '@/constants/Colors';
import { NEGOTIATION_CHEAPER_BUTTON_THRESHOLD } from './negotiation.constants';
import { negotiationModalViewStyles as styles } from './NegotiationModalView.styles';
import type {
  NegotiationModalViewProps,
  NegotiationStatus,
} from './NegotiationModalView.types';
import { validateNegotiationOffer } from './negotiation-validators';

export type { NegotiationModalViewProps, NegotiationStatus };

export function NegotiationModalView({
  attemptCount,
  counterOffer,
  currentPrice,
  keyboardAwareProps,
  message,
  onAcceptCounter,
  onBackFromUpload,
  onClose,
  onOpenUpload,
  onOfferChange,
  onPickImage,
  onSubmitOffer,
  onSubmittedAction,
  onSuccessAction,
  onTryAgain,
  onUploadLinkChange,
  onUploadSubmit,
  offer,
  productName,
  status,
  submittedActionLabel = 'Got it',
  successActionLabel,
  successActionStyle = 'neutral',
  uploadFile,
  uploadLink,
  visible,
}: NegotiationModalViewProps) {
  if (!visible) {
    return null;
  }

  const handleSubmitPress = () => {
    if (!offer) {
      return;
    }

    const validationResult = validateNegotiationOffer({ currentPrice, offer });

    if (!validationResult.valid) {
      Alert.alert(validationResult.title, validationResult.message);
      return;
    }

    onSubmitOffer(validationResult.amount);
  };

  const successButtonStyle =
    successActionStyle === 'primary' ? styles.applyButton : styles.doneButton;
  const successButtonTextStyle =
    successActionStyle === 'primary'
      ? styles.applyButtonText
      : styles.doneButtonText;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal={true}
    >
      <AppKeyboardContainer style={styles.overlay}>
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

          <AppKeyboardAwareScrollView
            {...keyboardAwareProps}
            style={[styles.content, keyboardAwareProps?.style]}
            contentContainerStyle={[
              styles.contentContainer,
              keyboardAwareProps?.contentContainerStyle,
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.productInfo}>
              <Text style={styles.productLabel}>PRODUCT</Text>
              <Text style={styles.productName} numberOfLines={1}>
                {productName}
              </Text>
              <Text style={styles.priceRow}>
                <Text style={styles.priceLabel}>Current Price: </Text>
                <Text style={styles.priceValue}>{formatPrice(currentPrice)}</Text>
              </Text>
            </View>

            {status === 'input' && (
              <Animated.View entering={FadeIn.duration(200)}>
                <Text style={styles.inputLabel}>Your Offer (₦)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.priceInput}
                    value={offer}
                    onChangeText={onOfferChange}
                    placeholder="Enter amount..."
                    placeholderTextColor={palette.gray[400]}
                    keyboardType="numeric"
                  />
                </View>
                <Pressable
                  style={styles.submitButton}
                  onPress={handleSubmitPress}
                  accessibilityLabel="Submit your offer"
                  accessibilityRole="button"
                >
                  <Text style={styles.submitButtonText}>Submit Offer</Text>
                </Pressable>
              </Animated.View>
            )}

            {status === 'processing' && (
              <Animated.View entering={FadeIn.duration(120)} style={styles.centerContainer}>
                <ActivityIndicator size="large" color={BRAND.primary} />
                <Text style={styles.processingText}>Checking best deal...</Text>
              </Animated.View>
            )}

            {status === 'success' && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.centerContainer}>
                <View style={styles.successCircle}>
                  <Ionicons name="checkmark-circle" size={28} color="#16A34A" />
                </View>
                <Text style={styles.successTitle}>Offer Accepted!</Text>
                <Text style={styles.successSubtext}>{message}</Text>
                <Pressable style={successButtonStyle} onPress={onSuccessAction}>
                  <Text style={successButtonTextStyle}>{successActionLabel}</Text>
                </Pressable>
              </Animated.View>
            )}

            {status === 'failed' && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.centerContainer}>
                <View style={styles.amberCircle}>
                  <Ionicons name="alert-circle" size={28} color="#F59E0B" />
                </View>
                <Text style={styles.successTitle}>Counter Offer</Text>
                <Text style={styles.successSubtext}>{message}</Text>
                {counterOffer ? (
                  <View style={styles.counterBox}>
                    <Text style={styles.counterPrice}>{formatPrice(counterOffer)}</Text>
                    <Pressable style={styles.acceptButton} onPress={onAcceptCounter}>
                      <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                      <Text style={styles.acceptButtonText}>Accept Offer</Text>
                    </Pressable>
                  </View>
                ) : null}
                <View style={styles.failedActions}>
                  <Pressable style={styles.tryAgainButton} onPress={onTryAgain}>
                    <Text style={styles.tryAgainButtonText}>Negotiate Again</Text>
                  </Pressable>
                  {attemptCount >= NEGOTIATION_CHEAPER_BUTTON_THRESHOLD ? (
                    <Pressable style={styles.cheaperButton} onPress={onOpenUpload}>
                      <Ionicons name="cloud-upload-outline" size={16} color="#1D4ED8" />
                      <Text style={styles.cheaperButtonText}>I saw it cheaper</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Animated.View>
            )}

            {status === 'upload' && (
              <Animated.View entering={FadeIn.duration(200)}>
                <Text style={styles.inputLabel}>Share proof of a lower price</Text>
                <Text style={styles.uploadHelp}>{message}</Text>
                <View style={styles.uploadInfoBox}>
                  <Text style={styles.uploadInfoText}>
                    Add a screenshot or link and the merchant will review it.
                  </Text>
                </View>
                <Pressable style={styles.uploadButton} onPress={onPickImage}>
                  <Ionicons name="image-outline" size={18} color="#111827" />
                  <Text style={styles.uploadButtonText}>
                    {uploadFile ? 'Change Photo' : 'Upload Photo'}
                  </Text>
                </Pressable>
                {uploadFile ? (
                  <Text style={styles.selectedFileText}>Photo attached</Text>
                ) : null}
                <Text style={styles.orText}>OR</Text>
                <TextInput
                  style={styles.linkInput}
                  value={uploadLink}
                  onChangeText={onUploadLinkChange}
                  placeholder="Paste competitor product URL"
                  placeholderTextColor={palette.gray[400]}
                  autoCapitalize="none"
                />
                <View style={styles.uploadActions}>
                  <Pressable style={styles.backButton} onPress={onBackFromUpload}>
                    <Text style={styles.backButtonText}>Back</Text>
                  </Pressable>
                  <Pressable style={styles.sendReviewButton} onPress={onUploadSubmit}>
                    <Ionicons name="cloud-upload" size={16} color="#FFF" />
                    <Text style={styles.sendReviewButtonText}>Send for Review</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

            {status === 'submitted' && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.centerContainer}>
                <View style={styles.successCircle}>
                  <Ionicons name="checkmark-circle" size={28} color="#16A34A" />
                </View>
                <Text style={styles.successTitle}>Request Sent</Text>
                <Text style={styles.successSubtext}>{message}</Text>
                <Pressable style={styles.doneButton} onPress={onSubmittedAction}>
                  <Text style={styles.doneButtonText}>{submittedActionLabel}</Text>
                </Pressable>
              </Animated.View>
            )}
          </AppKeyboardAwareScrollView>
        </Animated.View>
      </AppKeyboardContainer>
    </Modal>
  );
}

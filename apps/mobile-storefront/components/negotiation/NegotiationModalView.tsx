import Ionicons from '@react-native-vector-icons/ionicons';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import AppKeyboardAwareScrollView from '@/components/ui/AppKeyboardAwareScrollView';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import { withAlpha } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { formatPrice } from '@/stores/cart-store';
import { negotiationModalViewStyles as styles } from './NegotiationModalView.styles';
import type {
  NegotiationModalViewProps,
  NegotiationStatus,
} from './NegotiationModalView.types';
import { NegotiationOfferForm } from './NegotiationOfferForm';
import { NegotiationProductSummary } from './NegotiationProductSummary';
import { NegotiationUploadForm } from './NegotiationUploadForm';
import { NEGOTIATION_CHEAPER_BUTTON_THRESHOLD } from './negotiation.constants';
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
  const { colors, shadows } = useTheme();

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
    successActionStyle === 'primary'
      ? [styles.applyButton, { backgroundColor: colors.primary }]
      : [styles.doneButton, { backgroundColor: colors.muted }];
  const successButtonTextStyle =
    successActionStyle === 'primary'
      ? [styles.applyButtonText, { color: colors.primaryForeground }]
      : [styles.doneButtonText, { color: colors.text }];

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
          style={[
            styles.modalContainer,
            { backgroundColor: colors.card },
            shadows.xl,
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerIcon,
                  { backgroundColor: withAlpha(colors.primary, 0.14) },
                ]}
              >
                <Ionicons name="pricetag" size={15} color={colors.primary} />
              </View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Negotiate Price
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={12}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={colors.icon} />
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
            <NegotiationProductSummary
              currentPrice={currentPrice}
              productName={productName}
            />

            {status === 'input' && (
              <NegotiationOfferForm
                offer={offer}
                onOfferChange={onOfferChange}
                onSubmitPress={handleSubmitPress}
              />
            )}

            {status === 'processing' && (
              <Animated.View
                entering={FadeIn.duration(120)}
                style={styles.centerContainer}
              >
                <ActivityIndicator size="large" color={colors.primary} />
                <Text
                  style={[
                    styles.processingText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Checking best deal…
                </Text>
              </Animated.View>
            )}

            {status === 'success' && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={styles.centerContainer}
              >
                <View
                  style={[
                    styles.statusCircle,
                    { backgroundColor: withAlpha(colors.success, 0.16) },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={30}
                    color={colors.success}
                  />
                </View>
                <Text style={[styles.successTitle, { color: colors.text }]}>
                  Offer Accepted!
                </Text>
                <Text
                  style={[
                    styles.successSubtext,
                    { color: colors.textSecondary },
                  ]}
                >
                  {message}
                </Text>
                <Pressable style={successButtonStyle} onPress={onSuccessAction}>
                  <Text style={successButtonTextStyle}>
                    {successActionLabel}
                  </Text>
                </Pressable>
              </Animated.View>
            )}

            {status === 'final' && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={styles.centerContainer}
              >
                <View
                  style={[
                    styles.statusCircle,
                    { backgroundColor: withAlpha(colors.warning, 0.16) },
                  ]}
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={28}
                    color={colors.warning}
                  />
                </View>
                <Text style={[styles.successTitle, { color: colors.text }]}>
                  Best Price
                </Text>
                <Text
                  style={[
                    styles.successSubtext,
                    { color: colors.textSecondary },
                  ]}
                >
                  {message}
                </Text>
                <Pressable
                  style={[styles.doneButton, { backgroundColor: colors.muted }]}
                  onPress={onClose}
                >
                  <Text style={[styles.doneButtonText, { color: colors.text }]}>
                    Done
                  </Text>
                </Pressable>
              </Animated.View>
            )}

            {status === 'failed' && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={styles.centerContainer}
              >
                <View
                  style={[
                    styles.statusCircle,
                    { backgroundColor: withAlpha(colors.warning, 0.16) },
                  ]}
                >
                  <Ionicons
                    name="alert-circle"
                    size={28}
                    color={colors.warning}
                  />
                </View>
                <Text style={[styles.successTitle, { color: colors.text }]}>
                  Counter Offer
                </Text>
                <Text
                  style={[
                    styles.successSubtext,
                    { color: colors.textSecondary },
                  ]}
                >
                  {message}
                </Text>
                {counterOffer ? (
                  <View
                    style={[
                      styles.counterBox,
                      {
                        backgroundColor: withAlpha(colors.warning, 0.12),
                        borderColor: withAlpha(colors.warning, 0.4),
                      },
                    ]}
                  >
                    <Text style={[styles.counterPrice, { color: colors.text }]}>
                      {formatPrice(counterOffer)}
                    </Text>
                    <Pressable
                      style={[
                        styles.acceptButton,
                        { backgroundColor: colors.success },
                      ]}
                      onPress={onAcceptCounter}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#FFF"
                      />
                      <Text style={styles.acceptButtonText}>Accept Offer</Text>
                    </Pressable>
                  </View>
                ) : null}
                <View style={styles.failedActions}>
                  <Pressable
                    style={[
                      styles.tryAgainButton,
                      { borderColor: colors.border },
                    ]}
                    onPress={onTryAgain}
                  >
                    <Text
                      style={[
                        styles.tryAgainButtonText,
                        { color: colors.text },
                      ]}
                    >
                      Negotiate Again
                    </Text>
                  </Pressable>
                  {attemptCount >= NEGOTIATION_CHEAPER_BUTTON_THRESHOLD ? (
                    <Pressable
                      style={[
                        styles.cheaperButton,
                        {
                          borderColor: withAlpha(colors.primary, 0.4),
                          backgroundColor: withAlpha(colors.primary, 0.1),
                        },
                      ]}
                      onPress={onOpenUpload}
                    >
                      <Ionicons
                        name="cloud-upload-outline"
                        size={16}
                        color={colors.primary}
                      />
                      <Text
                        style={[
                          styles.cheaperButtonText,
                          { color: colors.primary },
                        ]}
                      >
                        I saw it cheaper
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </Animated.View>
            )}

            {status === 'upload' && (
              <NegotiationUploadForm
                message={message}
                uploadFile={uploadFile}
                uploadLink={uploadLink}
                onPickImage={onPickImage}
                onUploadLinkChange={onUploadLinkChange}
                onBackFromUpload={onBackFromUpload}
                onUploadSubmit={onUploadSubmit}
              />
            )}

            {status === 'submitted' && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={styles.centerContainer}
              >
                <View
                  style={[
                    styles.statusCircle,
                    { backgroundColor: withAlpha(colors.success, 0.16) },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={30}
                    color={colors.success}
                  />
                </View>
                <Text style={[styles.successTitle, { color: colors.text }]}>
                  Request Sent
                </Text>
                <Text
                  style={[
                    styles.successSubtext,
                    { color: colors.textSecondary },
                  ]}
                >
                  {message}
                </Text>
                <Pressable
                  style={[styles.doneButton, { backgroundColor: colors.muted }]}
                  onPress={onSubmittedAction}
                >
                  <Text style={[styles.doneButtonText, { color: colors.text }]}>
                    {submittedActionLabel}
                  </Text>
                </Pressable>
              </Animated.View>
            )}
          </AppKeyboardAwareScrollView>
        </Animated.View>
      </AppKeyboardContainer>
    </Modal>
  );
}

import Ionicons from '@react-native-vector-icons/ionicons';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import AppKeyboardAwareScrollView from '@/components/ui/AppKeyboardAwareScrollView';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import { withAlpha } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { negotiationModalViewStyles as styles } from './NegotiationModalView.styles';
import type {
  NegotiationModalViewProps,
  NegotiationStatus,
} from './NegotiationModalView.types';
import { NegotiationOfferForm } from './NegotiationOfferForm';
import { NegotiationProductSummary } from './NegotiationProductSummary';
import { NegotiationStatusContent } from './NegotiationStatusContent';
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

            {status !== 'input' && (
              <NegotiationStatusContent
                attemptCount={attemptCount}
                counterOffer={counterOffer}
                message={message}
                onAcceptCounter={onAcceptCounter}
                onBackFromUpload={onBackFromUpload}
                onClose={onClose}
                onOpenUpload={onOpenUpload}
                onPickImage={onPickImage}
                onSubmittedAction={onSubmittedAction}
                onSuccessAction={onSuccessAction}
                onTryAgain={onTryAgain}
                onUploadLinkChange={onUploadLinkChange}
                onUploadSubmit={onUploadSubmit}
                status={status}
                submittedActionLabel={submittedActionLabel}
                successActionLabel={successActionLabel}
                successActionStyle={successActionStyle}
                uploadFile={uploadFile}
                uploadLink={uploadLink}
              />
            )}
          </AppKeyboardAwareScrollView>
        </Animated.View>
      </AppKeyboardContainer>
    </Modal>
  );
}

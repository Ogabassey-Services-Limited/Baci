import Ionicons from '@react-native-vector-icons/ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { withAlpha } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { formatPrice } from '@/stores/cart-store';
import { negotiationModalViewStyles as styles } from './NegotiationModalView.styles';
import type {
  NegotiationModalViewProps,
  NegotiationStatus,
} from './NegotiationModalView.types';
import { NegotiationUploadForm } from './NegotiationUploadForm';
import { NEGOTIATION_CHEAPER_BUTTON_THRESHOLD } from './negotiation.constants';
import { buildSuccessButtonStyles } from './negotiation-offer-helpers';

type NegotiationStatusContentProps = Pick<
  NegotiationModalViewProps,
  | 'attemptCount'
  | 'counterOffer'
  | 'message'
  | 'onAcceptCounter'
  | 'onBackFromUpload'
  | 'onClose'
  | 'onOpenUpload'
  | 'onPickImage'
  | 'onSubmittedAction'
  | 'onSuccessAction'
  | 'onTryAgain'
  | 'onUploadLinkChange'
  | 'onPhoneChange'
  | 'onUploadSubmit'
  | 'phone'
  | 'submittedActionLabel'
  | 'successActionLabel'
  | 'successActionStyle'
  | 'uploadFile'
  | 'uploadLink'
> & {
  status: Exclude<NegotiationStatus, 'input'>;
};

export function NegotiationStatusContent({
  attemptCount,
  counterOffer,
  message,
  onAcceptCounter,
  onBackFromUpload,
  onClose,
  onOpenUpload,
  onPickImage,
  onSubmittedAction,
  onSuccessAction,
  onTryAgain,
  onUploadLinkChange,
  onPhoneChange,
  onUploadSubmit,
  phone,
  status,
  submittedActionLabel = 'Got it',
  successActionLabel,
  successActionStyle = 'neutral',
  uploadFile,
  uploadLink,
}: NegotiationStatusContentProps) {
  const { colors } = useTheme();

  if (status === 'processing') {
    return (
      <Animated.View
        entering={FadeIn.duration(120)}
        style={styles.centerContainer}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.processingText, { color: colors.textSecondary }]}>
          Checking best deal…
        </Text>
      </Animated.View>
    );
  }

  if (status === 'success') {
    const { button: successButtonStyle, text: successButtonTextStyle } =
      buildSuccessButtonStyles(successActionStyle, colors);

    return (
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
          <Ionicons name="checkmark-circle" size={30} color={colors.success} />
        </View>
        <Text style={[styles.successTitle, { color: colors.text }]}>
          Offer Accepted!
        </Text>
        <Text style={[styles.successSubtext, { color: colors.textSecondary }]}>
          {message}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={successButtonStyle}
          onPress={onSuccessAction}
        >
          <Text style={successButtonTextStyle}>{successActionLabel}</Text>
        </Pressable>
      </Animated.View>
    );
  }

  if (status === 'final') {
    return (
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
          <Ionicons name="pricetag-outline" size={28} color={colors.warning} />
        </View>
        <Text style={[styles.successTitle, { color: colors.text }]}>
          Best Price
        </Text>
        <Text style={[styles.successSubtext, { color: colors.textSecondary }]}>
          {message}
        </Text>
        <Pressable
          style={[styles.doneButton, { backgroundColor: colors.muted }]}
          onPress={onClose}
          accessibilityRole="button"
        >
          <Text style={[styles.doneButtonText, { color: colors.text }]}>
            Done
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  if (status === 'failed') {
    return (
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
          <Ionicons name="alert-circle" size={28} color={colors.warning} />
        </View>
        <Text style={[styles.successTitle, { color: colors.text }]}>
          Counter Offer
        </Text>
        <Text style={[styles.successSubtext, { color: colors.textSecondary }]}>
          {message}
        </Text>
        {counterOffer ? (
          <CounterOfferBox
            counterOffer={counterOffer}
            onAcceptCounter={onAcceptCounter}
          />
        ) : null}
        <View style={styles.failedActions}>
          <Pressable
            style={[styles.tryAgainButton, { borderColor: colors.border }]}
            onPress={onTryAgain}
            accessibilityRole="button"
          >
            <Text style={[styles.tryAgainButtonText, { color: colors.text }]}>
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
              accessibilityRole="button"
            >
              <Ionicons
                name="cloud-upload-outline"
                size={16}
                color={colors.primary}
              />
              <Text
                style={[styles.cheaperButtonText, { color: colors.primary }]}
              >
                I saw it cheaper
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    );
  }

  if (status === 'upload') {
    return (
      <NegotiationUploadForm
        message={message}
        uploadFile={uploadFile}
        uploadLink={uploadLink}
        phone={phone}
        onPickImage={onPickImage}
        onUploadLinkChange={onUploadLinkChange}
        onPhoneChange={onPhoneChange}
        onBackFromUpload={onBackFromUpload}
        onUploadSubmit={onUploadSubmit}
      />
    );
  }

  return (
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
        <Ionicons name="checkmark-circle" size={30} color={colors.success} />
      </View>
      <Text style={[styles.successTitle, { color: colors.text }]}>
        Request Sent
      </Text>
      <Text style={[styles.successSubtext, { color: colors.textSecondary }]}>
        {message}
      </Text>
      <Pressable
        style={[styles.doneButton, { backgroundColor: colors.muted }]}
        onPress={onSubmittedAction}
        accessibilityRole="button"
      >
        <Text style={[styles.doneButtonText, { color: colors.text }]}>
          {submittedActionLabel}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function CounterOfferBox({
  counterOffer,
  onAcceptCounter,
}: {
  counterOffer: number;
  onAcceptCounter: () => void;
}) {
  const { colors } = useTheme();

  return (
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
        style={[styles.acceptButton, { backgroundColor: colors.success }]}
        onPress={onAcceptCounter}
        accessibilityRole="button"
      >
        <Ionicons
          name="checkmark-circle"
          size={16}
          color={colors.primaryForeground}
        />
        <Text style={styles.acceptButtonText}>Accept Offer</Text>
      </Pressable>
    </View>
  );
}

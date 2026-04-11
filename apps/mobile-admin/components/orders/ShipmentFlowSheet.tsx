import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareModalContainer } from '@/components/ui/KeyboardAwareModalContainer';
import { useTheme } from '@/hooks/useTheme';
import type {
  ShipmentCompletionMode,
  ShipmentFlowStep,
} from '@/lib/order-shipment';
import { styles } from './ShipmentFlowSheet.styles';
import {
  ShipmentFlowDetailsStep,
  ShipmentFlowMethodStep,
  ShipmentFlowRiderStep,
} from './ShipmentFlowSheetSections';

interface ShipmentFlowSheetProps {
  canUseProvider: boolean;
  fulfillmentDetails: {
    imei: string;
    serialNumber: string;
  };
  hasExistingFulfillment: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onContinueFromDetails: () => void;
  onContinueFromMethod: () => void;
  onConfirmSelfFulfillment: () => void;
  onFulfillmentDetailsChange: (
    field: 'imei' | 'serialNumber',
    value: string
  ) => void;
  onModeChange: (mode: ShipmentCompletionMode) => void;
  onRiderPhoneChange: (value: string) => void;
  onSelectSavedRider: (phone: string) => void;
  onStepBack: () => void;
  orderNumber: string;
  providerLabel: string | null;
  requiresFulfillment: boolean;
  riderPhone: string;
  savedRiders: string[];
  selectedMode: ShipmentCompletionMode;
  step: ShipmentFlowStep;
  visible: boolean;
}

export function ShipmentFlowSheet({
  canUseProvider,
  fulfillmentDetails,
  hasExistingFulfillment,
  isSubmitting,
  onClose,
  onContinueFromDetails,
  onContinueFromMethod,
  onConfirmSelfFulfillment,
  onFulfillmentDetailsChange,
  onModeChange,
  onRiderPhoneChange,
  onSelectSavedRider,
  onStepBack,
  orderNumber,
  providerLabel,
  requiresFulfillment,
  riderPhone,
  savedRiders,
  selectedMode,
  step,
  visible,
}: ShipmentFlowSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const steps = requiresFulfillment
    ? [
        { id: 'details' as const, label: 'Details' },
        { id: 'method' as const, label: 'Shipping' },
        { id: 'rider' as const, label: 'Dispatch' },
      ]
    : [
        { id: 'method' as const, label: 'Shipping' },
        { id: 'rider' as const, label: 'Dispatch' },
      ];
  const currentStepIndex = steps.findIndex((item) => item.id === step);
  const showBack = currentStepIndex > 0;
  const primaryActionLabel =
    step === 'details'
      ? 'Continue'
      : step === 'method'
        ? selectedMode === 'self_fulfillment'
          ? 'Continue to Rider'
          : providerLabel
            ? `Book with ${providerLabel}`
            : 'Use Shipping Provider'
        : 'Mark Shipped';

  if (!visible) {
    return null;
  }

  const handleRequestClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleBack = () => {
    if (isSubmitting) return;
    onStepBack();
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={handleRequestClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          disabled={isSubmitting}
          style={styles.backdrop}
          onPress={handleRequestClose}
        />
        <KeyboardAwareModalContainer
          align="end"
          contentContainerStyle={styles.keyboardContent}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <View style={styles.header}>
              <View>
                <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
                  Ship {orderNumber}
                </Text>
                <Text style={[styles.title, { color: colors.text }]}>
                  {step === 'details'
                    ? 'Fulfillment Details'
                    : step === 'method'
                      ? 'Choose Shipping Method'
                      : 'Dispatch Rider'}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close shipment flow"
                disabled={isSubmitting}
                hitSlop={8}
                onPress={handleRequestClose}
                style={[
                  styles.closeButton,
                  { backgroundColor: colors.backgroundLight },
                ]}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.stepRow}>
              {steps.map((item, index) => {
                const isActive = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                return (
                  <View key={item.id} style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepDot,
                        {
                          backgroundColor: isActive
                            ? colors.primary
                            : colors.backgroundLight,
                          borderColor: isCurrent
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepDotText,
                          {
                            color: isActive
                              ? colors.textOnPrimary
                              : colors.textSecondary,
                          },
                        ]}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        {
                          color: isCurrent ? colors.text : colors.textSecondary,
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                );
              })}
            </View>

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              style={styles.content}
            >
              {step === 'details' ? (
                <ShipmentFlowDetailsStep
                  fulfillmentDetails={fulfillmentDetails}
                  hasExistingFulfillment={hasExistingFulfillment}
                  onFulfillmentDetailsChange={onFulfillmentDetailsChange}
                />
              ) : null}

              {step === 'method' ? (
                <ShipmentFlowMethodStep
                  canUseProvider={canUseProvider}
                  onModeChange={onModeChange}
                  providerLabel={providerLabel}
                  selectedMode={selectedMode}
                />
              ) : null}

              {step === 'rider' ? (
                <ShipmentFlowRiderStep
                  onRiderPhoneChange={onRiderPhoneChange}
                  onSelectSavedRider={onSelectSavedRider}
                  riderPhone={riderPhone}
                  savedRiders={savedRiders}
                />
              ) : null}
            </ScrollView>

            <View style={styles.footer}>
              {showBack ? (
                <Pressable
                  accessibilityLabel="Back"
                  disabled={isSubmitting}
                  onPress={handleBack}
                  style={[
                    styles.secondaryButton,
                    { backgroundColor: colors.backgroundLight },
                  ]}
                >
                  <Text
                    style={[styles.secondaryButtonText, { color: colors.text }]}
                  >
                    Back
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityLabel={primaryActionLabel}
                disabled={isSubmitting}
                onPress={
                  step === 'details'
                    ? onContinueFromDetails
                    : step === 'method'
                      ? onContinueFromMethod
                      : onConfirmSelfFulfillment
                }
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary },
                  showBack ? null : styles.primaryButtonFull,
                  isSubmitting ? styles.primaryButtonDisabled : null,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator
                    color={colors.textOnPrimary}
                    size="small"
                  />
                ) : (
                  <>
                    <Ionicons
                      color={colors.textOnPrimary}
                      name={
                        step === 'details'
                          ? 'arrow-forward'
                          : step === 'method' &&
                              selectedMode === 'self_fulfillment'
                            ? 'bicycle-outline'
                            : 'checkmark-circle-outline'
                      }
                      size={18}
                    />
                    <Text
                      style={[
                        styles.primaryButtonText,
                        { color: colors.textOnPrimary },
                      ]}
                    >
                      {primaryActionLabel}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAwareModalContainer>
      </View>
    </Modal>
  );
}

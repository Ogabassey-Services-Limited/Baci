import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareModalContainer } from '@/components/ui/KeyboardAwareModalContainer';
import { useTheme } from '@/hooks/useTheme';
import type {
  ShipmentCompletionMode,
  ShipmentFlowStep,
} from '@/lib/order-shipment';
import { ShipmentFlowFooter } from './ShipmentFlowFooter';
import { ShipmentFlowHeader } from './ShipmentFlowHeader';
import { ShipmentFlowProgress } from './ShipmentFlowProgress';
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

  const handlePrimaryAction =
    step === 'details'
      ? onContinueFromDetails
      : step === 'method'
        ? onContinueFromMethod
        : onConfirmSelfFulfillment;

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
            <ShipmentFlowHeader
              colors={colors}
              isSubmitting={isSubmitting}
              onClose={handleRequestClose}
              orderNumber={orderNumber}
              step={step}
            />

            <ShipmentFlowProgress
              colors={colors}
              currentStepIndex={currentStepIndex}
              steps={steps}
            />

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

            <ShipmentFlowFooter
              colors={colors}
              isSubmitting={isSubmitting}
              onBack={handleBack}
              onPrimaryAction={handlePrimaryAction}
              primaryActionLabel={primaryActionLabel}
              selectedMode={selectedMode}
              showBack={showBack}
              step={step}
            />
          </View>
        </KeyboardAwareModalContainer>
      </View>
    </Modal>
  );
}

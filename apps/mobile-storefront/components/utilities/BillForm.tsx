import { ScrollView, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { BillerList } from './BillerList';
import { BillItemSelectionSection } from './BillItemSelectionSection';
import { BillPaymentFooter } from './BillPaymentFooter';
import { BillPaymentSection } from './BillPaymentSection';
import type { BillFormProps } from './bill-form.types';
import { billFormStyles as styles } from './bill-form-styles';
import { useBillFormController } from './use-bill-form-controller';

export function BillForm(props: BillFormProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const form = useBillFormController(props);

  return (
    <>
      <ScrollView
        ref={form.scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: form.footerSpacerHeight + (props.extraScrollPadding ?? 0) },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <BillerList
          billers={form.billersQuery.data ?? []}
          selectedBillerId={form.selectedBiller?.billerId ?? null}
          onSelect={form.handleBillerSelect}
          isLoading={form.billersQuery.isLoading}
          isCollapsed={!!form.selectedBiller && !form.isProviderPickerExpanded}
          onChangeSelection={() => {
            form.setRepeatPaymentActive(false);
            form.setProviderPickerExpanded(true);
          }}
          errorMessage={
            form.billersQuery.isError
              ? form.billersQuery.error instanceof Error
                ? form.billersQuery.error.message
                : 'Failed to load providers. Please try again.'
              : undefined
          }
        />

        {form.selectedBiller ? (
          <View
            onLayout={(event) => {
              if (form.shouldScrollToNextStep) {
                form.scheduleNextStepScroll(event.nativeEvent.layout.y);
              }
            }}
          >
            <BillItemSelectionSection
              beneficiaries={form.beneficiaries}
              billItemSelection={form.billItemSelection}
              colors={colors}
              customerId={form.customerId}
              handleBillItemSelect={form.handleBillItemSelect}
              handleSelectBeneficiary={form.handleSelectBeneficiary}
              handleVerify={form.handleVerify}
              isBillItemSelectionComplete={form.isBillItemSelectionComplete}
              isRepeatPaymentActive={form.isRepeatPaymentActive}
              verifiedCustomerName={form.verifiedCustomerName}
              selectedBillItemIdentifier={form.selectedBillItemIdentifier}
              selectedBillerId={form.selectedBiller.billerId}
              setCustomerId={form.updateCustomerId}
              setIsRepeatPaymentActive={form.setRepeatPaymentActive}
              type={props.type}
              verify={form.verify}
            />
          </View>
        ) : null}

        {form.canShowPayment ? (
          <BillPaymentSection
            colors={colors}
            formattedAmount={form.formattedAmount}
            handlePaymentLayout={form.handlePaymentLayout}
            isFixedAmount={form.isFixedAmount}
            numericAmount={form.numericAmount}
            payment={form.payment}
            setAmount={form.updateAmount}
          />
        ) : null}
      </ScrollView>

      {form.canShowPayment ? (
        <BillPaymentFooter
          colors={colors}
          footerBottomOffset={form.footerBottomOffset}
          insetsBottom={form.insets.bottom}
          isBusy={form.isBusy}
          isKeyboardVisible={form.isKeyboardVisible}
          numericAmount={form.numericAmount}
          onPurchase={form.handlePurchase}
          selectedSavedCardId={form.payment.selectedSavedCardId}
        />
      ) : null}
    </>
  );
}

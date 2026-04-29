import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useUtilityPayment } from '@/hooks/use-utility-payment';
import type { Biller, BillItem, BillType } from '@/hooks/use-vtu-billers';
import { useVTUBillers } from '@/hooks/use-vtu-billers';
import { useVTUVerify } from '@/hooks/use-vtu-verify';
import {
  chargeSavedVtuCard,
  initializeVtuCheckout,
  isSavedVtuCardChargeProcessing,
  requiresSavedVtuCardAuthorization,
  waitForVtuConfirmation,
} from '@/lib/vtu-checkout';
import { useAuthStore } from '@/stores/auth-store';
import { BillerList } from './BillerList';
import { billFormStyles as styles } from './bill-form-styles';
import {
  getResolvedBillItemCodes,
  resolveBillItemSelection,
  updateBillItemSelection,
} from './bill-item-selection';
import { getUtilityFooterOffset } from './get-utility-footer-offset';
import { UtilityPaymentOptions } from './UtilityPaymentOptions';
import { formatUtilityAmountInput } from './utility-amount-format';
import { VerificationCard } from './VerificationCard';

const BILL_TYPE_MAP = {
  tv: 'cable_tv',
  power: 'electricity',
  gaming: 'betting',
} as const satisfies Record<'tv' | 'power' | 'gaming', BillType>;

const IDENTIFIER_LABELS: Record<string, string> = {
  tv: 'Smart Card Number',
  power: 'Meter Number',
  gaming: 'Account ID',
};

const IDENTIFIER_PLACEHOLDERS: Record<string, string> = {
  tv: 'Enter smart card number',
  power: 'Enter meter number',
  gaming: 'Enter account ID',
};

const BILL_ITEM_LABELS: Record<string, string> = {
  tv: 'Package',
  power: 'Meter Type',
  gaming: 'Service Type',
};

const FOOTER_HEIGHT = 120;
const FOOTER_ERROR_BUFFER = 36;

interface BillFormProps {
  type: 'tv' | 'power' | 'gaming';
  onSuccess: (data: {
    reference: string;
    amount: number;
    customerIdentifier?: string;
    voucherPin?: string;
    cashback?: { amount: number; newBalance: number };
  }) => void;
  initialAmount?: string;
  initialBillerName?: string;
  initialBillItemIdentifier?: string;
  initialCustomerIdentifier?: string;
  isRepeatPaymentReady?: boolean;
}

function getBillItemLevelLabel(type: BillFormProps['type'], depth: number) {
  return depth === 0 ? BILL_ITEM_LABELS[type] : `Additional Option ${depth}`;
}

function getAmountForLeaf(billItem: BillItem | null) {
  return billItem?.isAmountFixed && billItem.amount > 0
    ? String(billItem.amount)
    : '';
}

function getInitialAmountForSelection(
  billItem: BillItem | null,
  initialAmount?: string
) {
  const fixedAmount = getAmountForLeaf(billItem);
  return fixedAmount || initialAmount || '';
}

function findBillItemPath(
  billItems: BillItem[] | undefined,
  itemCode: string,
  path: string[] = []
): string[] | null {
  for (const billItem of billItems ?? []) {
    const nextPath = [...path, billItem.itemCode];
    if (billItem.itemCode === itemCode) {
      return nextPath;
    }

    const childPath = findBillItemPath(billItem.billItems, itemCode, nextPath);
    if (childPath) {
      return childPath;
    }
  }

  return null;
}

function normalizeBillItemMatchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function billerNameContainsBillItemName(
  normalizedBillerName: string,
  normalizedBillItemName: string
) {
  return (
    normalizedBillItemName.length >= 3 &&
    normalizedBillerName.includes(normalizedBillItemName)
  );
}

function getBillerMatchTokens(value: string) {
  const normalizedValue = normalizeBillItemMatchText(value);
  return normalizedValue ? normalizedValue.split(' ') : [];
}

function startsWithCompleteBillerName(
  normalizedInitialName: string,
  normalizedBillerName: string
) {
  return (
    normalizedInitialName === normalizedBillerName ||
    normalizedInitialName.startsWith(`${normalizedBillerName} `)
  );
}

function containsBillerNameTokenSequence(
  initialNameTokens: string[],
  billerNameTokens: string[]
) {
  if (billerNameTokens.length === 0) {
    return false;
  }

  return initialNameTokens.some((_, index) =>
    billerNameTokens.every(
      (token, tokenIndex) => initialNameTokens[index + tokenIndex] === token
    )
  );
}

function findBillerByInitialName(
  billers: Biller[],
  initialBillerName: string
) {
  const normalizedInitialName = normalizeBillItemMatchText(initialBillerName);
  if (!normalizedInitialName) {
    return null;
  }

  const billerCandidates = billers.map((biller) => ({
    biller,
    normalizedName: normalizeBillItemMatchText(biller.billerName),
    tokens: getBillerMatchTokens(biller.billerName),
  }));

  return (
    billerCandidates.find(
      (candidate) => candidate.normalizedName === normalizedInitialName
    )?.biller ??
    billerCandidates.find((candidate) =>
      startsWithCompleteBillerName(
        normalizedInitialName,
        candidate.normalizedName
      )
    )?.biller ??
    billerCandidates.find((candidate) =>
      containsBillerNameTokenSequence(
        getBillerMatchTokens(initialBillerName),
        candidate.tokens
      )
    )?.biller ??
    null
  );
}

function findBillItemPathByName(
  billItems: BillItem[] | undefined,
  billerName: string,
  path: string[] = []
): string[] | null {
  const normalizedBillerName = normalizeBillItemMatchText(billerName);

  for (const billItem of billItems ?? []) {
    const nextPath = [...path, billItem.itemCode];
    const childPath = findBillItemPathByName(
      billItem.billItems,
      billerName,
      nextPath
    );

    if (childPath) {
      return childPath;
    }

    const normalizedItemName = normalizeBillItemMatchText(billItem.itemName);
    if (
      billerNameContainsBillItemName(normalizedBillerName, normalizedItemName)
    ) {
      return nextPath;
    }
  }

  return null;
}

interface InitialBillerMatch {
  biller: Biller;
  codes: string[];
  resolvedToSpecificBillItem: boolean;
}

function findInitialBillerMatch({
  billers,
  initialBillerName,
  initialBillItemIdentifier,
}: {
  billers: Biller[];
  initialBillerName?: string;
  initialBillItemIdentifier?: string;
}): InitialBillerMatch | null {
  if (initialBillItemIdentifier) {
    for (const biller of billers) {
      const path = findBillItemPath(
        biller.billItems,
        initialBillItemIdentifier
      );
      if (path) {
        return {
          biller,
          codes: path,
          resolvedToSpecificBillItem: true,
        };
      }
    }
  }

  if (!initialBillerName) {
    return null;
  }

  const biller = findBillerByInitialName(billers, initialBillerName);

  if (!biller) {
    return null;
  }

  const namePath = findBillItemPathByName(biller.billItems, initialBillerName);
  if (namePath) {
    return {
      biller,
      codes: namePath,
      resolvedToSpecificBillItem: true,
    };
  }

  return {
    biller,
    codes: getResolvedBillItemCodes(biller.billItems),
    resolvedToSpecificBillItem: false,
  };
}

export function BillForm({
  initialAmount,
  initialBillerName,
  initialBillItemIdentifier,
  initialCustomerIdentifier,
  isRepeatPaymentReady = false,
  type,
  onSuccess,
}: BillFormProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { dismissKeyboard, isKeyboardVisible, keyboardHeight } = useKeyboard();
  const billType = BILL_TYPE_MAP[type];
  const {
    data: billers,
    isLoading: billersLoading,
    isError: billersError,
    error: billersErrorObj,
  } = useVTUBillers(billType);
  const verify = useVTUVerify();
  const customer = useAuthStore((state) => state.customer);
  const payment = useUtilityPayment();
  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null);
  const [selectedBillItemCodes, setSelectedBillItemCodes] = useState<string[]>(
    []
  );
  const [customerId, setCustomerId] = useState(initialCustomerIdentifier ?? '');
  const [amount, setAmount] = useState(initialAmount ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProviderPickerExpanded, setIsProviderPickerExpanded] =
    useState(true);
  const [isRepeatPaymentActive, setIsRepeatPaymentActive] = useState(false);
  const [shouldScrollToNextStep, setShouldScrollToNextStep] = useState(false);
  const [shouldScrollToPayment, setShouldScrollToPayment] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const pendingNextStepScrollYRef = useRef<number | null>(null);
  const isNextStepScrollScheduledRef = useRef(false);

  const billItemSelection = resolveBillItemSelection(
    selectedBiller?.billItems,
    selectedBillItemCodes
  );
  const selectedBillItem = billItemSelection.leaf;
  const selectedBillItemPathLabel = billItemSelection.selectedPath
    .map((item) => item.itemName)
    .join(' / ');
  const requiresBillItemSelection = billItemSelection.levels.length > 0;
  const isBillItemSelectionComplete =
    !requiresBillItemSelection || billItemSelection.isComplete;
  const selectedBillItemIdentifier = requiresBillItemSelection
    ? (selectedBillItem?.itemCode ?? null)
    : (selectedBiller?.billerId ?? null);
  const isFixedAmount = selectedBillItem?.isAmountFixed ?? false;
  const numericAmount = Number(amount.replace(/\D/g, ''));
  const formattedAmount = formatUtilityAmountInput(amount);
  const canShowPayment = Boolean(
    verify.data?.verified || isRepeatPaymentActive
  );
  const footerSpacerHeight = canShowPayment
    ? FOOTER_HEIGHT + Math.max(insets.bottom, SPACING.md) + FOOTER_ERROR_BUFFER
    : SPACING.xl;
  const footerBottomOffset = getUtilityFooterOffset({
    bottomInset: insets.bottom,
    isKeyboardVisible,
    keyboardHeight,
  });
  const isBusy = isSubmitting;

  useEffect(() => {
    if (selectedBiller || !billers?.length) {
      return;
    }

    const match = findInitialBillerMatch({
      billers,
      initialBillerName,
      initialBillItemIdentifier,
    });

    if (!match) {
      return;
    }

    const nextSelection = resolveBillItemSelection(
      match.biller.billItems,
      match.codes
    );
    setSelectedBiller(match.biller);
    setSelectedBillItemCodes(match.codes);
    setIsProviderPickerExpanded(false);
    setAmount(getInitialAmountForSelection(nextSelection.leaf, initialAmount));
    const hasExactBillItem =
      nextSelection.levels.length === 0 || match.resolvedToSpecificBillItem;
    if (
      isRepeatPaymentReady &&
      initialCustomerIdentifier &&
      hasExactBillItem &&
      nextSelection.isComplete
    ) {
      setIsRepeatPaymentActive(true);
      setShouldScrollToPayment(true);
    }
  }, [
    billers,
    initialAmount,
    initialBillerName,
    initialBillItemIdentifier,
    initialCustomerIdentifier,
    isRepeatPaymentReady,
    selectedBiller,
  ]);

  const resetVerification = () => {
    if (!verify.isPending) {
      verify.reset();
    }
  };

  const handleBillerSelect = (biller: Biller) => {
    const nextCodes = getResolvedBillItemCodes(biller.billItems);
    const nextSelection = resolveBillItemSelection(biller.billItems, nextCodes);

    setSelectedBiller(biller);
    setSelectedBillItemCodes(nextCodes);
    setIsProviderPickerExpanded(false);
    setShouldScrollToNextStep(true);
    setIsRepeatPaymentActive(false);
    setAmount(getAmountForLeaf(nextSelection.leaf));
    resetVerification();
  };

  const handleBillItemSelect = (depth: number, billItem: BillItem) => {
    if (!selectedBiller) {
      return;
    }

    const nextCodes = updateBillItemSelection(
      selectedBiller.billItems,
      selectedBillItemCodes,
      depth,
      billItem.itemCode
    );
    const nextSelection = resolveBillItemSelection(
      selectedBiller.billItems,
      nextCodes
    );

    setSelectedBillItemCodes(nextCodes);
    setIsRepeatPaymentActive(false);
    setAmount(getAmountForLeaf(nextSelection.leaf));
    setShouldScrollToNextStep(true);
    resetVerification();
  };

  const scheduleNextStepScroll = (nextStepY: number) => {
    pendingNextStepScrollYRef.current = Math.max(nextStepY - SPACING.md, 0);

    if (isNextStepScrollScheduledRef.current) {
      return;
    }

    isNextStepScrollScheduledRef.current = true;
    requestAnimationFrame(() => {
      InteractionManager.runAfterInteractions(() => {
        const scrollY = pendingNextStepScrollYRef.current;
        pendingNextStepScrollYRef.current = null;
        isNextStepScrollScheduledRef.current = false;

        if (scrollY === null) {
          return;
        }

        scrollViewRef.current?.scrollTo({
          animated: true,
          y: scrollY,
        });
        setShouldScrollToNextStep(false);
      });
    });
  };

  const handleVerify = () => {
    dismissKeyboard();

    if (
      !selectedBiller ||
      !selectedBillItemIdentifier ||
      !customerId ||
      !isBillItemSelectionComplete
    ) {
      const identifierLabel = IDENTIFIER_LABELS[type].toLowerCase();
      const steps = ['select a provider'];
      if (requiresBillItemSelection) {
        steps.push('complete the available options');
      }
      steps.push(`enter your ${identifierLabel}`);
      Alert.alert('Missing Information', `Please ${steps.join(', ')}.`);
      return;
    }

    verify.mutate({
      billItemIdentifier: selectedBillItemIdentifier,
      customerIdentifier: customerId,
    });
  };

  const handlePurchase = async () => {
    dismissKeyboard();

    if (isBusy) return;

    if (!selectedBiller) {
      Alert.alert('Missing Provider', 'Please select a provider.');
      return;
    }

    if (!canShowPayment) {
      Alert.alert(
        'Verification Required',
        `Please verify your ${IDENTIFIER_LABELS[type].toLowerCase()} before making a purchase.`
      );
      return;
    }

    if (!amount) {
      Alert.alert('Missing Amount', 'Please enter an amount.');
      return;
    }

    if (numericAmount < 50 || numericAmount > 500000) {
      Alert.alert('Invalid Amount', 'Amount must be between ₦50 and ₦500,000.');
      return;
    }
    if (!payment.selectedSavedCardId && !payment.selectedGateway) {
      Alert.alert(
        'Select Payment Method',
        'Choose a payment method before continuing.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const customerName =
        [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') ||
        customer?.email;
      const payload = {
        amount: numericAmount,
        billItemIdentifier: selectedBillItemIdentifier ?? undefined,
        billerName: selectedBillItemPathLabel
          ? `${selectedBiller.billerName} - ${selectedBillItemPathLabel}`
          : selectedBiller.billerName,
        customerIdentifier: customerId,
        customerName,
        customerPhone: customer?.phone,
        type: billType as 'electricity' | 'cable_tv' | 'betting',
      };

      if (payment.selectedSavedCardId) {
        const result = await chargeSavedVtuCard({
          ...payload,
          savedPaymentMethodId: payment.selectedSavedCardId,
        });

        if (requiresSavedVtuCardAuthorization(result)) {
          router.push({
            pathname: '/payment-gateway',
            params: {
              amount: String(numericAmount),
              authorizationUrl: result.authorization_url,
              customerIdentifier: customerId,
              gateway: result.gateway,
              paymentKind: 'vtu',
              reference: result.reference,
              utilityType: type,
            },
          });
          return;
        }

        if (isSavedVtuCardChargeProcessing(result)) {
          const confirmed = await waitForVtuConfirmation({
            gateway: 'paystack',
            reference: result.reference,
          });
          onSuccess({
            amount: confirmed.amount ?? numericAmount,
            cashback: confirmed.cashback
              ? {
                  amount: confirmed.cashback.amount,
                  newBalance: confirmed.cashback.newBalance,
                }
              : undefined,
            customerIdentifier: customerId,
            reference: confirmed.reference,
            voucherPin: confirmed.voucherPin,
          });
          return;
        }

        onSuccess({
          amount: result.amount,
          cashback: result.cashback
            ? {
                amount: result.cashback.amount,
                newBalance: result.cashback.newBalance,
              }
            : undefined,
          customerIdentifier: customerId,
          reference: result.reference,
          voucherPin: result.voucherPin,
        });
        return;
      }

      const result = await initializeVtuCheckout({
        ...payload,
        gateway: payment.selectedGateway,
      });

      router.push({
        pathname: '/payment-gateway',
        params: {
          amount: String(numericAmount),
          authorizationUrl: result.authorization_url,
          customerIdentifier: customerId,
          gateway: result.gateway,
          paymentKind: 'vtu',
          reference: result.reference,
          utilityType: type,
        },
      });
    } catch (error) {
      Alert.alert(
        'Payment Failed',
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: footerSpacerHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Select Provider
        </Text>
        <BillerList
          billers={billers || []}
          selectedBillerId={selectedBiller?.billerId ?? null}
          onSelect={handleBillerSelect}
          isLoading={billersLoading}
          isCollapsed={!!selectedBiller && !isProviderPickerExpanded}
          onChangeSelection={() => {
            setIsRepeatPaymentActive(false);
            setIsProviderPickerExpanded(true);
          }}
          errorMessage={
            billersError
              ? billersErrorObj instanceof Error
                ? billersErrorObj.message
                : 'Failed to load providers. Please try again.'
              : undefined
          }
        />

        {selectedBiller ? (
          <View
            onLayout={(event) => {
              if (!shouldScrollToNextStep) {
                return;
              }

              const nextStepY = event.nativeEvent.layout.y;
              scheduleNextStepScroll(nextStepY);
            }}
          >
            {billItemSelection.levels.map((level) => (
              <View
                key={`${selectedBiller.billerId}-${level.depth}`}
                style={{ marginTop: 24 }}
              >
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {getBillItemLevelLabel(type, level.depth)}
                </Text>
                <View style={styles.optionGrid}>
                  {level.options.map((billItem) => {
                    const isSelected = level.selectedCode === billItem.itemCode;

                    return (
                      <Pressable
                        key={`${level.depth}-${billItem.itemCode}`}
                        style={[
                          styles.optionCard,
                          {
                            backgroundColor: isSelected
                              ? BRAND.primary
                              : colors.card,
                            borderColor: isSelected
                              ? BRAND.primary
                              : colors.border,
                          },
                        ]}
                        onPress={() =>
                          handleBillItemSelect(level.depth, billItem)
                        }
                      >
                        <Text
                          style={[
                            styles.optionName,
                            { color: isSelected ? '#FFF' : colors.text },
                          ]}
                          numberOfLines={2}
                        >
                          {billItem.itemName}
                        </Text>
                        {billItem.isAmountFixed && billItem.amount > 0 ? (
                          <Text
                            style={[
                              styles.optionMeta,
                              {
                                color: isSelected
                                  ? 'rgba(255,255,255,0.85)'
                                  : colors.textSecondary,
                              },
                            ]}
                          >
                            ₦{billItem.amount.toLocaleString()}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {isBillItemSelectionComplete ? (
              <>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.text, marginTop: 24 },
                  ]}
                >
                  {IDENTIFIER_LABELS[type]}
                </Text>
                <View style={styles.verifyRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.verifyInput,
                      {
                        backgroundColor: colors.muted,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder={IDENTIFIER_PLACEHOLDERS[type]}
                    placeholderTextColor={colors.placeholder}
                    keyboardType="number-pad"
                    value={customerId}
                    onChangeText={(text) => {
                      setCustomerId(text);
                      setIsRepeatPaymentActive(false);
                      resetVerification();
                    }}
                  />
                  {isRepeatPaymentActive ? (
                    <View
                      style={[
                        styles.verifiedPill,
                        { backgroundColor: colors.success },
                      ]}
                    >
                      <Text
                        style={[
                          styles.verifiedPillText,
                          { color: colors.black },
                        ]}
                      >
                        Verified
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      style={[
                        styles.verifyButton,
                        {
                          opacity:
                            !customerId ||
                            !selectedBillItemIdentifier ||
                            verify.isPending
                              ? 0.6
                              : 1,
                        },
                      ]}
                      onPress={handleVerify}
                      disabled={
                        !customerId ||
                        !selectedBillItemIdentifier ||
                        verify.isPending
                      }
                    >
                      {verify.isPending ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={styles.verifyButtonText}>Verify</Text>
                      )}
                    </Pressable>
                  )}
                </View>

                {isRepeatPaymentActive ? (
                  <Text
                    style={[
                      styles.repeatReadyText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Using details from your previous successful purchase.
                  </Text>
                ) : verify.data || verify.isPending || verify.error ? (
                  <View style={{ marginTop: 12 }}>
                    <VerificationCard
                      verified={verify.data?.verified ?? false}
                      customerName={verify.data?.customerName}
                      message={verify.data?.message ?? verify.error?.message}
                      isLoading={verify.isPending}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        {canShowPayment ? (
          <View
            onLayout={(event) => {
              if (!shouldScrollToPayment) {
                return;
              }

              const paymentY = event.nativeEvent.layout.y;
              setShouldScrollToPayment(false);
              requestAnimationFrame(() => {
                scrollViewRef.current?.scrollTo({
                  animated: true,
                  y: Math.max(paymentY - SPACING.md, 0),
                });
              });
            }}
          >
            <View style={{ marginTop: 24 }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Amount (₦)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  isFixedAmount && styles.inputDisabled,
                  {
                    backgroundColor: colors.muted,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder={
                  isFixedAmount ? 'Amount set by provider' : 'Enter amount'
                }
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                value={formattedAmount}
                editable={!isFixedAmount}
                onChangeText={(text) => setAmount(text.replace(/\D/g, ''))}
              />
            </View>

            <UtilityPaymentOptions
              amount={numericAmount}
              cards={payment.cards}
              isLoadingCards={payment.isLoadingCards}
              onSelectGateway={payment.selectGateway}
              onSelectSavedCard={payment.selectSavedCard}
              selectedGateway={payment.selectedGateway}
              selectedSavedCardId={payment.selectedSavedCardId}
              supportedGateways={payment.supportedGateways}
            />
          </View>
        ) : null}
      </ScrollView>

      {canShowPayment ? (
        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.muted,
              bottom: footerBottomOffset,
              paddingBottom: isKeyboardVisible
                ? SPACING.sm
                : Math.max(insets.bottom, SPACING.md),
            },
          ]}
        >
          <Pressable
            style={[
              styles.payButton,
              {
                backgroundColor: BRAND.primary,
                opacity: isBusy ? 0.7 : 1,
              },
            ]}
            onPress={handlePurchase}
            disabled={isBusy}
          >
            {isBusy ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.payButtonText}>
                {payment.selectedSavedCardId
                  ? `Pay ₦${numericAmount ? numericAmount.toLocaleString() : '0'}`
                  : 'Continue to Payment'}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

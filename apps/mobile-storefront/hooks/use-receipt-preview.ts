/**
 * useReceiptPreview — manages the receipt preview state machine
 *
 * State transitions:
 *   idle → loading (user taps a receipt)
 *   loading → open (detail data arrives, HTML generated)
 *   open → idle (user closes the preview)
 *   loading → loading (user taps a different receipt while loading)
 */

import type { ReceiptMerchant, ReceiptOrder } from '@baci/shared';
import { generateReceiptHtml } from '@baci/shared';
import { useEffect, useState } from 'react';
import type { ReceiptListItem } from '@/types/receipt';
import { useMerchantReceiptInfo, useReceiptDetail } from './use-receipts';

type PreviewState =
  | { status: 'idle' }
  | { status: 'loading'; orderId: string }
  | { status: 'open'; orderId: string; html: string; isPaid: boolean };

export function useReceiptPreview() {
  const [state, setState] = useState<PreviewState>({ status: 'idle' });
  const { data: merchantInfo } = useMerchantReceiptInfo();

  // Derive orderId for the detail query (null when idle disables the hook)
  const selectedOrderId = state.status !== 'idle' ? state.orderId : null;
  const { data: receiptDetail } = useReceiptDetail(selectedOrderId);

  // Transition loading → open when detail data arrives
  useEffect(() => {
    if (state.status !== 'loading') return;
    if (!receiptDetail || !merchantInfo) return;
    if (receiptDetail.id !== state.orderId) return;

    const orderData: ReceiptOrder = {
      order_number: receiptDetail.order_number,
      created_at: receiptDetail.created_at,
      currency: receiptDetail.currency,
      total: receiptDetail.total,
      subtotal: receiptDetail.subtotal,
      shipping_fee: receiptDetail.shipping_fee,
      tax_amount: receiptDetail.tax_amount,
      discount_amount: receiptDetail.discount_amount,
      amount_paid: receiptDetail.amount_paid,
      balance: receiptDetail.balance,
      payment_status: receiptDetail.payment_status,
      payment_method: receiptDetail.payment_method,
      is_credit_order: receiptDetail.is_credit_order,
      customer_name: receiptDetail.customer_name,
      customer_email: receiptDetail.customer_email,
      customer_phone: receiptDetail.customer_phone,
      shipping_address: receiptDetail.shipping_address,
      virtual_account: receiptDetail.virtual_account,
      items: receiptDetail.items,
      transactions: receiptDetail.transactions,
    };

    const merchant: ReceiptMerchant = {
      business_name: merchantInfo.business_name,
      logo_url: merchantInfo.logo_url,
      email: merchantInfo.email,
      phone: merchantInfo.phone,
      support_email: merchantInfo.support_email,
      support_phone: merchantInfo.support_phone,
      business_address: merchantInfo.business_address,
      cac_rc_number: merchantInfo.cac_rc_number,
      tax_identification_number: merchantInfo.tax_identification_number,
      legal_entity_name: merchantInfo.legal_entity_name,
      brand_colors: merchantInfo.brand_colors ?? undefined,
      vat_registration_status: merchantInfo.vat_registration_status,
      vat_rate: merchantInfo.vat_rate,
      bank_code: merchantInfo.bank_code,
      bank_account_number: merchantInfo.bank_account_number,
      bank_name: merchantInfo.bank_name,
      bank_account_name: merchantInfo.bank_account_name,
      social_media: merchantInfo.social_media,
      pages: merchantInfo.pages,
    };

    const html = generateReceiptHtml(orderData, merchant);
    setState({
      status: 'open',
      orderId: state.orderId,
      html,
      isPaid: receiptDetail.payment_status === 'paid',
    });
  }, [receiptDetail, merchantInfo, state]);

  const openPreview = (item: ReceiptListItem) => {
    setState({ status: 'loading', orderId: item.id });
  };

  const openPreviewByOrderId = (orderId: string) => {
    setState({ status: 'loading', orderId });
  };

  const closePreview = () => {
    setState({ status: 'idle' });
  };

  return {
    isLoading: state.status === 'loading',
    isOpen: state.status === 'open',
    html: state.status === 'open' ? state.html : '',
    isPaid: state.status === 'open' ? state.isPaid : false,
    openPreview,
    openPreviewByOrderId,
    closePreview,
  };
}

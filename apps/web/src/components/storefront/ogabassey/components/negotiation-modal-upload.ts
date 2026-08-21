import type { CartItem } from '@/hooks/cart';
import type { createClient } from '@/lib/supabase/client';
import { uploadNegotiationEvidenceFile } from './negotiation-evidence';
import { resolveNegotiationCustomer } from './negotiation-modal-customer';
import { insertNegotiationRequest } from './negotiation-modal-request';
import type { NegotiationStatus } from './use-negotiation-modal-controller';
import {
  NegotiationValidationError,
  getContactValidationError,
} from './negotiation-modal-validation';

interface SubmitNegotiationUploadOptions {
  canApplyAsyncResult: () => boolean;
  cart?: CartItem[];
  condition?: string;
  currentPrice: number;
  email: string;
  itemId?: string;
  merchantId: string;
  offer: string;
  phone: string;
  productBrand?: string;
  productName: string;
  productSlug?: string;
  setMessage: (message: string) => void;
  setStatus: (status: NegotiationStatus) => void;
  supabase: ReturnType<typeof createClient>;
  type: 'single' | 'total';
  uploadFile: File | null;
  uploadLink: string;
  variantAttributes?: Record<string, string>;
  variantId?: string;
  variantName?: string;
}

function isValidEvidenceLink(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function submitNegotiationUpload({
  canApplyAsyncResult,
  cart,
  condition,
  currentPrice,
  email,
  itemId,
  merchantId,
  offer,
  phone,
  productBrand,
  productName,
  productSlug,
  setMessage,
  setStatus,
  supabase,
  type,
  uploadFile,
  uploadLink,
  variantAttributes,
  variantId,
  variantName,
}: SubmitNegotiationUploadOptions): Promise<void> {
  const trimmedLink = uploadLink.trim();
  if (trimmedLink && uploadFile) {
    alert('Use either a proof upload or a link, not both.');
    return;
  }
  if (!trimmedLink && !uploadFile) {
    alert('Upload proof or paste a link before sending your request.');
    return;
  }
  if (trimmedLink && !isValidEvidenceLink(trimmedLink)) {
    alert('Enter a valid http or https URL.');
    return;
  }
  const offeredPrice = Number(offer.trim());
  if (
    !Number.isFinite(offeredPrice) ||
    offeredPrice <= 0 ||
    offeredPrice > currentPrice
  ) {
    alert('Enter a valid offer amount before sending your request.');
    return;
  }

  let customer: Awaited<ReturnType<typeof resolveNegotiationCustomer>>;
  try {
    customer = await resolveNegotiationCustomer(supabase);
  } catch (error) {
    console.error('Failed to verify negotiation customer:', error);
    alert('Unable to verify your account. Please try again.');
    return;
  }
  const contactError = getContactValidationError({
    allowMissingContact: Boolean(
      customer.customerEmail || customer.customerPhone
    ),
    email,
    phone,
  });
  if (contactError) {
    alert(contactError);
    return;
  }
  if (!merchantId) {
    alert('Unable to submit request — merchant context unavailable.');
    return;
  }
  const customerEmail = email.trim().toLowerCase() || customer.customerEmail;
  const customerPhone = phone.trim() || customer.customerPhone;

  const submitMerchantRequest = async (evidenceUrl: string | undefined) => {
    setStatus('processing');
    try {
      await insertNegotiationRequest(supabase, {
        cart,
        condition,
        currentPrice,
        customerEmail,
        customerId: customer.customerId,
        customerPhone,
        evidenceUrl,
        itemId,
        merchantId,
        offeredPrice,
        productBrand,
        productName,
        productSlug,
        type,
        variantAttributes,
        variantId,
        variantName,
      });
      if (!canApplyAsyncResult()) return;
      setStatus('submitted');
      setMessage(
        "Request submitted! We'll notify you as soon as the merchant reviews your offer."
      );
    } catch (error) {
      console.error('Failed to submit request:', error);
      if (!canApplyAsyncResult()) return;
      alert(
        error instanceof NegotiationValidationError
          ? error.message
          : 'Failed to submit request. Please try again.'
      );
      setStatus('upload');
    }
  };

  if (trimmedLink) {
    await submitMerchantRequest(trimmedLink);
    return;
  }
  if (!uploadFile) {
    alert('Upload proof or paste a link before sending your request.');
    return;
  }

  setStatus('processing');
  try {
    const evidencePath = await uploadNegotiationEvidenceFile({
      file: uploadFile,
      merchantId,
    });
    await submitMerchantRequest(evidencePath);
  } catch (error) {
    console.error('Failed to upload evidence:', error);
    if (!canApplyAsyncResult()) return;
    alert(
      error instanceof Error
        ? error.message
        : 'Unable to upload evidence image. Please try again.'
    );
    setStatus('upload');
  }
}

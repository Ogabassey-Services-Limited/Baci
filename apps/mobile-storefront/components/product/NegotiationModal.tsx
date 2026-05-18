import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import type { ImpactFeedbackStyle } from 'expo-haptics';
import { NegotiationModalView, type NegotiationStatus } from '@/components/negotiation/NegotiationModalView';
import { NEGOTIATION_CHEAPER_BUTTON_THRESHOLD } from '@/components/negotiation/negotiation.constants';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/stores/cart-store';

const log = createLogger('NegotiationModal');

// 2026 Best Practice: Dynamic imports for native modules to prevent evaluation-time crashes
let Haptics: typeof import('expo-haptics') | null = null;
let ImagePicker: typeof import('expo-image-picker') | null = null;

const loadNativeModules = async () => {
  if (Platform.OS === 'web') return;
  try {
    const [haptic, picker] = await Promise.all([
      import('expo-haptics'),
      import('expo-image-picker'),
    ]);
    Haptics = haptic;
    ImagePicker = picker;
  } catch (e) {
    console.debug(
      '[NegotiationModal] Native modules ignored or failed to load:',
      e
    );
  }
};

void loadNativeModules();

interface NegotiationModalProps {
  visible: boolean;
  onClose: () => void;
  productId: string;
  merchantId: string;
  productName: string;
  currentPrice: number;
  onSuccess: (negotiatedPrice: number) => void;
  type?: 'single' | 'total';
  itemId?: string;
}

export function NegotiationModal({
  visible,
  onClose,
  productId,
  merchantId,
  productName,
  currentPrice,
  onSuccess,
  type = 'single',
  itemId,
}: NegotiationModalProps) {
  const [status, setStatus] = useState<NegotiationStatus>('input');
  const [offer, setOffer] = useState('');
  const [message, setMessage] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  const [counterOffer, setCounterOffer] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<string | null>(null);
  const [uploadLink, setUploadLink] = useState('');

  useEffect(() => {
    if (visible) {
      setOffer('');
      setStatus('input');
      setMessage('');
      setAttemptCount(0);
      setCounterOffer(null);
      setUploadFile(null);
      setUploadLink('');
    }
  }, [visible]);

  const triggerHaptic = (style?: ImpactFeedbackStyle) => {
    if (Platform.OS === 'ios' && Haptics) {
      Haptics.impactAsync(style ?? Haptics.ImpactFeedbackStyle.Light).catch(
        () => {}
      );
    }
  };

  const handleSubmitOffer = (offerAmount: number) => {
    setStatus('processing');
    triggerHaptic(Haptics?.ImpactFeedbackStyle?.Medium);

    setTimeout(() => {
      const discountPercentage = 1 - offerAmount / currentPrice;

      if (discountPercentage <= 0.05) {
        setStatus('success');
        setMessage(`Price updated: ${formatPrice(offerAmount)}`);
        triggerHaptic(Haptics?.ImpactFeedbackStyle?.Heavy);
        onSuccess(offerAmount);
        return;
      }

      let counterDiscount: number;
      let replyMessage: string;

      if (attemptCount === 0) {
        counterDiscount = 0.02;
        replyMessage = "That's a bit low. But I can do:";
      } else if (attemptCount === 1) {
        counterDiscount = 0.04;
        replyMessage = "We're getting closer. The best I can do is:";
      } else {
        counterDiscount = 0.05;
        replyMessage = 'This is my absolute final offer:';
      }

      const proposedCounter = Math.floor(currentPrice * (1 - counterDiscount));

      if (attemptCount >= NEGOTIATION_CHEAPER_BUTTON_THRESHOLD) {
        setStatus('upload');
        setMessage(
          "You're looking for a serious discount! Upload evidence of a lower price elsewhere and a merchant will review your request."
        );
      } else {
        setStatus('failed');
        setCounterOffer(proposedCounter);
        setMessage(replyMessage);
        setAttemptCount((prev) => prev + 1);
        triggerHaptic(Haptics?.ImpactFeedbackStyle?.Medium);
      }
    }, 1500);
  };

  const submitMerchantRequest = async (evidenceUrl?: string) => {
    if (!merchantId) {
      Alert.alert('Error', 'Unable to identify merchant. Please try again.');
      return;
    }

    setStatus('processing');
    const offerAmount =
      Number.parseFloat(offer.replace(/[^0-9.]/g, '')) || currentPrice * 0.9;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from('negotiation_requests').insert({
        merchant_id: merchantId,
        session_id: `mobile-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`}`,
        customer_id: user?.id ?? null,
        type,
        item_info:
          type === 'single'
            ? {
                id: itemId || productId,
                name: productName,
                current_price: currentPrice,
              }
            : null,
        offered_price: offerAmount,
        evidence_url: evidenceUrl || null,
        status: 'pending',
      });

      if (error) throw error;

      setStatus('submitted');
      setMessage(
        "Request submitted! We'll notify you as soon as the merchant reviews your offer."
      );
      triggerHaptic(Haptics?.ImpactFeedbackStyle?.Heavy);
    } catch (error) {
      log.error('Failed to submit request:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
      setStatus('upload');
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile && !uploadLink) {
      Alert.alert('Evidence Required', 'Please add a photo or link as proof.');
      return;
    }
    const evidence = uploadLink || uploadFile;
    await submitMerchantRequest(evidence ?? undefined);
  };

  const pickImage = async () => {
    if (!ImagePicker) {
      Alert.alert(
        'Not Supported',
        'Image picking is not supported on this platform.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadFile(result.assets[0].uri);
      triggerHaptic();
    }
  };

  const handleAcceptCounter = () => {
    if (!counterOffer) {
      return;
    }
    setStatus('success');
    setOffer(counterOffer.toString());
    setMessage(`Price updated: ${formatPrice(counterOffer)}`);
    triggerHaptic(Haptics?.ImpactFeedbackStyle?.Heavy);
    onSuccess(counterOffer);
  };

  return (
    <NegotiationModalView
      visible={visible}
      status={status}
      productName={productName}
      currentPrice={currentPrice}
      offer={offer}
      onOfferChange={setOffer}
      message={message}
      counterOffer={counterOffer}
      attemptCount={attemptCount}
      uploadFile={uploadFile}
      uploadLink={uploadLink}
      onUploadLinkChange={setUploadLink}
      onClose={onClose}
      onSubmitOffer={handleSubmitOffer}
      onAcceptCounter={handleAcceptCounter}
      onTryAgain={() => setStatus('input')}
      onOpenUpload={() => setStatus('upload')}
      onPickImage={pickImage}
      onBackFromUpload={() => setStatus('failed')}
      onUploadSubmit={handleUploadSubmit}
      onSuccessAction={onClose}
      successActionLabel="Done"
      successActionStyle="neutral"
      onSubmittedAction={onClose}
    />
  );
}

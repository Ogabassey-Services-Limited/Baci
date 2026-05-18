import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import type { ImpactFeedbackStyle } from 'expo-haptics';
import type { NegotiationStatus } from './NegotiationModalView';
import { NEGOTIATION_CHEAPER_BUTTON_THRESHOLD } from './negotiation.constants';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

const log = createLogger('NegotiationModal');
const NEGOTIATION_EVIDENCE_BUCKET = 'negotiation-evidence';

type NativeImagePicker = typeof import('expo-image-picker');
type NativeHaptics = typeof import('expo-haptics');

let imagePickerModule: NativeImagePicker | null = null;
let hapticsModule: NativeHaptics | null = null;
let nativeModulesPromise: Promise<void> | null = null;

const ensureNativeModules = () => {
  if (Platform.OS === 'web') {
    return Promise.resolve();
  }

  if (nativeModulesPromise) {
    return nativeModulesPromise;
  }

  nativeModulesPromise = Promise.all([
    import('expo-image-picker'),
    import('expo-haptics'),
  ])
    .then(([imagePicker, haptics]) => {
      imagePickerModule = imagePicker;
      hapticsModule = haptics;
    })
    .catch((error) => {
      console.debug(
        '[NegotiationModal] Native modules ignored or failed to load:',
        error
      );
    });

  return nativeModulesPromise;
};

void ensureNativeModules();

const createSessionId = () =>
  `mobile-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`}`;

const isRemoteEvidenceUrl = (value: string) => /^https?:\/\//i.test(value);

const extractFileExtension = (uri: string, contentType: string) => {
  const fromContentType = contentType.split('/')[1]?.split(';')[0];
  if (fromContentType) {
    return fromContentType;
  }

  const uriMatch = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return uriMatch?.[1] ?? 'jpg';
};

interface NegotiationItemInfo {
  currentPrice: number;
  id?: string;
  name: string;
}

interface UseNegotiationModalControllerParams {
  currentPrice: number;
  itemInfo: NegotiationItemInfo | null;
  merchantId: string | null;
  onAcceptedPrice?: (price: number) => void;
  successMessageFormatter: (price: number) => string;
  type: 'single' | 'total';
  visible: boolean;
}

export function useNegotiationModalController({
  currentPrice,
  itemInfo,
  merchantId,
  onAcceptedPrice,
  successMessageFormatter,
  type,
  visible,
}: UseNegotiationModalControllerParams) {
  const [offer, setOffer] = useState('');
  const [status, setStatus] = useState<NegotiationStatus>('input');
  const [message, setMessage] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  const [counterOffer, setCounterOffer] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<string | null>(null);
  const [uploadLink, setUploadLink] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }

    setOffer('');
    setStatus('input');
    setMessage('');
    setAttemptCount(0);
    setCounterOffer(null);
    setUploadFile(null);
    setUploadLink('');
  }, [visible]);

  const triggerHaptic = (style?: ImpactFeedbackStyle) => {
    if (Platform.OS !== 'ios' || !hapticsModule) {
      return;
    }

    hapticsModule
      .impactAsync(style ?? hapticsModule.ImpactFeedbackStyle.Light)
      .catch(() => {});
  };

  const handleSubmitOffer = (offerAmount: number) => {
    setStatus('processing');
    triggerHaptic(hapticsModule?.ImpactFeedbackStyle?.Medium);

    setTimeout(() => {
      const discountPercentage = 1 - offerAmount / currentPrice;

      if (discountPercentage <= 0.05) {
        setStatus('success');
        setOffer(offerAmount.toString());
        setMessage(successMessageFormatter(offerAmount));
        triggerHaptic(hapticsModule?.ImpactFeedbackStyle?.Heavy);
        onAcceptedPrice?.(offerAmount);
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
        setAttemptCount((previous) => previous + 1);
        triggerHaptic(hapticsModule?.ImpactFeedbackStyle?.Medium);
      }
    }, 1500);
  };

  const handleAcceptCounter = () => {
    if (!counterOffer) {
      return;
    }

    setStatus('success');
    setOffer(counterOffer.toString());
    setMessage(successMessageFormatter(counterOffer));
    triggerHaptic(hapticsModule?.ImpactFeedbackStyle?.Heavy);
    onAcceptedPrice?.(counterOffer);
  };

  const uploadEvidenceImage = async (fileUri: string) => {
    if (isRemoteEvidenceUrl(fileUri)) {
      return fileUri;
    }

    if (!merchantId) {
      throw new Error('Missing merchant id');
    }

    const response = await fetch(fileUri);
    if (!response.ok) {
      throw new Error(`Failed to read evidence file: ${response.status}`);
    }

    const blob = await response.blob();
    const extension = extractFileExtension(fileUri, blob.type);
    const filePath = `${merchantId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const body = await blob.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(NEGOTIATION_EVIDENCE_BUCKET)
      .upload(filePath, body, {
        contentType: blob.type || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(NEGOTIATION_EVIDENCE_BUCKET)
      .getPublicUrl(filePath);

    return data.publicUrl;
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
        session_id: createSessionId(),
        customer_id: user?.id ?? null,
        type,
        item_info:
          type === 'single' && itemInfo
            ? {
                id: itemInfo.id,
                name: itemInfo.name,
                current_price: itemInfo.currentPrice,
              }
            : null,
        offered_price: offerAmount,
        evidence_url: evidenceUrl || null,
        status: 'pending',
      });

      if (error) {
        throw error;
      }

      setStatus('submitted');
      setMessage(
        "Request submitted! We'll notify you as soon as the merchant reviews your offer."
      );
      triggerHaptic(hapticsModule?.ImpactFeedbackStyle?.Heavy);
    } catch (error) {
      log.error('Failed to submit request:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
      setStatus('upload');
    }
  };

  const handleUploadSubmit = async () => {
    const normalizedLink = uploadLink.trim();
    if (!uploadFile && !normalizedLink) {
      Alert.alert('Evidence Required', 'Please add a photo or link as proof.');
      return;
    }

    try {
      let evidenceUrl = normalizedLink;
      if (!evidenceUrl && uploadFile) {
        evidenceUrl = await uploadEvidenceImage(uploadFile);
      }
      await submitMerchantRequest(evidenceUrl || undefined);
    } catch (error) {
      log.error('Failed to upload negotiation evidence:', error);
      Alert.alert(
        'Upload failed',
        'Unable to upload evidence image. Please try again or use a link.'
      );
      setStatus('upload');
    }
  };

  const pickImage = async () => {
    await ensureNativeModules();

    if (!imagePickerModule) {
      Alert.alert(
        'Not Supported',
        'Image picking is not supported on this platform.'
      );
      return;
    }

    const result = await imagePickerModule.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadFile(result.assets[0].uri);
      triggerHaptic();
    }
  };

  return {
    attemptCount,
    backFromUpload: () => setStatus('failed'),
    counterOffer,
    handleAcceptCounter,
    handleSubmitOffer,
    handleUploadSubmit,
    message,
    offer,
    openUpload: () => setStatus('upload'),
    pickImage,
    resetToInput: () => setStatus('input'),
    setOffer,
    setUploadLink,
    status,
    uploadFile,
    uploadLink,
  };
}

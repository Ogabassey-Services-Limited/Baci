import type {
  MerchantTrustProfileDraft,
  MerchantTrustProfileReturnFee,
  MerchantTrustProfileReturnMethod,
  MerchantTrustProfileShippingFeeType,
  RegisteredAddress,
} from '@baci/shared';

export interface MerchantTrustProfileRouteLinks {
  about?: string;
  contact?: string;
  privacy?: string;
  terms?: string;
  faq?: string;
  returns?: string;
  shipping?: string;
  warranty?: string;
}

export interface MerchantTrustProfile {
  supportEmail?: string;
  supportPhone?: string;
  whatsappNumber?: string;
  socialLinks: Record<string, string>;
  businessAddress?: string;
  registeredAddress?: RegisteredAddress;
  legalEntityName?: string;
  taxIdentificationNumber?: string;
  foundedYear?: number;
  customerServiceHours?: {
    summary?: string;
    timezone?: string;
    responseTimeSummary?: string;
  };
  returnPolicy?: {
    summary?: string;
    windowDays?: number;
    returnMethod?: MerchantTrustProfileReturnMethod;
    returnFees?: MerchantTrustProfileReturnFee;
    localRoute: '/returns';
  };
  shippingPolicy?: {
    summary?: string;
    regions: string[];
    handlingDaysMin?: number;
    handlingDaysMax?: number;
    transitDaysMin?: number;
    transitDaysMax?: number;
    shippingFeeType?: MerchantTrustProfileShippingFeeType;
    localRoute: '/shipping';
  };
  warrantyPolicy?: {
    summary?: string;
    localRoute: '/warranty';
  };
  derivedLinks: MerchantTrustProfileRouteLinks;
}

export interface MerchantTrustProfileSource {
  support_email?: string | null;
  support_phone?: string | null;
  social_media?: Record<string, string | undefined> | null;
  business_address?: string | null;
  registered_address?: RegisteredAddress | null;
  legal_entity_name?: string | null;
  tax_identification_number?: string | null;
  about_page?: unknown;
  pages?: {
    about?: string | null;
    contact?: string | null;
    privacy?: string | null;
    terms?: string | null;
    faq?: string | null;
  } | null;
  trust_profile?: MerchantTrustProfileDraft | null;
}

import { NIGERIAN_STATES, type RegisteredAddress } from '@baci/shared';

interface AddressSignatureInput {
  merchantId: string | null;
  street: string;
  city: string;
  postalCode: string;
  stateCode: string;
}

interface MerchantAddressSyncInput {
  merchantId: string | null;
  merchantAddress: RegisteredAddress | null;
  merchantStateCode: string;
}

interface TaxSignatureInput {
  merchantId: string | null;
  vatRegistrationStatus: string;
  taxIdentificationNumber: string;
  legalEntityName: string;
}

export function buildAddressSyncSignature({
  merchantId,
  street,
  city,
  postalCode,
  stateCode,
}: AddressSignatureInput) {
  return [merchantId, street, city, postalCode, stateCode].join('|');
}

export function buildMerchantAddressSyncState({
  merchantId,
  merchantAddress,
  merchantStateCode,
}: MerchantAddressSyncInput) {
  const mappedStateCode =
    merchantStateCode ||
    NIGERIAN_STATES.find(
      (state) =>
        state.name.toLowerCase() ===
        (merchantAddress?.state ?? '').trim().toLowerCase()
    )?.code ||
    '';

  return {
    mappedStateCode,
    signature: buildAddressSyncSignature({
      merchantId,
      street: merchantAddress?.street ?? '',
      city: merchantAddress?.city ?? '',
      postalCode: merchantAddress?.postal_code ?? '',
      stateCode: mappedStateCode,
    }),
  };
}

export function buildTaxSyncSignature({
  merchantId,
  vatRegistrationStatus,
  taxIdentificationNumber,
  legalEntityName,
}: TaxSignatureInput) {
  return [
    merchantId,
    vatRegistrationStatus,
    taxIdentificationNumber,
    legalEntityName,
  ].join('|');
}

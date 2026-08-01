import {
  ATTESTATION_ISSUANCE_PENDING_SOURCES,
  ATTESTATION_PRIVACY_PENDING_SOURCES,
} from './expected-pending-attestation-privacy-source.test-support';
import { OPERATION_ID_PENDING_SOURCES } from './expected-pending-operation-id-source.test-support';

export const PRODUCT_PROVENANCE_PENDING_SOURCES = [
  ...OPERATION_ID_PENDING_SOURCES,
  ...ATTESTATION_PRIVACY_PENDING_SOURCES,
  ...ATTESTATION_ISSUANCE_PENDING_SOURCES,
] as const;

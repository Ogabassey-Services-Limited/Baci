/** Creates an externally verified read-token revocation dependency fixture. */
export function externalReadTokenRevocationDependencies(
  readTokenId: string,
  observedAt: string,
  providerReceiptSha256 = 'e'.repeat(64)
) {
  const revocationReceipt = {
    tokenId: readTokenId,
    status: 'revoked' as const,
    providerReceiptSha256,
    observedAt,
  };
  return {
    revocationReceipt,
    client: {
      readBack: async (tokenId: string) => ({
        tokenId,
        status: 'inactive' as const,
        auditReceiptSha256: revocationReceipt.providerReceiptSha256,
        observedAt: revocationReceipt.observedAt,
      }),
    },
  };
}

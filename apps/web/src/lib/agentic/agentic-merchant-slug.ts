import 'server-only';

function readNonBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/**
 * Reads the public copilot tenant selector without importing the mixed
 * credential-bearing env module into anonymous chat request graphs.
 */
export function getConfiguredAgenticMerchantSlug(): string | undefined {
  return (
    readNonBlank(process.env.BACI_AGENTIC_MERCHANT_SLUG) ??
    readNonBlank(process.env.OPENAI_AGENTIC_MERCHANT_SLUG)
  );
}

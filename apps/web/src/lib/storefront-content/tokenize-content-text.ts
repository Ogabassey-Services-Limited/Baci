import { applyJoinedTitleCorrections } from './apply-joined-title-corrections';
import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';

export function tokenizeContentText(value: string | null | undefined) {
  return normalizeContentCurrencyTokens(
    applyJoinedTitleCorrections(value ?? '')
  )
    .toLowerCase()
    .replace(/[’']s\b/gu, '')
    .replace(/\+/gu, ' plus ')
    .split(/[^a-z0-9]+/iu)
    .map((token) => token.trim())
    .filter(Boolean);
}

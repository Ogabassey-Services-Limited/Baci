import { applyJoinedTitleCorrections } from './apply-joined-title-corrections';
import { modelTokenMatchers } from './model-token-matchers';
import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';

export function tokenizeContentText(value: string | null | undefined) {
  return normalizeContentCurrencyTokens(
    applyJoinedTitleCorrections(value ?? '')
  )
    .toLowerCase()
    .replace(/[’']s\b/gu, '')
    .replace(/\+/gu, ' plus ')
    .split(/[^a-z0-9]+/iu)
    .flatMap((token) =>
      modelTokenMatchers.expandMixedGameCodeToken(token.trim())
    )
    .filter(Boolean);
}

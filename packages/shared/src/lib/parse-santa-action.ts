/**
 * Santa AI chat directive parsing.
 *
 * Santa replies can embed a machine-readable directive instructing the
 * storefront to add a (possibly negotiated) product to the cart:
 *
 *   ACTION:ADD_TO_CART|PRODUCT:<name>|PRICE:<amount>
 *
 * PRICE may contain thousands separators (e.g. 1,200,000). Shared between the
 * web and mobile storefronts so both parse the directive identically.
 */

export interface SantaAction {
  type: 'ADD_TO_CART';
  productName: string;
  price: number;
}

const SANTA_ACTION_PATTERN =
  /ACTION:ADD_TO_CART\|PRODUCT:([^|]+)\|PRICE:(\d+(?:,\d+)*)/;

/**
 * Parse an `ACTION:ADD_TO_CART|PRODUCT:xxx|PRICE:xxx` directive from Santa's
 * response. Returns the product name and numeric price, or null if no
 * (well-formed) directive is present.
 */
export function parseSantaAction(content: string): SantaAction | null {
  const match = content.match(SANTA_ACTION_PATTERN);
  if (!match) return null;

  return {
    type: 'ADD_TO_CART',
    productName: match[1].trim(),
    price: Number.parseInt(match[2].replace(/,/g, ''), 10),
  };
}

/**
 * Remove every Santa action directive from a response so the user-facing text
 * never shows the raw `ACTION:...` machinery.
 */
export function stripSantaActions(content: string): string {
  return content
    .replace(new RegExp(SANTA_ACTION_PATTERN.source, 'g'), '')
    .trim();
}

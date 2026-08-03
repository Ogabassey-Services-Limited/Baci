export function parseWishResult(response: string): {
  type: 'wish_granted' | 'wish_denied' | 'chat';
  productName?: string;
  approvedPrice?: number;
} {
  if (response.includes('ACTION:ADD_TO_CART')) {
    const productMatch = response.match(/PRODUCT:([^|]+)/);
    const priceMatch = response.match(/PRICE:([^|\s]+)/);

    return {
      type: 'wish_granted',
      productName: productMatch?.[1]?.trim(),
      approvedPrice: priceMatch?.[1]
        ? Number(priceMatch[1].replace(/[₦,N\s]/g, ''))
        : undefined,
    };
  }

  const isDenied =
    /budget.*below/i.test(response) ||
    /can't.*approve/i.test(response) ||
    /cannot.*grant/i.test(response) ||
    /workshop has costs/i.test(response) ||
    /save up/i.test(response) ||
    /payment plan/i.test(response);

  return { type: isDenied ? 'wish_denied' : 'chat' };
}

export const productQueryKeys = {
  detail(merchantId: string | undefined, productId: string) {
    return merchantId ? ['product', merchantId, productId] : ['product'];
  },
  list(merchantId?: string) {
    return merchantId ? ['products', merchantId] : ['products'];
  },
};

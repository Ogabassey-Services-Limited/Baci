[**nextn**](../../../README.md)

***

[nextn](../../../README.md) / [hooks/use-recently-viewed](../README.md) / useRecentlyViewed

# Function: useRecentlyViewed()

> **useRecentlyViewed**(`options`): `UseRecentlyViewedReturn`

Defined in: [src/hooks/use-recently-viewed.ts:82](https://github.com/Ogabassey-Services-Limited/Baci/blob/102b2153aa76346cf4b296ddba430e8263a41fa0/src/hooks/use-recently-viewed.ts#L82)

Hook for tracking recently viewed products

## Parameters

### options

`UseRecentlyViewedOptions` = `{}`

## Returns

`UseRecentlyViewedReturn`

## Examples

```ts
// In product detail page
function ProductPage({ product }: { product: Product }) {
  const { addToRecentlyViewed } = useRecentlyViewed();

  useEffect(() => {
    addToRecentlyViewed(product.id);
  }, [product.id, addToRecentlyViewed]);

  return <div>...</div>;
}
```

```ts
// In recently viewed section
function RecentlyViewedSection({ currentProductId }: { currentProductId?: string }) {
  const { recentlyViewedIds } = useRecentlyViewed({
    excludeProductId: currentProductId,
    maxItems: 6
  });

  // Fetch products by IDs and render...
}
```

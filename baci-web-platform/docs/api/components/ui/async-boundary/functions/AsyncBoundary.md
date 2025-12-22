[**nextn**](../../../../README.md)

***

[nextn](../../../../README.md) / [components/ui/async-boundary](../README.md) / AsyncBoundary

# Function: AsyncBoundary()

> **AsyncBoundary**(`__namedParameters`): `Element`

Defined in: src/components/ui/async-boundary.tsx:31

Reusable Suspense boundary for async content

Usage:
```tsx
<AsyncBoundary skeleton>
  <AsyncComponent />
</AsyncBoundary>

// Or with custom fallback
<AsyncBoundary fallback={<ProductGridSkeleton />}>
  <ProductGrid />
</AsyncBoundary>
```

## Parameters

### \_\_namedParameters

`AsyncBoundaryProps`

## Returns

`Element`

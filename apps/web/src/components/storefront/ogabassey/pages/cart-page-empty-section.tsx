import { CartEmptyState } from './cart-empty-state';

export function CartPageEmptySection({ basePath }: { basePath: string }) {
  return (
    <div className="flex-1 flex items-start justify-center pb-20">
      <CartEmptyState basePath={basePath} />
    </div>
  );
}

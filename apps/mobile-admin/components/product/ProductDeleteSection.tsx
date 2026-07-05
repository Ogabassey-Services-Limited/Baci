import { useRouter } from 'expo-router';
import type { ThemeColors } from '@/constants/theme';
import { useArchiveProduct } from '@/hooks/useArchiveProduct';
import { ProductDeleteCard } from './ProductDeleteCard';

interface ProductDeleteSectionProps {
  colors: Pick<
    ThemeColors,
    'border' | 'card' | 'error' | 'errorLight' | 'text' | 'textSecondary'
  >;
  productId: string;
  productName: string;
}

export function ProductDeleteSection({
  colors,
  productId,
  productName,
}: ProductDeleteSectionProps) {
  const router = useRouter();
  const archiveProduct = useArchiveProduct();

  return (
    <ProductDeleteCard
      colors={colors}
      disabled={archiveProduct.isPending}
      onConfirmDelete={async () => {
        await archiveProduct.mutateAsync({ productId });
        router.back();
      }}
      productName={productName}
    />
  );
}

import { MerchantProvider } from '@/hooks/use-merchant';
import { CategoryClient } from './category-client';

interface PageProps {
  params: Promise<{
    slug: string;
    category: string;
  }>;
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug, category } = await params;

  return (
    <MerchantProvider slug={slug}>
      <CategoryClient slug={slug} categoryName={category} />
    </MerchantProvider>
  );
}

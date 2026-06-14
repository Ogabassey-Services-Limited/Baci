import { useLocalSearchParams } from 'expo-router';
import { ProductDetailScreen } from '@/components/product/ProductDetailScreen';
import { getFirstRouteParamValue } from '@/components/product/product-detail-route-params';
import { useProduct } from '@/hooks';

export default function ProductDetailRoute() {
  const { slug } = useLocalSearchParams();
  const routeSlug = getFirstRouteParamValue(slug) ?? '';
  // Fetch the product at the route level and forward it into the screen as
  // props. The screen used to fetch its own product, which left this route
  // returning a zero-dependency `<ProductDetailScreen />` element that React
  // Compiler memoizes for the session — so the screen never re-rendered when
  // the product data changed. Forwarding the live product keeps the element
  // tied to the data and lets the screen re-render as the product loads or its
  // variants/images change.
  const productState = useProduct(routeSlug);

  return <ProductDetailScreen {...productState} />;
}

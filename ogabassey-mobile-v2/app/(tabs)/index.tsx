import { View, ScrollView, Text, ActivityIndicator, FlatList } from 'react-native';
import { useMerchant, useProducts } from '../../hooks/use-store';
import { Header } from '../../components/storefront/Header';
import { Hero } from '../../components/storefront/Hero';
import { UtilityPanel } from '../../components/storefront/UtilityPanel';
import { CategoryFilters } from '../../components/storefront/CategoryFilters';
import { ProductCard } from '../../components/storefront/ProductCard';
import { useState, useMemo } from 'react';

export default function HomeScreen() {
  // Filter State
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [selectedRating, setSelectedRating] = useState(0);

  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Data Hooks
  const { data: merchant, isLoading: isMerchantLoading } = useMerchant();

  // Fetch products with server-side filters and pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isProductsLoading
  } = useProducts(merchant?.id, {
    category: selectedCategory,
    brand: selectedBrand,
    condition: selectedCondition,
    minPrice,
    maxPrice,
    rating: selectedRating
  });

  const products = data?.pages.flat() || [];

  const handlePriceChange = (min: number, max: number) => {
    setMinPrice(min);
    setMaxPrice(max);
  };

  const isLoading = isMerchantLoading || isProductsLoading;

  // Construct dynamic section title
  const getSectionTitle = () => {
    const parts = [];
    if (selectedCategory !== 'All') parts.push(selectedCategory);
    if (selectedBrand !== 'All') parts.push(selectedBrand);

    return parts.length > 0 ? parts.join(' • ') : 'Top Deals';
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Header />

      <FlatList
        data={products}
        key={viewMode} // Force re-render when changing columns
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? { justifyContent: 'space-between', paddingHorizontal: 16 } : undefined}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}

        ListHeaderComponent={
          <>
            <Hero />
            <UtilityPanel />

            <CategoryFilters
              selectedCategory={selectedCategory}
              onSelectCategory={(cat) => {
                setSelectedCategory(cat);
              }}
              selectedBrand={selectedBrand}
              onSelectBrand={setSelectedBrand}
              selectedCondition={selectedCondition}
              onSelectCondition={setSelectedCondition}
              selectedRating={selectedRating}
              onSelectRating={setSelectedRating}
              minPrice={minPrice}
              maxPrice={maxPrice}
              onPriceChange={handlePriceChange}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />

            {/* Featured Section Header */}
            <View className="px-4 mt-4 mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-gray-900 font-serif">
                {getSectionTitle()}
              </Text>
              <Text className="text-gray-500 text-xs">
                {products.length} products
              </Text>
            </View>
          </>
        }

        renderItem={({ item: dbProduct }) => (
          <View className={viewMode === 'grid' ? 'w-[48%] mb-4' : 'mb-4 px-4'}>
            <ProductCard
              product={{
                id: dbProduct.id,
                title: dbProduct.name,
                slug: dbProduct.slug,
                price: dbProduct.price,
                originalPrice: dbProduct.compare_at_price || undefined,
                image: dbProduct.images?.[0] || 'https://via.placeholder.com/300',
                condition: dbProduct.condition || 'Brand New',
                rating: 4.8,
                reviews: 12,
                isCyberDeal: !!dbProduct.compare_at_price,
              }}
              viewMode={viewMode}
            />
          </View>
        )}

        ListEmptyComponent={
          isLoading ? (
            <View className="w-full py-12 items-center">
              <ActivityIndicator size="large" color="var(--primary)" />
            </View>
          ) : (
            <View className="w-full py-12 items-center">
              <Text className="text-gray-500 text-center text-base mb-2">No products found</Text>
              <Text className="text-gray-400 text-center text-sm">Try adjusting your filters</Text>
            </View>
          )
        }

        onEndReached={() => {
          if (hasNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="var(--primary)" />
            </View>
          ) : null
        }
      />
    </View>
  );
}

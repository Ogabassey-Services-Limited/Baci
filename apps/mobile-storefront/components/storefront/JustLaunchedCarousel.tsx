import {
  LAUNCH_CAROUSEL_LIMIT,
  launchCtaLabel,
  OGABASSEY_PINNED_LAUNCH_SLUGS,
  selectLaunchProducts,
} from '@baci/shared/storefront';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePinnedLaunchProducts } from '@/hooks/use-pinned-launch-products';
import { useProducts } from '@/hooks/use-products';
import { useTheme } from '@/hooks/useTheme';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import type { Product } from '@/types/product';

const SECTION_TITLE = 'Just Launched';
const CARD_HEIGHT = 168;
const BLURHASH = 'L6PZfSi_.AyE_3t7t7RjE1%MWBR*';

export function JustLaunchedCarousel() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  // Fetch window is wider than the display count so pins/newest are present.
  const {
    products: newest,
    isLoading,
    isError,
  } = useProducts({
    sortBy: 'newest',
    limit: 50,
  });
  const { data: pinned, isLoading: isPinnedLoading } = usePinnedLaunchProducts(
    OGABASSEY_PINNED_LAUNCH_SLUGS
  );

  // Drop any slug-less rows up front so a slide can never deep-link to
  // /product/undefined (selectLaunchProducts intentionally passes them through).
  const launchProducts = selectLaunchProducts(
    [...(pinned ?? []), ...newest].filter((product) => Boolean(product.slug)),
    { pinned: OGABASSEY_PINNED_LAUNCH_SLUGS, limit: LAUNCH_CAROUSEL_LIMIT }
  );

  if (isError) {
    return null;
  }

  const cardWidth = Math.round(width * 0.82);

  // Show a skeleton on first load (rather than a blank gap) for clearer loading
  // feedback; gate on BOTH queries so pinned items can't pop in after the
  // recent feed resolves first. Error and empty states still render nothing.
  if (isLoading || isPinnedLoading) {
    return (
      <View style={styles.container}>
        <Text
          accessibilityRole="header"
          style={[styles.heading, { color: colors.text }]}
        >
          {SECTION_TITLE}
        </Text>
        <View style={styles.list}>
          {[0, 1].map((key) => (
            <View
              key={key}
              style={[
                styles.card,
                {
                  width: cardWidth,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.imageWrap,
                  { backgroundColor: colors.background },
                ]}
              >
                <Skeleton width="100%" height={140} borderRadius={8} />
              </View>
              <View style={styles.info}>
                <Skeleton width="40%" height={10} />
                <Skeleton style={styles.skeletonGap} width="85%" height={16} />
                <Skeleton style={styles.skeletonGap} width="55%" height={14} />
                <Skeleton style={styles.skeletonGap} width="35%" height={13} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (launchProducts.length === 0) {
    return null;
  }

  const renderItem = ({ item }: { item: Product }) => {
    const imageUri = item.image || item.images?.[0];
    const ctaLabel = launchCtaLabel(item.name);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name} — ${ctaLabel}`}
        onPress={() => {
          if (item.slug) {
            router.push(`/product/${item.slug}`);
          }
        }}
        style={[
          styles.card,
          {
            width: cardWidth,
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View
          style={[styles.imageWrap, { backgroundColor: colors.background }]}
        >
          {imageUri ? (
            <Image
              accessibilityLabel={item.name}
              cachePolicy="memory-disk"
              contentFit="contain"
              placeholder={{ blurhash: BLURHASH }}
              source={{ uri: imageUri }}
              style={styles.image}
              transition={200}
            />
          ) : null}
        </View>
        <View style={styles.info}>
          <Text style={[styles.badge, { color: colors.primary }]}>
            {SECTION_TITLE}
          </Text>
          <Text numberOfLines={2} style={[styles.name, { color: colors.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.price, { color: colors.text }]}>
            {formatNgnCurrency(item.price)}
          </Text>
          <Text style={[styles.cta, { color: colors.primary }]}>
            {ctaLabel}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Text
        accessibilityRole="header"
        style={[styles.heading, { color: colors.text }]}
      >
        {SECTION_TITLE}
      </Text>
      <FlatList
        contentContainerStyle={styles.list}
        data={launchProducts}
        horizontal
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  list: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    height: CARD_HEIGHT,
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  imageWrap: {
    width: '42%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    padding: 14,
    justifyContent: 'center',
    gap: 2,
  },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
  },
  cta: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  skeletonGap: {
    marginTop: 6,
  },
});

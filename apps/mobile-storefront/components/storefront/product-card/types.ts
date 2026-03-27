import type { ImageProps } from 'expo-image';
import type { StyleProp, ViewStyle } from 'react-native';
import type { default as Colors } from '@/constants/Colors';
import type { Product } from '@/types/product';

export interface BaseProductCardVariantProps {
  product: Product;
  imageSource: { uri: string };
  imageProps: Omit<ImageProps, 'source' | 'style'>;
  showLocalPlaceholder: boolean;
  handlePress: () => void;
  handleAnimateIn: () => void;
  handleAnimateOut: () => void;
  handleWishlistPress: () => void;
  handleAddToCart: () => void;
  isSaved: boolean;
  cartItemCount: number;
  animatedStyle: StyleProp<ViewStyle>;
  heartAnimatedStyle: StyleProp<ViewStyle>;
}

export interface GridProductCardProps extends BaseProductCardVariantProps {
  gridWidth: number;
  shadowColor: string;
  colors?: Colors['light'];
}

export interface ListProductCardProps extends BaseProductCardVariantProps {
  colors?: Colors['light'];
}

export interface EditorialProductCardProps extends BaseProductCardVariantProps {
  textColor: string;
  screenWidth: number;
}

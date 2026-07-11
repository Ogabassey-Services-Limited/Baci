import { router } from 'expo-router';
import { Alert } from 'react-native';

// Stable module-scope references — no recreation on render
export const productKeyExtractor = (item: { id: string }) => item.id;
export const topSellingKeyExtractor = (item: { id: string }) => item.id;
export const categoryKeyExtractor = (item: { id: string }) => item.id;

export function handleProductPress(id: string): void {
  router.push(`/product/${id}`);
}

export function handleCategoryPress(_id: string): void {
  Alert.alert(
    'Coming Soon',
    'Category filtering will be available in a future update.'
  );
}

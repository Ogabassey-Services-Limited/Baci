import { useState } from 'react';
import { PRODUCT_GRID_MAX_PRICE_LIMIT } from './product-grid.constants';

export function useProductGridFilters() {
  const [selectedCategoryName, setSelectedCategoryName] = useState('All');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(PRODUCT_GRID_MAX_PRICE_LIMIT);
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [minRating, setMinRating] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategoryName(categoryName);
    setMinPrice(0);
    setMaxPrice(PRODUCT_GRID_MAX_PRICE_LIMIT);
    setSelectedBrand('All');
    setSelectedCondition('All');
    setMinRating(0);
  };

  const handlePriceChange = (min: number, max: number) => {
    setMinPrice(min);
    setMaxPrice(max);
  };

  return {
    handleCategorySelect,
    handlePriceChange,
    maxPrice,
    minPrice,
    minRating,
    selectedBrand,
    selectedCategoryName,
    selectedCondition,
    setMinRating,
    setSelectedBrand,
    setSelectedCondition,
    setViewMode,
    viewMode,
  };
}

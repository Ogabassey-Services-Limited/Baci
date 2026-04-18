'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';
import { buildOgabasseyProductSpecData } from '../product-spec-data';
import {
  normalizeProductCondition,
  type Product,
} from '../types';

/** Minimal shape returned by the storefront products search API */
interface SearchResultProduct {
    id: string | number;
    name: string;
    slug?: string;
    price: number;
    image?: string;
    imageLarge?: string;
    description?: string;
    rating?: number;
    category?: string;
    condition?: string;
    brand?: string;
    product_key_specs?: Product['product_key_specs'];
    specifications?: { category: string; items: { label: string; value: string }[] }[];
    variant_attributes?: Product['variant_attributes'];
}

interface ProductComparisonTableProps {
    mainProduct: Product;
    storeSlug?: string;
}

export function ProductComparisonTable({
    mainProduct,
    storeSlug,
}: ProductComparisonTableProps) {
    const [comparisonProducts, setComparisonProducts] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState<number | null>(null); // Index of slot being searched
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResultProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const merchantContext = useMerchantSafe();
    const basePath = merchantContext?.basePath || (storeSlug ? `/${storeSlug}` : '');

    // Helper to build product URL with proper basePath
    const getProductHref = (product: Product) => {
        const categorySlug = product.categorySlug || mainProduct.categorySlug || 'products';
        return asRoute(`${basePath}/${categorySlug}/${product.slug}`);
    };

    // Maximum 2 comparison slots + 1 main product = 3 columns
    const MAX_SLOTS = 2;

    // Search products API - filtered to SAME CATEGORY only (Koray SEO: no cross-category comparisons)
    useEffect(() => {
        const searchProducts = async () => {
            if (!query.trim() || query.length < 2) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                // Construct API URL - filter to same category for semantic relevance
                const categorySlug = mainProduct.categorySlug || mainProduct.category;
                const params = new URLSearchParams({
                    q: query,
                    limit: '5',
                });

                if (mainProduct.merchantId) {
                    params.append('merchant_id', mainProduct.merchantId);
                }

                // Filter to same category only - prevents cross-category comparisons
                if (categorySlug) {
                    params.append('category', categorySlug);
                }

                const res = await fetch(`/api/storefront/products?${params.toString()}`);
                const data = await res.json();

                // Filter out main product and already added products
                const filtered = (data.products || []).filter((p: SearchResultProduct) =>
                    String(p.id) !== String(mainProduct.id) &&
                    !comparisonProducts.some(cp => String(cp.id) === String(p.id))
                );

                setResults(filtered);
            } catch (err) {
                console.error('Search failed', err);
            } finally {
                setLoading(false);
            }
        };

        const timeout = setTimeout(searchProducts, 300);
        return () => clearTimeout(timeout);
    }, [query, mainProduct.id, mainProduct.merchantId, comparisonProducts]);

    const addProduct = (rawProduct: SearchResultProduct) => {
        const heroImage = rawProduct.imageLarge || rawProduct.image || '';
        const specData = buildOgabasseyProductSpecData({
            brand: rawProduct.brand,
            category: rawProduct.category,
            condition: rawProduct.condition,
            description: rawProduct.description,
            product_key_specs: rawProduct.product_key_specs,
            specifications: rawProduct.specifications,
            variant_attributes: rawProduct.variant_attributes,
        });
        const product: Product = {
            id: rawProduct.id,
            name: rawProduct.name,
            slug: rawProduct.slug,
            price: new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(rawProduct.price),
            rawPrice: rawProduct.price,
            image: heroImage,
            images: [heroImage],
            description: rawProduct.description || '',
            rating: rawProduct.rating || 0,
            category: rawProduct.category,
            condition: normalizeProductCondition(rawProduct.condition) || 'new',
            brand: rawProduct.brand,
            detailedSpecs: specData.detailedSpecs,
            specs: specData.specs,
        };

        setComparisonProducts(prev => [...prev, product]);
        setIsSearching(null);
        setQuery('');
        setResults([]);
    };

    const removeProduct = (index: number) => {
        setComparisonProducts(prev => prev.filter((_, i) => i !== index));
    };

    const mainProductSpecData = buildOgabasseyProductSpecData(mainProduct);
    const specCategories = mainProductSpecData.detailedSpecs || [];
    const summarySpecs = mainProductSpecData.specs || [];

    // Helper to find value in a product for a given category/label
    const findSpecValue = (product: Product, category: string, label: string) => {
        const cat = product.detailedSpecs?.find(c => c.category === category);
        if (!cat) return '-';
        const item = cat.items.find((i) => i.label === label);
        return item ? item.value : '-';
    };

    const getSummarySpecs = (product?: Product) =>
        product ? buildOgabasseyProductSpecData(product).specs : [];

    const renderSummaryColumn = (product?: Product) => {
        const items = product ? getSummarySpecs(product) : [];

        if (items.length === 0) {
            return <div className="p-4" />;
        }

        return (
            <div className="p-4 space-y-3">
                {items.map((item) => (
                    <div key={`${item.label}-${item.value}`} className="space-y-1.5">
                        <div className="text-xs text-gray-500">{item.label}</div>
                        <div className="font-semibold text-sm">{item.value}</div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="animate-in fade-in duration-300 overflow-x-auto pb-4">
            <div className="min-w-[800px] border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                {/* Header Row (Product Images & Names) */}
                <div className="grid grid-cols-4 border-b border-gray-200 bg-gray-50/50">
                    {/* Main Product */}
                    <div className="col-start-2 p-4 flex flex-col items-center justify-end h-56 border-r border-gray-100 relative bg-white">
                        <div className="absolute top-3 right-3">
                            <span className="bg-red-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                                Current
                            </span>
                        </div>
                        <div className="relative w-24 h-24 mb-3">
                            <Image
                                src={mainProduct.images?.[0] || mainProduct.image}
                                alt={mainProduct.name}
                                fill
                                sizes="96px"
                                className="object-contain"
                            />
                        </div>
                        <h3 className="font-bold text-sm text-center line-clamp-2 mb-1">{mainProduct.name}</h3>
                        <p className="text-red-600 font-bold text-sm">{mainProduct.price}</p>
                    </div>

                    {/* Comparison Slots */}
                    {[0, 1].map((slotIdx) => {
                        const product = comparisonProducts[slotIdx];
                        const isSlotSearching = isSearching === slotIdx;

                        return (
                            <div key={slotIdx} className="p-4 flex flex-col items-center justify-end h-56 border-r border-gray-100 last:border-0 relative bg-white">
                                {product ? (
                                    <>
                                        <button
                                            onClick={() => removeProduct(slotIdx)}
                                            className="absolute top-3 right-3 text-gray-400 hover:text-red-600 transition-colors"
                                            aria-label="Remove product"
                                        >
                                            <X size={16} />
                                        </button>
                                        <div className="relative w-24 h-24 mb-3">
                                            <Image
                                                src={product.images?.[0] || product.image}
                                                alt={product.name}
                                                fill
                                                sizes="96px"
                                                className="object-contain mix-blend-multiply"
                                            />
                                        </div>
                                        <Link
                                            href={getProductHref(product)}
                                            className="font-bold text-sm text-center line-clamp-2 mb-1 hover:text-red-600"
                                        >
                                            {product.name}
                                        </Link>
                                        <p className="text-gray-900 font-bold text-sm">{product.price}</p>
                                    </>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center">
                                        {isSlotSearching ? (
                                            <div className="w-full h-full absolute inset-0 bg-white z-10 p-4 flex flex-col">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-xs font-bold text-gray-500 uppercase">Add Product</span>
                                                    <button onClick={() => setIsSearching(null)} aria-label="Cancel search"><X size={16} /></button>
                                                </div>
                                                <div className="relative">
                                                    <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        placeholder="Type to search..."
                                                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                                                        value={query}
                                                        onChange={(e) => setQuery(e.target.value)}
                                                    />
                                                </div>

                                                {/* Results Dropdown */}
                                                <div className="flex-1 overflow-y-auto mt-2 -mx-2">
                                                    {loading && (
                                                        <div className="flex justify-center p-4 text-gray-400"><Loader2 className="animate-spin" size={20} /></div>
                                                    )}

                                                    {!loading && results.length > 0 && (
                                                        <div className="space-y-1">
                                                            {results.map(res => (
                                                                <button
                                                                    key={res.id}
                                                                    onClick={() => addProduct(res)}
                                                                    className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg text-left transition-colors"
                                                                >
                                                                    <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden relative">
                                                                        <Image src={res.image || res.imageLarge || '/placeholder.png'} alt={res.name} fill sizes="32px" className="object-cover" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="text-xs font-bold text-gray-900 truncate">{res.name}</div>
                                                                        <div className="text-[10px] text-gray-500 text-red-600">
                                                                            {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(res.price)}
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {!loading && query && results.length === 0 && (
                                                        <div className="p-4 text-center text-xs text-gray-400">No products found</div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setIsSearching(slotIdx);
                                                    setQuery('');
                                                    setResults([]);
                                                }}
                                                className="w-full h-full border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all gap-2"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-white">
                                                    <Plus size={20} />
                                                </div>
                                                <span className="text-xs font-bold uppercase tracking-wider text-center px-2">
                                                    Compare Similar {mainProduct.category || 'Products'}
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Specs Rows */}
                <div className="divide-y divide-gray-100">
                    {/* Key Specs Summary Row */}
                    <div className="grid grid-cols-4">
                        <div className="p-4 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
                            Key Specs
                        </div>
                        <div className="col-span-3 grid grid-cols-3 divide-x divide-gray-100">
                            {renderSummaryColumn({ ...mainProduct, specs: summarySpecs, detailedSpecs: specCategories })}
                            {renderSummaryColumn(comparisonProducts[0])}
                            {renderSummaryColumn(comparisonProducts[1])}
                        </div>
                    </div>

                    {/* Detailed Specs */}
                    {specCategories.map((category, catIdx) => (
                        <div key={catIdx}>
                            {/* Category Header */}
                            <div className="px-4 py-2 bg-gray-100/50 text-xs font-bold text-gray-900 uppercase tracking-widest border-y border-gray-200/50">
                                {category.category}
                            </div>

                            {/* Category Items */}
                            {category.items.map((item, itemIdx) => (
                                <div key={itemIdx} className="grid grid-cols-4 min-h-[48px] divide-x divide-gray-100 hover:bg-gray-50/50 transition-colors">
                                    <div className="p-3 text-xs font-bold text-gray-500 flex items-center pl-6">
                                        {item.label}
                                    </div>

                                    {/* Main Product Value */}
                                    <div className="p-3 text-sm text-gray-900 leading-snug flex items-center">
                                        {item.value}
                                    </div>

                                    {/* Comp 1 Value */}
                                    <div className="p-3 text-sm text-gray-600 leading-snug flex items-center">
                                        {comparisonProducts[0] ? findSpecValue(comparisonProducts[0], category.category, item.label) : ''}
                                    </div>

                                    {/* Comp 2 Value */}
                                    <div className="p-3 text-sm text-gray-600 leading-snug flex items-center">
                                        {comparisonProducts[1] ? findSpecValue(comparisonProducts[1], category.category, item.label) : ''}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}

                    {specCategories.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            No detailed specifications available for the main product.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, X, Image as ImageIcon, Wand2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CategoryConfig, CategoryVariantAttribute } from '@/lib/category-configs';
import type { ProductVariant } from '@/lib/products';
import Image from 'next/image';
import { useMerchant } from '@/hooks/use-merchant';
import { getCountryByCode } from '@/lib/countries';
import { FormDescription } from '../ui/form';
import { Switch } from '../ui/switch';
import { enhanceProductImage } from '@/ai/flows/enhance-product-images';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface VariantBuilderProps {
    categoryConfig: CategoryConfig;
    onVariantsChange: (variants: ProductVariant[]) => void;
    basePrice: number;
    initialVariants?: ProductVariant[];
}

interface AttributeSelection {
    [key: string]: string[];
}

export function VariantBuilder({
    categoryConfig,
    onVariantsChange,
    basePrice,
    initialVariants = []
}: VariantBuilderProps) {
    const { merchant } = useMerchant();
    const { toast } = useToast();
    const [attributeSelections, setAttributeSelections] = useState<AttributeSelection>({});
    const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);
    const variantsRef = useRef(variants);
    const [textInputs, setTextInputs] = useState<Record<string, string>>({});
    const [trackStock, setTrackStock] = useState(true);
    const [enhancingImages, setEnhancingImages] = useState<Record<string, boolean>>({});


    const currencySymbol = getCountryByCode(merchant?.country || 'NG')?.currencySymbol || '₦';

    // Update ref when variants change
    useEffect(() => {
        variantsRef.current = variants;
    }, [variants]);

    // Effect to handle AI suggestions
    useEffect(() => {
        const timer = setTimeout(() => {
            const aiSuggestionsRaw = sessionStorage.getItem('ai_variant_suggestions');
            if (aiSuggestionsRaw) {
                try {
                    const aiSuggestions: { attribute: string; options: string[] }[] = JSON.parse(aiSuggestionsRaw);
                    const newSelections: AttributeSelection = {};
                    aiSuggestions.forEach(suggestion => {
                        // Find attribute key case‑insensitively
                        const attrKey = categoryConfig.variantAttributes?.find(a => a.label.toLowerCase() === suggestion.attribute.toLowerCase())?.key;
                        if (attrKey) {
                            // For color attributes, store the first option (or all) as a string array
                            const attr = categoryConfig.variantAttributes?.find(a => a.key === attrKey);
                            if (attr?.type === 'color') {
                                // Keep up to 6 color options (avoid UI overload)
                                newSelections[attrKey] = suggestion.options.slice(0, 6);
                            } else {
                                newSelections[attrKey] = suggestion.options;
                            }
                        }
                    });
                    setAttributeSelections(newSelections);
                } catch (e) {
                    console.error('Failed to parse AI variant suggestions', e);
                } finally {
                    // Clean up immediately after use
                    sessionStorage.removeItem('ai_variant_suggestions');
                }
            }
        }, 50); // slight delay to ensure storage is set
        return () => clearTimeout(timer);
    }, [categoryConfig.variantAttributes]); // Dependency on categoryConfig to ensure keys can be mapped


    // Generate variant combinations whenever attribute selections change
    useEffect(() => {
        if (!categoryConfig.supportsVariants || !categoryConfig.variantAttributes) return;

        const combinations = generateVariantCombinations(attributeSelections, categoryConfig.variantAttributes);

        // Merge with existing variants to preserve images and overrides
        const merged = combinations.map(combo => {
            const existing = variantsRef.current.find(v =>
                JSON.stringify(v.attributes) === JSON.stringify(combo)
            );

            return existing || {
                id: `temp_${Date.now()}_${Math.random()}_${JSON.stringify(combo)}`,
                product_id: '',
                merchant_id: '',
                attributes: combo,
                stock_quantity: 0,
                images: [],
            };
        });

        setVariants(merged);
        onVariantsChange(merged);
    }, [attributeSelections, categoryConfig.supportsVariants, categoryConfig.variantAttributes, onVariantsChange]);

    // Helper to sort values numerically (for RAM, storage, etc.)
    const sortAttributeValues = (values: string[], attributeKey: string): string[] => {
        // Sort numerically for RAM, storage, and similar attributes
        if (['ram', 'storage', 'size', 'weight'].includes(attributeKey.toLowerCase())) {
            return [...values].sort((a, b) => {
                const numA = parseFloat(a);
                const numB = parseFloat(b);
                return numA - numB;
            });
        }
        return values;
    };

    const handleAttributeAdd = (attributeKey: string, value: string) => {
        if (!value) return;

        setAttributeSelections(prev => {
            // Prevent duplicate values
            const existing = prev[attributeKey] || [];
            if (existing.includes(value)) return prev;

            const newValues = [...existing, value];
            const sortedValues = sortAttributeValues(newValues, attributeKey);

            return {
                ...prev,
                [attributeKey]: sortedValues
            };
        });
    };

    const handleAttributeRemove = (attributeKey: string, value: string) => {
        setAttributeSelections(prev => ({
            ...prev,
            [attributeKey]: prev[attributeKey]?.filter(v => v !== value) || []
        }));
    };

    const handleVariantImageUpload = (color: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUri = reader.result as string;

            // Apply image to ALL variants with this color
            const updated = variants.map(v =>
                v.attributes.color === color
                    ? { ...v, primary_image: dataUri, images: [dataUri] }
                    : v
            );

            setVariants(updated);
            onVariantsChange(updated);
        };
        reader.readAsDataURL(file);
    };

    const handleEnhanceImage = async (color: string) => {
        const variantToEnhance = variants.find(v => v.attributes.color === color);
        if (!variantToEnhance?.primary_image) {
            toast({ title: 'No image to enhance', description: 'Please upload an image first.', variant: 'destructive' });
            return;
        }

        setEnhancingImages(prev => ({ ...prev, [color]: true }));
        try {
            const { enhancedPhotoDataUri } = await enhanceProductImage({ photoDataUri: variantToEnhance.primary_image });

            const updated = variants.map(v =>
                v.attributes.color === color
                    ? { ...v, primary_image: enhancedPhotoDataUri, images: [enhancedPhotoDataUri] }
                    : v
            );
            setVariants(updated);
            onVariantsChange(updated);
            toast({ title: 'Image enhanced!', description: 'The variant image has been updated with the enhanced version.' });
        } catch (error) {
            console.error('Enhancement failed:', error);
            toast({ title: 'Enhancement Failed', description: 'Could not enhance the image. Please try again.', variant: 'destructive' });
        } finally {
            setEnhancingImages(prev => ({ ...prev, [color]: false }));
        }
    };


    const updateVariant = (variantId: string, updates: Partial<ProductVariant>) => {
        const updated = variants.map(v =>
            v.id === variantId ? { ...v, ...updates } : v
        );
        setVariants(updated);
        onVariantsChange(updated);
    };

    const getPlaceholderForAttribute = (attr: CategoryVariantAttribute): string => {
        if (attr.options && attr.options.length > 0) {
            return `e.g., ${attr.options[0]}`;
        }
        switch (attr.type) {
            case 'color':
                return 'e.g., Black';
            case 'number':
                return `e.g., 42`;
            case 'text':
                if (attr.key === 'storage') return 'e.g., 256GB';
                if (attr.key === 'ram') return 'e.g., 8GB';
                return `Enter a value for ${attr.label}`;
            default:
                return 'Enter a value';
        }
    };

    if (!categoryConfig.supportsVariants) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Product Variants</CardTitle>
                <CardDescription>
                    Configure variants for this product based on {categoryConfig.displayName.toLowerCase()}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Attribute Selectors */}
                <div className="space-y-4">
                    <Label className="text-base font-semibold">Variant Attributes</Label>
                    {categoryConfig.variantAttributes?.map((attr) => (
                        <div key={attr.key} className="space-y-2">
                            <Label>{attr.label}{attr.required && ' *'}</Label>

                            <div className="flex gap-2">
                                {(
                                    <>
                                        <div className="flex-1 relative">
                                            {(attributeSelections[attr.key]?.length ?? 0) > 0 && (
                                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 z-10">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(attributeSelections[attr.key] || []).map((value) => (
                                                            <span key={value} className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 text-primary rounded-md text-sm flex-shrink-0">
                                                                {value}
                                                                <span role="button" aria-label={`Remove ${value}`} className="hover:bg-primary/20 rounded-full p-0.5 cursor-pointer inline-flex items-center" onClick={(e) => { e.stopPropagation(); handleAttributeRemove(attr.key, value); }}>
                                                                    <X className="h-3 w-3" />
                                                                </span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <Input
                                                type="text"
                                                placeholder={getPlaceholderForAttribute(attr)}
                                                value={textInputs[attr.key] ?? ''}
                                                onChange={(e) => setTextInputs(prev => ({ ...prev, [attr.key]: e.target.value }))}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        const value = textInputs[attr.key];
                                                        if (value) {
                                                            handleAttributeAdd(attr.key, value);
                                                            setTextInputs(prev => ({ ...prev, [attr.key]: '' }));
                                                        }
                                                    }
                                                }}
                                                className={cn("w-full", (attributeSelections[attr.key]?.length ?? 0) > 0 && "placeholder-transparent")}
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const value = textInputs[attr.key];
                                                if (value) {
                                                    handleAttributeAdd(attr.key, value);
                                                    setTextInputs(prev => ({ ...prev, [attr.key]: '' }));
                                                }
                                            }}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Generated Variants */}
                {variants.length > 0 && (() => {
                    // Helper to format text to Title Case
                    const toTitleCase = (text: string) => {
                        if (!text) return '';
                        return text.split(' ').map(word =>
                            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                        ).join(' ');
                    };

                    // Get unique colors and spec combinations
                    const colors = [...new Set(variants.map(v => v.attributes.color))].filter(Boolean);
                    const specCombos = variants.reduce((combos, variant) => {
                        const specs = Object.entries(variant.attributes)
                            .filter(([key]) => key !== 'color')
                            .map(([, value]) => value)
                            .join(' / ');
                        if (specs && !combos.find(c => c.label === specs)) {
                            const specAttrs = Object.fromEntries(
                                Object.entries(variant.attributes).filter(([key]) => key !== 'color')
                            );
                            combos.push({ label: specs, attributes: specAttrs });
                        }
                        return combos;
                    }, [] as Array<{ label: string; attributes: Record<string, string> }>);

                    return (
                        <div className="space-y-6">
                            <Label className="text-base font-semibold">
                                Configure variants ({variants.length} total)
                            </Label>

                            <Label
                                htmlFor="variants-stock-switch"
                                className="flex flex-row items-center justify-between rounded-lg border p-3 cursor-pointer"
                            >
                                <div className="space-y-0.5">
                                    <div className="font-medium">Track Inventory</div>
                                    <FormDescription>
                                        Enable to manage stock levels for each variant.
                                    </FormDescription>
                                </div>
                                <Switch
                                    id="variants-stock-switch"
                                    checked={trackStock}
                                    onCheckedChange={setTrackStock}
                                />
                            </Label>

                            {/* Section 1: Color Images */}
                            {colors.length > 0 && categoryConfig.variantAttributes?.some(attr => attr.key === 'color' && attr.hasImage) && (
                                <div className="space-y-3">
                                    <Label className="text-sm font-semibold">1. Upload color images</Label>
                                    <div className="grid grid-cols-4 gap-3">
                                        {colors.map(color => {
                                            const variantWithColor = variants.find(v => v.attributes.color === color);
                                            const isEnhancing = enhancingImages[color];
                                            return (
                                                <div key={color} className="relative group">
                                                    <div className="border-2 border-dashed rounded-lg p-3 hover:bg-muted/50 transition-colors space-y-2">
                                                        <label className="cursor-pointer block">
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={(e) => handleVariantImageUpload(color, e)}
                                                                disabled={isEnhancing}
                                                            />
                                                            <div className="aspect-square mb-2 rounded-lg overflow-hidden bg-muted flex items-center justify-center relative">
                                                                {isEnhancing && (
                                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                                                                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                                                                    </div>
                                                                )}
                                                                {variantWithColor?.primary_image ? (
                                                                    <Image
                                                                        src={variantWithColor.primary_image}
                                                                        alt={color}
                                                                        width={120}
                                                                        height={120}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                                                )}
                                                            </div>
                                                            <p className="text-sm font-medium text-center">{toTitleCase(color)}</p>
                                                        </label>
                                                        {variantWithColor?.primary_image && (
                                                            <Button
                                                                type="button"
                                                                variant="default"
                                                                size="sm"
                                                                className="w-full h-8"
                                                                onClick={() => handleEnhanceImage(color)}
                                                                disabled={isEnhancing}
                                                            >
                                                                {isEnhancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                                                                Enhance
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Section 2: Spec-based pricing */}
                            {specCombos.length > 0 && (
                                <div className="space-y-3">
                                    <Label className="text-sm font-semibold">
                                        2. Set prices for specifications ({specCombos.length} {specCombos.length === 1 ? 'option' : 'options'})
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Price applies to all colors with these specs. Leave blank to use base price.
                                    </p>
                                    <div className="space-y-2">
                                        {specCombos.map((combo, index) => {
                                            const variantWithSpec = variants.find(v =>
                                                Object.entries(combo.attributes).every(([key, value]) => v.attributes[key] === value)
                                            );
                                            return (
                                                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
                                                    <p className="flex-1 font-medium text-sm">{combo.label || 'Base variant'}</p>
                                                    <div className="w-40 relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                                                        <Input
                                                            type="text"
                                                            placeholder={new Intl.NumberFormat('en-US').format(basePrice)}
                                                            value={variantWithSpec?.price_override != null ? new Intl.NumberFormat('en-US').format(variantWithSpec.price_override) : ''}
                                                            onChange={(e) => {
                                                                const rawValue = e.target.value.replace(/,/g, '');
                                                                if (rawValue === '' || /^\d*\.?\d*$/.test(rawValue)) {
                                                                    const price = rawValue === '' ? undefined : Number(rawValue);
                                                                    const updated = variants.map(v =>
                                                                        Object.entries(combo.attributes).every(([key, value]) => v.attributes[key] === value)
                                                                            ? { ...v, price_override: price }
                                                                            : v
                                                                    );
                                                                    setVariants(updated);
                                                                    onVariantsChange(updated);
                                                                }
                                                            }}
                                                            className="h-9 text-sm pl-8"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Section 3: Inventory per variant */}
                            {trackStock && (
                                <div className="space-y-3">
                                    <Label className="text-sm font-semibold">3. Set stock quantity per variant</Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {variants.map((variant, index) => {
                                            const attributeOrder = ['ram', 'storage', 'color']; // Define your desired order
                                            const sortedAttributes = Object.entries(variant.attributes).sort(([keyA], [keyB]) => {
                                                const indexA = attributeOrder.indexOf(keyA.toLowerCase());
                                                const indexB = attributeOrder.indexOf(keyB.toLowerCase());
                                                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                                if (indexA !== -1) return -1;
                                                if (indexB !== -1) return 1;
                                                return 0; // Keep original order for other attributes
                                            });
                                            const displayLabel = sortedAttributes.map(([, value]) => value).join(' / ');
                                            
                                            return (
                                            <div
                                                key={variant.id || `variant-${index}`}
                                                className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                                            >
                                                <div className="w-10 h-10 rounded border overflow-hidden flex-shrink-0 bg-muted">
                                                    {variant.primary_image && (
                                                        <Image
                                                            src={variant.primary_image}
                                                            alt=""
                                                            width={40}
                                                            height={40}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    )}
                                                </div>
                                                <p className="flex-1 text-sm font-medium">
                                                    {displayLabel}
                                                </p>
                                                <div className="w-24">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        placeholder="Stock"
                                                        value={variant.stock_quantity || 0}
                                                        onChange={(e) =>
                                                            updateVariant(variant.id, {
                                                                stock_quantity: parseInt(e.target.value) || 0
                                                            })
                                                        }
                                                        className="h-9 text-sm"
                                                    />
                                                </div>
                                            </div>
                                        );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </CardContent>
        </Card >
    );
}

// Helper function to generate all variant combinations
function generateVariantCombinations(
    selections: AttributeSelection,
    _attributes: CategoryVariantAttribute[]
): Array<Record<string, string>> {
    const selectedAttrs = Object.entries(selections).filter(([, values]) => values.length > 0);

    if (selectedAttrs.length === 0) return [];

    // Start with the first attribute's values
    let combinations: Array<Record<string, string>> = selectedAttrs[0][1].map(value => ({
        [selectedAttrs[0][0]]: value
    }));

    // Cartesian product with remaining attributes
    for (let i = 1; i < selectedAttrs.length; i++) {
        const [key, values] = selectedAttrs[i];
        const newCombinations: Array<Record<string, string>> = [];

        for (const combo of combinations) {
            for (const value of values) {
                newCombinations.push({ ...combo, [key]: value });
            }
        }

        combinations = newCombinations;
    }

    return combinations;
}

    

    


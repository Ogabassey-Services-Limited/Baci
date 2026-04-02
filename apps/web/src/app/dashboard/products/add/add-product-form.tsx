'use client';

import { zodResolver } from '@hookform/resolvers/zod';
// @imgly/background-removal is dynamically imported at point of use to avoid bundling 2MB ONNX runtime
import { Image as ImageIcon, Loader2, Sparkles, Wand2 } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import z from 'zod';
import { autofillProductDetails } from '@/ai/flows/autofill-product-details';
import { enhanceProductImage } from '@/ai/flows/enhance-product-images';
import { generateProductDescription } from '@/ai/flows/generate-product-descriptions';
import { SeoPreview } from '@/components/products/seo-preview';
import { VariantBuilder } from '@/components/products/variant-builder';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileUploader } from '@/components/ui/file-uploader';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TagInput } from '@/components/ui/tag-input';
import { Textarea } from '@/components/ui/textarea';
import { getRootDomain } from '@/env';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { getCategoryConfigFromBusinessType } from '@/lib/category-configs';
import { getCountryByCode } from '@/lib/countries';
import type { Product, ProductVariant } from '@/lib/products';
import { generateSlug } from '@/lib/seo-utils';
import { uploadImage } from '@/lib/storage';

// Zod 4 + react-hook-form: use z.coerce for form inputs
const addProductSchema = z.object({
  name: z.string().min(3, 'Product name must be at least 3 characters.'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required.'),
  brand: z.string().optional(),

  // Pricing & Inventory - z.coerce handles string -> number conversion from form inputs
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  compare_at_price: z.coerce.number().optional(),
  cost_price: z.coerce.number().optional(),
  infinite_stock: z.boolean().optional(),
  stock: z.coerce.number().int().optional(),
  low_stock_threshold: z.coerce.number().int().optional(),
  minimum_order_quantity: z.coerce.number().int().min(1).optional(),
  sku: z.string().optional(),
  gtin: z.string().optional(),
  mpn: z.string().optional(),

  // Tax
  taxable: z.boolean().default(true),
  tax_code: z.string().optional(),

  // Shipping
  weight_value: z.coerce.number().optional(),
  weight_unit: z.enum(['kg', 'lb', 'g', 'oz']).default('kg'),
  dimensions: z
    .object({
      length: z.coerce.number().optional(),
      width: z.coerce.number().optional(),
      height: z.coerce.number().optional(),
      unit: z.enum(['cm', 'in', 'm']).default('cm'),
    })
    .optional(),

  // Media
  image: z.any().optional(), // Primary image
  images: z.array(z.any()).optional(), // Gallery images

  // Condition
  condition: z.enum(['new', 'used']).default('new'),
  condition_detail: z.string().optional(),

  // SEO
  slug: z.string().optional(),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
  keywords: z.string().optional(), // Comma separated string for input
  canonical_url: z.string().optional(),

  // Status
  status: z.enum(['draft', 'active', 'archived']).default('active'),

  // Variants & Fulfillment
  fulfillment_details: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    )
    .optional(),
  color: z.string().optional(),
  // Dynamic fields based on business type
  material: z.string().optional(),
  size_attribute: z.string().optional(), // Using size_attribute to avoid conflict with `size` prop in shadcn/ui
  specs: z.string().optional(),
  warranty: z.string().optional(),
});

// Zod 4 types for react-hook-form compatibility
type AddProductFormInput = z.input<typeof addProductSchema>;
type AddProductFormValues = z.output<typeof addProductSchema>;

interface AddProductFormProps {
  onProductAdded: (product: Product) => void;
  onCancel: () => void;
  initialData?: Product | null;
}

export default function AddProductForm({
  onProductAdded,
  onCancel,
  initialData,
}: AddProductFormProps) {
  const { toast } = useToast();
  const { merchant } = useMerchant();
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [hasVariants, setHasVariants] = useState(
    initialData?.has_variants || false
  );
  const [variants, setVariants] = useState<ProductVariant[]>(
    initialData?.variants || []
  );
  const [variantBuilderKey, setVariantBuilderKey] = useState(Date.now());
  const [colorTags, setColorTags] = useState<string[]>(
    initialData?.color
      ? initialData.color
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
  );
  const [colorImages, setColorImages] = useState<Record<string, string>>({});
  const [enhancingImages, setEnhancingImages] = useState<
    Record<string, boolean>
  >({});
  const [activeTab, setActiveTab] = useState('general');

  // Zod 4 + react-hook-form: specify input, context, and output types
  const form = useForm<AddProductFormInput, unknown, AddProductFormValues>({
    // biome-ignore lint/suspicious/noExplicitAny: library type mismatch
    resolver: zodResolver(addProductSchema as any),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      category:
        // biome-ignore lint/suspicious/noExplicitAny: Legacy Product type lacks categories join
        (initialData as any)?.categories?.name ||
        initialData?.category ||
        'General',
      brand: initialData?.brand || '',
      price: initialData?.price || 0,
      compare_at_price: initialData?.compare_at_price || 0,
      cost_price: initialData?.cost_price || 0,
      infinite_stock: initialData?.manage_stock === false,
      stock: initialData?.stock || 0,
      low_stock_threshold: initialData?.low_stock_threshold || 5,
      minimum_order_quantity: initialData?.minimum_order_quantity || 1,
      sku: initialData?.sku || '',
      gtin: initialData?.gtin || '',
      mpn: initialData?.mpn || '',
      taxable: initialData?.taxable ?? true,
      tax_code: initialData?.tax_code || '',
      weight_value: initialData?.weight_value || 0,
      weight_unit:
        (initialData?.weight_unit as 'kg' | 'lb' | 'g' | 'oz') || 'kg',
      dimensions: initialData?.dimensions || { unit: 'cm' },
      image: initialData?.image || null,
      images: initialData?.images?.map((img) => img.url) || [],
      condition: (initialData?.condition as 'new' | 'used') || 'new',
      condition_detail: initialData?.condition_detail || '',
      slug: initialData?.slug || '',
      meta_title: initialData?.meta_title || '',
      meta_description: initialData?.meta_description || '',
      keywords: initialData?.keywords?.join(', ') || '',
      canonical_url: initialData?.canonical_url || '',
      status:
        (initialData?.status as 'draft' | 'active' | 'archived') || 'active',
      fulfillment_details: initialData?.fulfillment_details || [],
      color: initialData?.color || '',
      material: initialData?.material || '',
      size_attribute: initialData?.size_attribute || '',
      specs: initialData?.specs || '',
      warranty: initialData?.warranty || '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'fulfillment_details',
  });

  const watchInfiniteStock = form.watch('infinite_stock');
  const watchStock = form.watch('stock');
  const watchName = form.watch('name');
  const watchCondition = form.watch('condition');

  // Auto-generate slug from name if slug is empty
  useEffect(() => {
    if (watchName && !form.getValues('slug')) {
      form.setValue('slug', generateSlug(watchName));
    }
  }, [watchName, form]);

  useEffect(() => {
    if (watchInfiniteStock) {
      if (fields.length > 0) remove();
      return;
    }

    const currentStock = Number.parseInt(String(watchStock || 0), 10);
    const currentFields = fields.length;

    if (currentStock > currentFields) {
      for (let i = 0; i < currentStock - currentFields; i++) {
        append({ key: 'S/N', value: '' });
      }
    } else if (currentStock < currentFields) {
      for (let i = currentFields - 1; i >= currentStock; i--) {
        remove(i);
      }
    }
  }, [watchStock, watchInfiniteStock, append, remove, fields.length]);

  // Initialize color images from initialData
  useEffect(() => {
    if (initialData?.image && initialData?.color) {
      // This is a simplification. In reality we'd need a map of color -> image
      // For now, if there's a color, we assume the main image belongs to it
      const colors = initialData.color.split(',').map((s) => s.trim());
      if (colors.length > 0) {
        setColorImages({ [colors[0]]: initialData.image });
      }
    }
  }, [initialData]);

  const categoryConfig = !merchant?.business_type
    ? getCategoryConfigFromBusinessType('general')
    : getCategoryConfigFromBusinessType(merchant.business_type);

  const handleColorImageUpload = (
    color: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUri = reader.result as string;
      setColorImages((prev) => ({ ...prev, [color]: dataUri }));
      if (colorTags.length > 0 && colorTags[0] === color) {
        form.setValue('image', dataUri);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddColorTag = (color: string) => {
    if (!color || colorTags.includes(color)) return;
    const newColorTags = [...colorTags, color];
    setColorTags(newColorTags);
    form.setValue('color', newColorTags.join(', '));
  };

  const handleRemoveColorTag = (color: string) => {
    const newColorTags = colorTags.filter((c) => c !== color);
    setColorTags(newColorTags);
    form.setValue('color', newColorTags.join(', '));
    setColorImages((prev) => {
      const updated = { ...prev };
      delete updated[color];
      return updated;
    });
    if (newColorTags.length > 0 && colorImages[newColorTags[0]]) {
      form.setValue('image', colorImages[newColorTags[0]]);
    } else {
      form.setValue('image', null);
    }
  };

  const handleAutofill = async () => {
    setIsAutofilling(true);
    const productName = form.getValues('name');
    if (!productName) {
      form.setError('name', { message: 'Please enter a product name first.' });
      setIsAutofilling(false);
      return;
    }

    if (!merchant) {
      toast({
        title: 'Could not autofill',
        description: 'Merchant data not available.',
        variant: 'destructive',
      });
      setIsAutofilling(false);
      return;
    }

    try {
      const result = await autofillProductDetails({
        productName: productName,
        businessType: merchant.business_type,
      });

      const { details, metadata } = result;
      if (details.suggestedName)
        form.setValue('name', details.suggestedName, { shouldValidate: true });
      if (details.description)
        form.setValue('description', details.description, {
          shouldValidate: true,
        });
      if (
        details.category &&
        categoryConfig.productCategories?.includes(details.category)
      ) {
        form.setValue('category', details.category, { shouldValidate: true });
      }
      if (details.brand)
        form.setValue('brand', details.brand, { shouldValidate: true });

      if (details.suggestedVariants && details.suggestedVariants.length > 0) {
        setHasVariants(true);
        sessionStorage.setItem(
          'ai_variant_suggestions',
          JSON.stringify(details.suggestedVariants)
        );
        setVariantBuilderKey(Date.now());
      }

      // Check for input truncation and notify user
      if (metadata?.inputTruncation) {
        const {
          productName: productNameTruncated,
          businessType: businessTypeTruncated,
        } = metadata.inputTruncation;

        if (productNameTruncated || businessTypeTruncated) {
          const truncatedFields = [];
          if (productNameTruncated)
            truncatedFields.push('Product name (200 chars)');
          if (businessTypeTruncated)
            truncatedFields.push('Business type (100 chars)');

          toast({
            title: 'Input Truncated',
            description: `${truncatedFields.join(' and ')} ${truncatedFields.length > 1 ? 'were' : 'was'} shortened for AI processing.`,
            variant: 'default',
          });
        }
      }

      toast({
        title: 'Product details autofilled! ✨',
        description: 'Review the generated details and adjust as needed.',
      });
    } catch (_error) {
      toast({
        title: 'Autofill Failed',
        description: 'Could not generate product details. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAutofilling(false);
    }
  };

  const handleGenerateDescription = async () => {
    setIsGenerating(true);
    const productName = form.getValues('name');
    if (!productName) {
      form.setError('name', { message: 'Please enter a product name first.' });
      setIsGenerating(false);
      return;
    }

    try {
      const result = await generateProductDescription({
        productName: productName,
        businessType: merchant?.business_type || 'general',
      });
      form.setValue('description', result.description);
    } catch (_error) {
      toast({
        title: 'Description Generation Failed',
        description: 'Could not generate a description. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Quick background removal (client-side, fast)
  const handleRemoveBackground = async (color: string) => {
    const imageToEnhance = colorImages[color];
    if (!imageToEnhance) {
      toast({
        title: 'No image to enhance',
        description: 'Please upload an image first.',
        variant: 'destructive',
      });
      return;
    }

    setEnhancingImages((prev) => ({ ...prev, [color]: true }));
    try {
      toast({
        title: 'Removing Background',
        description: 'This may take a moment...',
      });
      const { removeBackground } = await import('@imgly/background-removal');
      const blob = await removeBackground(imageToEnhance);
      const noBgUrl = URL.createObjectURL(blob);

      // Convert blob URL to data URL for storage
      const img = new window.Image();
      img.src = noBgUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setEnhancingImages((prev) => ({ ...prev, [color]: false }));
        return;
      }

      // Add white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const enhancedUrl = canvas.toDataURL('image/png');
      setColorImages((prev) => ({ ...prev, [color]: enhancedUrl }));
      if (colorTags.length > 0 && colorTags[0] === color) {
        form.setValue('image', enhancedUrl);
      }
      URL.revokeObjectURL(noBgUrl);
      toast({
        title: 'Background Removed',
        description: 'Image background has been removed.',
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Background Removal Failed',
        description: 'Could not remove background.',
        variant: 'destructive',
      });
    } finally {
      setEnhancingImages((prev) => ({ ...prev, [color]: false }));
    }
  };

  // AI-powered professional product image enhancement
  const handleEnhanceImage = async (color: string) => {
    const imageToEnhance = colorImages[color];
    if (!imageToEnhance) {
      toast({
        title: 'No image to enhance',
        description: 'Please upload an image first.',
        variant: 'destructive',
      });
      return;
    }

    setEnhancingImages((prev) => ({ ...prev, [color]: true }));
    try {
      toast({
        title: 'Enhancing with AI',
        description: 'Transforming into professional product photo...',
      });

      const result = await enhanceProductImage({
        photoDataUri: imageToEnhance,
      });

      setColorImages((prev) => ({
        ...prev,
        [color]: result.enhancedPhotoDataUri,
      }));
      if (colorTags.length > 0 && colorTags[0] === color) {
        form.setValue('image', result.enhancedPhotoDataUri);
      }
      toast({
        title: 'Image Enhanced',
        description: 'Your product image now looks professional!',
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Enhancement Failed',
        description:
          'Could not enhance image. Try again or use background removal.',
        variant: 'destructive',
      });
    } finally {
      setEnhancingImages((prev) => ({ ...prev, [color]: false }));
    }
  };

  async function onSubmit(data: AddProductFormValues) {
    setIsSaving(true);

    let enhancedImage = data.image;
    if (
      enhancedImage &&
      typeof enhancedImage === 'string' &&
      enhancedImage.startsWith('data:')
    ) {
      try {
        const uploadedUrl = await uploadImage(enhancedImage);
        if (uploadedUrl) enhancedImage = uploadedUrl;
      } catch (error) {
        console.error('Failed to upload image', error);
      }
    }

    // Handle Gallery Images
    const processedImages: string[] = [];
    if (data.images && data.images.length > 0) {
      for (const img of data.images) {
        if (img instanceof File) {
          try {
            const blobUrl = URL.createObjectURL(img);
            const uploadedUrl = await uploadImage(blobUrl);
            URL.revokeObjectURL(blobUrl);
            if (uploadedUrl) processedImages.push(uploadedUrl);
          } catch (error) {
            console.error('Failed to upload gallery image', error);
            toast({
              title: 'Upload Failed',
              description: `Failed to upload ${img.name}`,
              variant: 'destructive',
            });
          }
        } else if (typeof img === 'string') {
          processedImages.push(img);
        }
      }
    }

    const keywordsArray = data.keywords
      ? data.keywords
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
      : [];

    const productData: Product = {
      id: initialData?.id || `prod_${Date.now()}`,
      name: data.name,
      description: data.description || '',
      category: data.category,
      brand: data.brand || '',

      price: hasVariants ? 0 : data.price,
      compare_at_price: data.compare_at_price,
      cost_price: data.cost_price,

      manage_stock: hasVariants ? true : !data.infinite_stock,
      stock: hasVariants
        ? variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0)
        : data.infinite_stock
          ? 0
          : data.stock || 0,
      low_stock_threshold: data.low_stock_threshold,
      minimum_order_quantity: data.minimum_order_quantity,

      sku: data.sku || '',
      gtin: data.gtin || '',
      mpn: data.mpn || '',

      weight_value: data.weight_value,
      weight_unit: data.weight_unit,
      dimensions: data.dimensions,

      image: enhancedImage,
      imageLarge: enhancedImage,
      imageHint: data.name,
      images: processedImages.map((url, index) => ({
        url,
        alt: data.name,
        order: index,
      })),

      condition: data.condition,
      condition_detail: data.condition_detail,

      slug: data.slug || generateSlug(data.name),
      meta_title: data.meta_title,
      meta_description: data.meta_description,
      keywords: keywordsArray,
      canonical_url: data.canonical_url,

      status: data.status,
      taxable: data.taxable,
      tax_code: data.tax_code,

      fulfillment_details: hasVariants ? [] : data.fulfillment_details,
      has_variants: hasVariants,
      variants: hasVariants ? variants : [],
      color: data.color,
      material: data.material,
      size_attribute: data.size_attribute,
      specs: data.specs,
      warranty: data.warranty,
    };

    onProductAdded(productData);
    setIsSaving(false);
    toast({
      title: initialData ? 'Product Updated!' : 'Product Saved!',
      description: `${data.name} has been successfully ${initialData ? 'updated' : 'added'}.`,
    });
  }

  const country = merchant?.country
    ? getCountryByCode(merchant.country)
    : undefined;
  const currencySymbol = country?.currencySymbol || '₦';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="shipping">Shipping</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>

          <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* GENERAL TAB */}
            <TabsContent value="general" className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAutofill}
                      disabled={isAutofilling}
                      className="mt-2 w-full"
                    >
                      {isAutofilling ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="mr-2 h-4 w-4" />
                      )}
                      Autofill with AI
                    </Button>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value || ''}
                        onChange={field.onChange}
                        placeholder="Describe your product..."
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerateDescription}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Generate with AI
                    </Button>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoryConfig.productCategories?.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {categoryConfig.journey?.productCreation?.requiredFields?.map(
                (fieldKey) => {
                  // 'color' is already handled explicitly further down in the form
                  if (fieldKey === 'color') return null;

                  // Map 'size' to 'size_attribute' to match the schema
                  const formFieldName =
                    fieldKey === 'size' ? 'size_attribute' : fieldKey;
                  // Format label for display
                  const label =
                    fieldKey.charAt(0).toUpperCase() +
                    fieldKey.slice(1).replace(/[-_]/g, ' ');

                  // Check if the field exists in the form's schema to avoid errors
                  // Zod 4: Use Object.keys on the shape to get field names
                  const schemaKeys = Object.keys(addProductSchema.shape);
                  if (!schemaKeys.includes(formFieldName)) {
                    console.warn(
                      `Dynamic field "${fieldKey}" for business type "${merchant?.business_type || 'general'}" is not defined in addProductSchema. Skipping rendering.`
                    );
                    return null;
                  }

                  return (
                    <FormField
                      key={fieldKey}
                      control={form.control}
                      // biome-ignore lint/suspicious/noExplicitAny: Dynamic field names from business type config require any
                      name={formFieldName as any} // Cast as any due to dynamic field names
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  );
                }
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="used">Used</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="condition_detail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition Detail</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select detail" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {watchCondition === 'new' ? (
                            <>
                              <SelectItem value="Brand New">
                                Brand New
                              </SelectItem>
                              <SelectItem value="New Open Box">
                                New Open Box
                              </SelectItem>
                              <SelectItem value="New">New</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="Premium Used">
                                Premium Used
                              </SelectItem>
                              <SelectItem value="Used Open Box">
                                Used Open Box
                              </SelectItem>
                              <SelectItem value="Foreign Used">
                                Foreign Used
                              </SelectItem>
                              <SelectItem value="UK Used">UK Used</SelectItem>
                              <SelectItem value="Pre-owned">
                                Pre-owned
                              </SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            {/* PRICING TAB */}
            <TabsContent value="pricing" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            {currencySymbol}
                          </span>
                          <Input
                            type="number"
                            {...field}
                            value={(field.value as number | string) ?? ''}
                            className="pl-8"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="compare_at_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Compare At Price</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            {currencySymbol}
                          </span>
                          <Input
                            type="number"
                            {...field}
                            value={(field.value as number | string) ?? ''}
                            className="pl-8"
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        Original price (for sales)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cost_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost Price</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            {currencySymbol}
                          </span>
                          <Input
                            type="number"
                            {...field}
                            value={(field.value as number | string) ?? ''}
                            className="pl-8"
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        For profit tracking
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="taxable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Charge Tax</FormLabel>
                        <FormDescription>
                          Apply tax to this product
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tax_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. VAT-Standard" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">Inventory</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU (Stock Keeping Unit)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gtin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Barcode (GTIN/UPC/EAN)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {categoryConfig.supportsVariants && (
                  <FormItem className="mb-4">
                    <FormLabel className="flex flex-row items-center justify-between rounded-lg border p-3 cursor-pointer">
                      <div className="space-y-0.5">
                        <div className="font-medium">Product Variants</div>
                        <FormDescription>
                          Does this product have options like size, color?
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={hasVariants}
                          onCheckedChange={setHasVariants}
                        />
                      </FormControl>
                    </FormLabel>
                  </FormItem>
                )}

                {hasVariants && categoryConfig.supportsVariants ? (
                  <VariantBuilder
                    key={variantBuilderKey}
                    categoryConfig={categoryConfig}
                    basePrice={Number(form.watch('price')) || 0}
                    initialVariants={variants}
                    onVariantsChange={setVariants}
                  />
                ) : (
                  <>
                    <FormItem className="mb-4">
                      <FormLabel className="flex flex-row items-center justify-between rounded-lg border p-3 cursor-pointer">
                        <div className="space-y-0.5">
                          <div className="font-medium">Track Inventory</div>
                          <FormDescription>
                            Uncheck for unlimited stock (e.g. digital)
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={!watchInfiniteStock}
                            onCheckedChange={(c) =>
                              form.setValue('infinite_stock', !c)
                            }
                          />
                        </FormControl>
                      </FormLabel>
                    </FormItem>

                    {!watchInfiniteStock && (
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="stock"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  value={(field.value as number | string) ?? ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="low_stock_threshold"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Low Stock Alert</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  value={(field.value as number | string) ?? ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="minimum_order_quantity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Min Order Qty</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  {...field}
                                  value={(field.value as number | string) ?? ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            {/* MEDIA TAB */}
            <TabsContent value="media" className="space-y-4">
              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Gallery</FormLabel>
                    <FormControl>
                      <FileUploader
                        onFilesSelected={field.onChange}
                        initialFiles={
                          field.value?.filter(
                            (f: unknown) => typeof f === 'string'
                          ) || []
                        }
                        maxFiles={5}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={() => (
                  <FormItem>
                    <FormLabel>Colors & Images</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <TagInput
                              placeholder="Black, Red, Blue"
                              value={colorTags}
                              onChange={(tags) => {
                                // Handle adding/removing tags
                                const newTags = tags.filter(
                                  (t) => !colorTags.includes(t)
                                );
                                const removedTags = colorTags.filter(
                                  (t) => !tags.includes(t)
                                );

                                newTags.forEach((tag) => {
                                  handleAddColorTag(tag);
                                });
                                removedTags.forEach((tag) => {
                                  handleRemoveColorTag(tag);
                                });
                              }}
                            />
                          </div>
                        </div>

                        {colorTags.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {colorTags.map((color) => (
                              <Card key={color} className="p-3">
                                <div className="text-sm font-medium mb-2 flex items-center justify-between">
                                  <span>{color}</span>
                                  {enhancingImages[color] && (
                                    <Sparkles className="h-3 w-3 text-yellow-500 animate-pulse" />
                                  )}
                                </div>
                                <div className="aspect-square relative rounded-md overflow-hidden bg-muted border group">
                                  {colorImages[color] ? (
                                    <>
                                      <Image
                                        src={colorImages[color]}
                                        alt={color}
                                        fill
                                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
                                        className="object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          className="h-7 text-xs"
                                          onClick={() =>
                                            handleEnhanceImage(color)
                                          }
                                          disabled={enhancingImages[color]}
                                          title="AI transforms your photo into a professional product image"
                                        >
                                          <Sparkles className="h-3 w-3 mr-1" />
                                          AI Enhance
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          className="h-7 text-xs"
                                          onClick={() =>
                                            handleRemoveBackground(color)
                                          }
                                          disabled={enhancingImages[color]}
                                          title="Quick background removal"
                                        >
                                          <Wand2 className="h-3 w-3 mr-1" />
                                          Remove BG
                                        </Button>
                                        <label className="cursor-pointer">
                                          <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="h-7 text-xs pointer-events-none"
                                          >
                                            Change
                                          </Button>
                                          <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) =>
                                              handleColorImageUpload(color, e)
                                            }
                                          />
                                        </label>
                                      </div>
                                    </>
                                  ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-muted/80 transition-colors">
                                      <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                                      <span className="text-xs text-muted-foreground">
                                        Upload
                                      </span>
                                      <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) =>
                                          handleColorImageUpload(color, e)
                                        }
                                      />
                                    </label>
                                  )}
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            {/* SHIPPING TAB */}
            <TabsContent value="shipping" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="weight_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            value={(field.value as number | string) ?? ''}
                          />
                        </FormControl>
                        <Select
                          value={form.watch('weight_unit')}
                          onValueChange={(val) =>
                            form.setValue(
                              'weight_unit',
                              val as 'kg' | 'g' | 'lb' | 'oz'
                            )
                          }
                        >
                          <SelectTrigger className="w-[80px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="lb">lb</SelectItem>
                            <SelectItem value="g">g</SelectItem>
                            <SelectItem value="oz">oz</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <FormLabel>Dimensions (L x W x H)</FormLabel>
                <div className="flex gap-2 items-end">
                  <FormField
                    control={form.control}
                    name="dimensions.length"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Length"
                            {...field}
                            value={(field.value as number | string) ?? ''}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <span className="pb-2 text-muted-foreground">x</span>
                  <FormField
                    control={form.control}
                    name="dimensions.width"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Width"
                            {...field}
                            value={(field.value as number | string) ?? ''}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <span className="pb-2 text-muted-foreground">x</span>
                  <FormField
                    control={form.control}
                    name="dimensions.height"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Height"
                            {...field}
                            value={(field.value as number | string) ?? ''}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dimensions.unit"
                    render={({ field }) => (
                      <FormItem className="w-[80px]">
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cm">cm</SelectItem>
                            <SelectItem value="in">in</SelectItem>
                            <SelectItem value="m">m</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </TabsContent>

            {/* SEO TAB */}
            <TabsContent value="seo" className="space-y-4">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL Slug</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="product-name-slug" />
                        </FormControl>
                        <FormDescription>
                          The URL-friendly version of the name.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="meta_title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meta Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="SEO Title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="meta_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meta Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Brief description for search engines"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="keywords"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Keywords</FormLabel>
                        <FormControl>
                          <TagInput
                            placeholder="keyword1, keyword2"
                            value={
                              field.value
                                ? field.value
                                    .split(',')
                                    .map((k: string) => k.trim())
                                    .filter(Boolean)
                                : []
                            }
                            onChange={(tags) => field.onChange(tags.join(', '))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="space-y-4">
                  <SeoPreview
                    title={form.watch('meta_title') || form.watch('name') || ''}
                    description={
                      form.watch('meta_description') ||
                      form.watch('description') ||
                      ''
                    }
                    slug={form.watch('slug') || ''}
                    merchantUrl={
                      merchant?.slug
                        ? `${merchant.slug}.${getRootDomain()}`
                        : undefined
                    }
                  />
                </div>
              </div>
            </TabsContent>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData ? 'Update Product' : 'Save Product'}
            </Button>
          </div>
        </Tabs>
      </form>
    </Form>
  );
}

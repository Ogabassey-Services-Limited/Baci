
'use client';

import { useState, useMemo, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import Image from 'next/image';
import { Loader2, Sparkles, Upload, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { generateProductDescription } from '@/ai/flows/generate-product-descriptions';
import { autofillProductDetails } from '@/ai/flows/autofill-product-details';
import { enhanceProductImage } from '@/ai/flows/enhance-product-images';
import { useMerchant } from '@/hooks/use-merchant';
import { removeBackground } from '@imgly/background-removal';

import { getCountryByCode } from '@/lib/countries';
import type { Product } from '@/lib/products';
import { uploadImage } from '@/lib/storage';
import { getCategoryConfigFromBusinessType } from '@/lib/category-configs';
import { VariantBuilder } from '@/components/products/variant-builder';
import type { ProductVariant } from '@/lib/products';

const addProductSchema = z.object({
  name: z.string().min(3, 'Product name must be at least 3 characters.'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  infinite_stock: z.boolean().optional(),
  stock: z.coerce.number().int('Stock must be a whole number.').optional(),
  minimum_order_quantity: z.coerce.number().int('MOQ must be a whole number.').min(1, 'Minimum order quantity must be at least 1.').optional(),
  category: z.string().min(1, 'Category is required.'),
  brand: z.string().optional(),
  fulfillment_details: z.array(z.object({
    key: z.string(),
    value: z.string()
  })).optional(),
  image: z.any().refine((file) => file, 'Product image is required.'),
  color: z.string().optional(),
});

type AddProductFormValues = z.infer<typeof addProductSchema>;

interface AddProductFormProps {
  onProductAdded: (product: Product) => void;
  onCancel: () => void;
  initialData?: Product | null;
}

export default function AddProductForm({ onProductAdded, onCancel, initialData }: AddProductFormProps) {
  const { toast } = useToast();
  const { merchant } = useMerchant();
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image || null);
  const [hasVariants, setHasVariants] = useState(initialData?.has_variants || false);
  const [variants, setVariants] = useState<ProductVariant[]>(initialData?.variants || []);
  const [variantBuilderKey, setVariantBuilderKey] = useState(Date.now()); // Key to force re-render

  const form = useForm<AddProductFormValues>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      price: initialData?.price || 0,
      infinite_stock: true, // Default to off
      stock: initialData?.stock || 0,
      minimum_order_quantity: initialData?.minimum_order_quantity || 1,
      category: initialData?.category || 'General',
      brand: initialData?.brand || '',
      fulfillment_details: initialData?.fulfillment_details || [],
      image: initialData?.image || null,
      color: initialData?.color || '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "fulfillment_details"
  });

  const watchInfiniteStock = form.watch("infinite_stock");
  const watchStock = form.watch("stock");

  useEffect(() => {
    if (watchInfiniteStock) {
      if (fields.length > 0) remove();
      return;
    }

    const currentStock = parseInt(String(watchStock || 0));
    const currentFields = fields.length;

    if (currentStock > currentFields) {
      for (let i = 0; i < currentStock - currentFields; i++) {
        append({ key: 'S/N', value: '' });
      }
    } else if (currentStock < currentFields) {
      for (let i = 0; i < currentFields - 1 - i; i++) {
        remove(currentFields - 1 - i);
      }
    }
  }, [watchStock, watchInfiniteStock, append, remove, fields.length]);

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        description: initialData.description,
        price: initialData.price,
        infinite_stock: initialData.manage_stock === false,
        stock: initialData.stock,
        minimum_order_quantity: initialData.minimum_order_quantity || 1,
        category: initialData.category || 'General',
        brand: initialData.brand,
        fulfillment_details: initialData.fulfillment_details || [],
        image: initialData.image,
        color: initialData.color,
      });
      setHasVariants(initialData.has_variants || false);
      setVariants(initialData.variants || []);
      setImagePreview(initialData.image || null);
    }
  }, [initialData, form]);

  const categoryConfig = useMemo(() => {
    if (!merchant?.business_type) return getCategoryConfigFromBusinessType('general');
    return getCategoryConfigFromBusinessType(merchant.business_type);
  }, [merchant?.business_type]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        setImagePreview(dataUri);
        form.setValue('image', dataUri);
      };
      reader.readAsDataURL(file);
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
      toast({ title: "Could not autofill", description: "Merchant data not available.", variant: "destructive" });
      setIsAutofilling(false);
      return;
    }

    try {
      const result = await autofillProductDetails({
        productName: productName,
        businessType: merchant.business_type,
      });

      const { details } = result;
      if (details.suggestedName) form.setValue('name', details.suggestedName, { shouldValidate: true });
      if (details.description) form.setValue('description', details.description, { shouldValidate: true });
      if (details.category && categoryConfig.productCategories?.includes(details.category)) {
        form.setValue('category', details.category, { shouldValidate: true });
      }
      if (details.brand) form.setValue('brand', details.brand, { shouldValidate: true });

      // Handle suggested variants
      if (details.suggestedVariants && details.suggestedVariants.length > 0) {
        setHasVariants(true);
        const _newInitialVariants = details.suggestedVariants.map((sv: { attribute: string; options: string[] }) => ({
          attributes: { [sv.attribute.toLowerCase()]: '' }, // placeholder
        }));

        // This is a bit of a hack to pass suggestions to the variant builder
        // We trigger a re-render of the builder with new initial data
        // The builder itself needs to be able to handle this.
        sessionStorage.setItem('ai_variant_suggestions', JSON.stringify(details.suggestedVariants));
        setVariantBuilderKey(Date.now()); // Force re-mount of VariantBuilder
      }


      toast({
        title: "Product details autofilled! ✨",
        description: "Review the generated details and adjust as needed.",
      });

    } catch (_error) {
      toast({ title: "Autofill Failed", description: "Could not generate product details. Please try again.", variant: "destructive" });
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

    if (!merchant) {
      toast({ title: "Could not generate description", description: "Merchant data not available.", variant: "destructive" });
      setIsGenerating(false);
      return;
    }

    try {
      const result = await generateProductDescription({
        productName: productName,
        businessType: merchant.business_type,
      });
      form.setValue('description', result.description);
    } catch (_error) {
      toast({ title: "Description Generation Failed", description: "Could not generate a description. Please try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEnhanceImage = async () => {
    if (!imagePreview) return;

    setIsGenerating(true);
    try {
      toast({ title: "Enhancing Image", description: "Removing background and adjusting lighting... This may take a moment." });

      // 1. Remove Background
      const blob = await removeBackground(imagePreview);
      const noBgUrl = URL.createObjectURL(blob);

      // 2. Adjust Lighting (Brightness/Contrast)
      const img = new window.Image();
      img.src = noBgUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Apply simple brightness/contrast
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const contrast = 1.1; // 10% more contrast
      const brightness = 10; // Add 10 to RGB

      const intercept = 128 * (1 - contrast);

      for (let i = 0; i < data.length; i += 4) {
        // Only adjust non-transparent pixels
        if (data[i + 3] > 0) {
          data[i] = data[i] * contrast + intercept + brightness;     // R
          data[i + 1] = data[i + 1] * contrast + intercept + brightness; // G
          data[i + 2] = data[i + 2] * contrast + intercept + brightness; // B
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const enhancedUrl = canvas.toDataURL('image/png');

      setImagePreview(enhancedUrl);
      form.setValue('image', enhancedUrl);
      toast({ title: "Image Enhanced", description: "Background removed and lighting adjusted." });

    } catch (e) {
      console.error(e);
      toast({ title: "Enhancement Failed", description: "Could not enhance image.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  async function onSubmit(data: AddProductFormValues) {
    setIsSaving(true);

    let enhancedImage = data.image;
    // Server-side enhancement removed as per user request/issues.
    // We now rely on the client-side "Enhance" button.

    if (enhancedImage && typeof enhancedImage === 'string' && enhancedImage.startsWith('data:')) {
      try {
        const uploadedUrl = await uploadImage(enhancedImage);
        if (uploadedUrl) {
          enhancedImage = uploadedUrl;
        } else {
          console.error("Failed to upload image to storage");
          toast({ title: 'Image Upload Failed', description: 'Could not upload image to storage.', variant: 'destructive' });
        }
      } catch (error) {
        console.error("Failed to upload image to storage", error);
        toast({ title: 'Image Upload Failed', description: 'Could not upload image to storage.', variant: 'destructive' });
      }
    }

    const productData: Product = {
      id: initialData?.id || `prod_${Date.now()}`,
      name: data.name,
      description: data.description || '',
      price: hasVariants ? 0 : data.price,
      manage_stock: hasVariants ? true : !data.infinite_stock,
      stock: hasVariants
        ? variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0)
        : (data.infinite_stock ? 0 : data.stock || 0),
      minimum_order_quantity: data.minimum_order_quantity,
      status: initialData?.status || 'published',
      image: enhancedImage,
      imageLarge: enhancedImage,
      imageHint: data.name,
      brand: data.brand || '',
      gtin: initialData?.gtin || '',
      mpn: initialData?.mpn || '',
      fulfillment_details: hasVariants ? [] : data.fulfillment_details,
      has_variants: hasVariants,
      variants: hasVariants ? variants : [],
      category: data.category,
      color: data.color,
    };

    onProductAdded(productData);

    setIsSaving(false);
    toast({
      title: initialData ? 'Product Updated!' : 'Product Saved!',
      description: `${data.name} has been successfully ${initialData ? 'updated' : 'added'}.`,
    });
  }

  const currencySymbol = useMemo(() => {
    const country = merchant?.country ? getCountryByCode(merchant.country) : undefined;
    return country?.currencySymbol || '₦';
  }, [merchant?.country]);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-6">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <Button type="button" variant="outline" size="sm" onClick={handleAutofill} disabled={isAutofilling} className="mt-2 w-full">
                {isAutofilling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Autofill with AI
              </Button>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl><Textarea {...field} className="min-h-[100px]" /></FormControl>
              <Button type="button" variant="ghost" size="sm" onClick={handleGenerateDescription} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate with AI
              </Button>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem>
              <FormLabel>Category *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
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
          )} />

          {categoryConfig.supportsVariants && (
            <FormItem>
              <FormLabel
                htmlFor="variants-switch"
                className="flex flex-row items-center justify-between rounded-lg border p-3 cursor-pointer"
              >
                <div className="space-y-0.5">
                  <div className="font-medium">Product Variants</div>
                  <FormDescription>
                    Does this product have options like size, color, or storage?
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    id="variants-switch"
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
              basePrice={form.watch('price')}
              initialVariants={variants}
              onVariantsChange={setVariants}
            />
          ) : (
            <>
              <FormField control={form.control} name="price" render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormLabel>Price *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                      <Input
                        type="text"
                        placeholder="0.00"
                        {...field}
                        className="pl-8"
                        value={value ? new Intl.NumberFormat('en-US').format(value) : ''}
                        onChange={(e) => {
                          const rawValue = e.target.value.replace(/,/g, '');
                          if (rawValue === '' || /^\d*\.?\d*$/.test(rawValue)) {
                            onChange(rawValue === '' ? 0 : Number(rawValue));
                          }
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormItem>
                <FormLabel
                  htmlFor="stock-switch"
                  className="flex flex-row items-center justify-between rounded-lg border p-3 cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <div className="font-medium">Track Inventory</div>
                    <FormDescription>Uncheck if you have unlimited stock (e.g. digital products).</FormDescription>
                  </div>
                  <FormField control={form.control} name="infinite_stock" render={({ field }) => (
                    <FormControl>
                      <Switch
                        id="stock-switch"
                        checked={!field.value}
                        onCheckedChange={(checked) => field.onChange(!checked)}
                      />
                    </FormControl>
                  )} />
                </FormLabel>
              </FormItem>

              {!watchInfiniteStock && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="stock" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock Quantity *</FormLabel>
                      <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="minimum_order_quantity" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Order Qty</FormLabel>
                      <FormControl><Input type="number" min="1" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}
            </>
          )}

          <FormField control={form.control} name="brand" render={({ field }) => (
            <FormItem>
              <FormLabel>Brand</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />



          <FormField control={form.control} name="image" render={() => (
            <FormItem>
              <FormLabel>Images</FormLabel>
              <FormControl>
                <div className="space-y-4">
                  <div className="grid h-64 w-full items-center justify-center rounded-md border border-dashed relative bg-muted/10">
                    {imagePreview ? (
                      <Image
                        alt="Product image preview"
                        className="aspect-square w-full h-full rounded-md object-contain p-4"
                        fill
                        src={imagePreview}
                      />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <Upload className="h-8 w-8 mx-auto" />
                        <p className="text-sm mt-1">Upload one or more images for your product.</p>
                      </div>
                    )}
                    <Input id="image-upload" type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" onChange={handleImageUpload} />
                  </div>

                  {imagePreview && (
                    <div className="flex gap-4 items-end">
                      <FormField control={form.control} name="color" render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Color</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Red, Blue" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />

                      <Button type="button" variant="secondary" onClick={handleEnhanceImage} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Enhance Image
                      </Button>
                    </div>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? 'Update Product' : 'Save Product'}
          </Button>
        </div>
      </form>
    </Form>
  );
}


'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import Image from 'next/image';
import { Loader2, Sparkles, Upload, Info, Wand2 } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  infinite_stock: z.boolean().default(false),
  stock: z.coerce.number().int('Stock must be a whole number.').optional(),
  category: z.string().min(1, 'Category is required.'),
  brand: z.string().optional(),
  fulfillment_details: z.array(z.object({
    key: z.string(),
    value: z.string()
  })).optional(),
  image: z.any().refine((file) => file, 'Product image is required.'),
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

  const form = useForm<AddProductFormValues>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      price: initialData?.price || 0,
      infinite_stock: initialData?.manage_stock === false,
      stock: initialData?.stock || 0,
      category: initialData?.category || 'General',
      brand: initialData?.brand || '',
      fulfillment_details: initialData?.fulfillment_details || [],
      image: initialData?.image || null,
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
      for (let i = 0; i < currentFields - currentStock; i++) {
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
        category: initialData.category || 'General',
        brand: initialData.brand,
        fulfillment_details: initialData.fulfillment_details || [],
        image: initialData.image,
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
        currencyCode: getCountryByCode(merchant.country || 'NG')?.currency || 'NGN',
        existingCategories: categoryConfig.productCategories || [],
      });
      
      const { details } = result;
      if (details.description) form.setValue('description', details.description, { shouldValidate: true });
      if (details.price) form.setValue('price', details.price, { shouldValidate: true });
      if (details.category && categoryConfig.productCategories?.includes(details.category)) {
        form.setValue('category', details.category, { shouldValidate: true });
      }
      if (details.brand) form.setValue('brand', details.brand, { shouldValidate: true });

      toast({
        title: "Product details autofilled! ✨",
        description: "Review the generated details and adjust as needed.",
      });

    } catch (error) {
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
    } catch (error) {
      toast({ title: "Description Generation Failed", description: "Could not generate a description. Please try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  async function onSubmit(data: AddProductFormValues) {
    setIsSaving(true);
    
    let enhancedImage = data.image;
    if (data.image && typeof data.image === 'string' && data.image.startsWith('data:')) {
      try {
        const { enhancedPhotoDataUri } = await enhanceProductImage({ photoDataUri: data.image });
        enhancedImage = enhancedPhotoDataUri;
      } catch (error) {
        toast({ title: 'AI enhancement failed', description: 'Could not enhance image, using original.', variant: 'destructive' });
      }
    }

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
      price: data.price,
      manage_stock: hasVariants ? true : !data.infinite_stock,
      stock: hasVariants
        ? variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0)
        : (data.infinite_stock ? 0 : data.stock || 0),
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
              <div className="flex gap-2">
                <FormControl><Input {...field} /></FormControl>
                <Button type="button" variant="outline" size="sm" onClick={handleAutofill} disabled={isAutofilling}>
                  {isAutofilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap ml-2">Autofill with AI</span>
                </Button>
              </div>
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
             <FormLabel
                htmlFor="variants-switch"
                className="flex flex-row items-center justify-between rounded-lg border p-3 bg-muted/50 cursor-pointer"
             >
              <div className="space-y-0.5">
                <div className="font-medium">Product Variants</div>
                <FormDescription>
                  Does this product have options like size, color, or storage?
                </FormDescription>
              </div>
              <Switch
                id="variants-switch"
                checked={hasVariants}
                onCheckedChange={setHasVariants}
              />
            </FormLabel>
          )}

          {hasVariants && categoryConfig.supportsVariants ? (
            <VariantBuilder
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
              <FormField control={form.control} name="infinite_stock" render={({ field }) => (
                <FormItem>
                   <FormLabel
                        htmlFor="stock-switch"
                        className="flex flex-row items-center justify-between rounded-lg border p-3 cursor-pointer"
                    >
                        <div className="space-y-0.5">
                            <div className="font-medium">Manage Stock</div>
                            <FormDescription>Turn on to track inventory quantity.</FormDescription>
                        </div>
                        <FormControl>
                            <Switch
                            id="stock-switch"
                            checked={!field.value}
                            onCheckedChange={(checked) => field.onChange(!checked)}
                            />
                        </FormControl>
                    </FormLabel>
                </FormItem>
              )} />

              {!watchInfiniteStock && (
                <FormField control={form.control} name="stock" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock *</FormLabel>
                    <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
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
                <div className="grid h-32 w-full items-center justify-center rounded-md border border-dashed relative">
                  {imagePreview ? (
                    <Image
                      alt="Product image preview"
                      className="aspect-square w-full rounded-md object-contain"
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

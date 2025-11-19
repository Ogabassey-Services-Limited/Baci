
'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Image from 'next/image';
import { Loader2, Sparkles, Upload, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { generateProductDescription } from '@/ai/flows/generate-product-descriptions';
import { enhanceProductImage } from '@/ai/flows/enhance-product-images';
import { useMerchant } from '@/hooks/use-merchant';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getCountryByCode } from '@/lib/countries';
import type { Product } from '@/lib/products';

const addProductSchema = z.object({
  name: z.string().min(3, 'Product name must be at least 3 characters.'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  infinite_stock: z.boolean().default(false),
  stock: z.coerce.number().int('Stock must be a whole number.').optional(),
  category: z.string().min(1, 'Category is required.'),
  brand: z.string().optional(),
  fulfillment_details: z.string().optional(),
  image: z.any().refine((file) => file, 'Product image is required.'),
});

type AddProductFormValues = z.infer<typeof addProductSchema>;

interface AddProductFormProps {
  onProductAdded: (product: Product) => void;
  onCancel: () => void;
}

export default function AddProductForm({ onProductAdded, onCancel }: AddProductFormProps) {
  const { toast } = useToast();
  const { merchant } = useMerchant();
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<AddProductFormValues>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      infinite_stock: false,
      stock: 0,
      category: '',
      brand: '',
      fulfillment_details: '',
      image: null,
    },
  });

  const watchInfiniteStock = form.watch("infinite_stock");

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
        productDetails: `A new product named ${productName}.`,
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
    
    // Simulate AI enhancement if an image is present
    let enhancedImage = data.image;
    if (data.image) {
        try {
            const { enhancedPhotoDataUri } = await enhanceProductImage({ photoDataUri: data.image });
            enhancedImage = enhancedPhotoDataUri;
        } catch (error) {
            toast({ title: 'AI enhancement failed', description: 'Could not enhance image, using original.', variant: 'destructive'});
        }
    }
    
    // Create a new product object
    const newProduct: Product = {
        id: `prod_${Date.now()}`,
        name: data.name,
        description: data.description || '',
        price: data.price,
        manage_stock: !data.infinite_stock,
        stock: data.infinite_stock ? 0 : data.stock || 0,
        status: 'published', // Default to published for simplicity
        image: enhancedImage,
        imageLarge: enhancedImage, // Use same for now
        imageHint: data.name,
        brand: data.brand || '',
        gtin: '',
        mpn: '',
    };
    
    onProductAdded(newProduct);
    
    setIsSaving(false);
    toast({
      title: 'Product Saved!',
      description: `${data.name} has been successfully added.`,
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
                    <FormMessage />
                </FormItem>
            )} />
            
            <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea {...field} className="min-h-[100px]" /></FormControl>
                    <Button type="button" variant="ghost" size="sm" onClick={handleGenerateDescription} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                        Generate with AI
                    </Button>
                    <FormMessage />
                </FormItem>
            )} />

            <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                    <FormLabel>Price *</FormLabel>
                    <FormControl>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencySymbol}</span>
                            <Input type="number" placeholder="0.00" {...field} className="pl-8"/>
                        </div>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )} />

            <FormField control={form.control} name="infinite_stock" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                        <FormLabel>Infinite Stock</FormLabel>
                        <FormDescription>This product has unlimited stock.</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
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

            <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            
            <FormField control={form.control} name="brand" render={({ field }) => (
                <FormItem>
                    <FormLabel>Brand</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            
            <FormField control={form.control} name="fulfillment_details" render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center gap-1">
                        Fulfillment Details
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-3 w-3 text-muted-foreground"/>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Enter comma-separated values for fulfillment, e.g., IMEI, Serial Number.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </FormLabel>
                    <FormControl><Input placeholder="e.g. IMEI, Serial Number" {...field} /></FormControl>
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
            )}/>

        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Product
          </Button>
        </div>
      </form>
    </Form>
  );
}

'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, Sparkles, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { generateProductDescription } from '@/ai/flows/generate-product-descriptions';
import { enhanceProductImage } from '@/ai/flows/enhance-product-images';
import { useMerchant } from '@/hooks/use-merchant';

const addProductSchema = z.object({
  name: z.string().min(3, 'Product name must be at least 3 characters.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  stock: z.coerce.number().int('Stock must be a whole number.'),
  status: z.enum(['draft', 'active']),
  image: z.any().refine((file) => file, 'Product image is required.'),
  brand: z.string().optional(),
  gtin: z.string().optional(),
  mpn: z.string().optional(),
});

type AddProductFormValues = z.infer<typeof addProductSchema>;

export default function AddProductForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { merchant, loading: merchantLoading } = useMerchant();
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [showEnhanced, setShowEnhanced] = useState(false);

  const form = useForm<AddProductFormValues>({
    resolver: zodResolver(addProductSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      stock: 0,
      status: 'active',
      image: null,
      brand: '',
      gtin: '',
      mpn: '',
    },
  });

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        setOriginalImage(dataUri);
        form.setValue('image', dataUri);
        setShowEnhanced(false);
        setEnhancedImage(null);
        
        setIsEnhancing(true);
        try {
          const { enhancedPhotoDataUri } = await enhanceProductImage({ photoDataUri: dataUri });
          setEnhancedImage(enhancedPhotoDataUri);
          setShowEnhanced(true); 
        } catch (error) {
          console.error("Failed to enhance image:", error);
          toast({
            title: "Image Enhancement Failed",
            description: "Could not enhance the product image. Please try again.",
            variant: "destructive"
          });
          setEnhancedImage(null); 
        } finally {
          setIsEnhancing(false);
        }
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
        toast({
            title: "Could not generate description",
            description: "Merchant data not loaded yet. Please try again in a moment.",
            variant: "destructive"
        });
        setIsGenerating(false);
        return;
    }

    try {
      const result = await generateProductDescription({
        productName: productName,
        businessType: merchant.businessType, 
        productDetails: `A new product named ${productName}.`,
      });
      form.setValue('description', result.description);
    } catch (error) {
      console.error('Failed to generate description:', error);
       toast({
          title: "Description Generation Failed",
          description: "Could not generate a description. Please try again.",
          variant: "destructive"
        });
    } finally {
      setIsGenerating(false);
    }
  };

  async function onSubmit(data: AddProductFormValues) {
    setIsSaving(true);
    console.log(data);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSaving(false);
    toast({
      title: 'Product Saved!',
      description: `${data.name} has been successfully added to your store.`,
    });
    router.push('/dashboard/products');
  }

  const imageToDisplay = showEnhanced ? enhancedImage : originalImage;
  
  if (merchantLoading) {
      return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8"
      >
        <div className="mx-auto grid max-w-[59rem] flex-1 auto-rows-max gap-4">
          <div className="grid gap-4 md:grid-cols-[1fr_250px] lg:grid-cols-3 lg:gap-8">
            <div className="grid auto-rows-max items-start gap-4 lg:col-span-2 lg:gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Product Details</CardTitle>
                  <CardDescription>
                    Fill in the details for your new product.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Handmade Ceramic Mug" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                            <FormLabel>Description</FormLabel>
                            <Button type="button" variant="outline" size="sm" onClick={handleGenerateDescription} disabled={isGenerating}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4" />}
                                Generate with AI
                            </Button>
                        </div>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your product..."
                            className="min-h-32"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pricing & Inventory</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="stock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Google Merchant Center</CardTitle>
                  <CardDescription>
                    These fields help sync your product with Google Shopping.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="brand"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Baci" {...field} />
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
                          <FormLabel>GTIN</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 12-digit UPC" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name="mpn"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MPN</FormLabel>
                          <FormControl>
                            <Input placeholder="Manufacturer Part #" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="grid auto-rows-max items-start gap-4 lg:gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Product Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                          </SelectContent>
                        </Select>
                         <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Product Image</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    <div className="grid h-48 w-full items-center justify-center rounded-md border border-dashed relative">
                      {imageToDisplay ? (
                        <Image
                          alt="Product image"
                          className="aspect-square w-full rounded-md object-cover"
                          fill
                          src={imageToDisplay}
                        />
                      ) : (
                         <Upload className="h-8 w-8 text-muted-foreground" />
                      )}
                       <Input id="image-upload" type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" onChange={handleImageUpload} />
                    </div>
                     <div className="mt-2 flex items-center space-x-2">
                      <Switch id="enhance-switch" checked={showEnhanced} onCheckedChange={setShowEnhanced} disabled={!enhancedImage || isEnhancing} />
                      <FormLabel htmlFor="enhance-switch">AI Enhanced</FormLabel>
                      {isEnhancing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                  </div>
                   <FormField
                    control={form.control}
                    name="image"
                    render={() => (
                      <FormItem>
                         <FormMessage className='mt-2'/>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 md:hidden">
            <Button variant="outline" size="sm">
              Discard
            </Button>
            <Button size="sm" type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Product
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

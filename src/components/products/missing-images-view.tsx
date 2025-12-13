'use client';

import { useState } from 'react';
import { useProductContext } from '@/contexts/product-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, ImageOff, CheckCircle2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AIStudio } from './ai-studio';

export function MissingImagesView() {
    const { products, updateProduct } = useProductContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

    // Filter products missing images
    const missingImages = products.filter(
        (p) => !p.image || p.image === '' || p.image.includes('placeholder')
    );

    const filtered = missingImages.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleImageSuccess = (url: string) => {
        if (selectedProduct) {
            updateProduct(selectedProduct, { image: url });
            setSelectedProduct(null);
        }
    };

    const getProduct = (id: string) => products.find((p) => p.id === id);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Camera className="w-6 h-6 text-primary" />
                        Missing Images Studio
                    </h2>
                    <p className="text-muted-foreground">
                        {missingImages.length} products need photos. Snap a picture and AI will fix the background instantly.
                    </p>
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search products..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {missingImages.length === 0 ? (
                <div className="text-center py-20 bg-muted/10 rounded-xl border border-dashed">
                    <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
                    <h3 className="text-xl font-semibold">All Done!</h3>
                    <p className="text-muted-foreground">Every product has an image. Great job!</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filtered.map((product) => (
                        <Card key={product.id} className="overflow-hidden group hover:shadow-md transition-all">
                            <div className="aspect-square bg-muted flex flex-col items-center justify-center p-4 text-center relative">
                                <ImageOff className="w-8 h-8 text-muted-foreground/30 mb-2" />
                                <span className="text-xs text-muted-foreground">No Image</span>

                                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Button
                                        size="sm"
                                        className="shadow-lg"
                                        onClick={() => setSelectedProduct(product.id)}
                                    >
                                        <Camera className="w-4 h-4 mr-2" />
                                        Snap
                                    </Button>
                                </div>
                            </div>
                            <CardContent className="p-3">
                                <div className="flex justify-between items-start gap-2">
                                    <h3 className="font-medium text-sm line-clamp-2" title={product.name}>
                                        {product.name}
                                    </h3>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{product.sku || 'No SKU'}</span>
                                    <Badge variant="outline" className="text-[10px] h-5">
                                        {product.category || 'Uncategorized'}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {selectedProduct && (
                <AIStudio
                    isOpen={!!selectedProduct}
                    onClose={() => setSelectedProduct(null)}
                    onSuccess={handleImageSuccess}
                    productName={getProduct(selectedProduct)?.name || 'Product'}
                />
            )}
        </div>
    );
}

// In a real app, this data would come from a database.
// We are defining it here to be shared across the app.

export interface Product {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'draft' | 'archived';
    price: number;
    stock: number;
    image: string;
    imageLarge: string;
    imageHint: string;
    brand: string;
    gtin: string;
    mpn: string;
}

export const products: Product[] = [
    {
        id: 'p1',
        name: 'Ceramic Mug Set',
        description: 'A beautiful set of two handmade ceramic mugs, perfect for your morning coffee. Each mug is unique and crafted with care.',
        status: 'active',
        price: 49.99,
        stock: 120,
        image: 'https://picsum.photos/seed/p1/80/80',
        imageLarge: 'https://picsum.photos/seed/p1/600/400',
        imageHint: 'ceramic mug',
        brand: 'Baci Artisan',
        gtin: '123456789012',
        mpn: 'CM-SET-01'
    },
    {
        id: 'p2',
        name: 'Minimalist Desk Lamp',
        description: 'A sleek and modern desk lamp with adjustable brightness. Fits any workspace and provides perfect lighting.',
        status: 'active',
        price: 79.99,
        stock: 75,
        image: 'https://picsum.photos/seed/p2/80/80',
        imageLarge: 'https://picsum.photos/seed/p2/600/400',
        imageHint: 'desk lamp',
        brand: 'Baci Lighting',
        gtin: '123456789013',
        mpn: 'DL-MIN-02'
    },
    {
        id: 'p3',
        name: 'Organic Cotton Towels',
        description: 'Set of 3 soft and absorbent towels made from 100% organic cotton. Gentle on your skin and the environment.',
        status: 'archived',
        price: 35.00,
        stock: 0,
        image: 'https://picsum.photos/seed/p3/80/80',
        imageLarge: 'https://picsum.photos/seed/p3/600/400',
        imageHint: 'cotton towels',
        brand: 'Baci Home',
        gtin: '123456789014',
        mpn: 'TOW-ORG-03'
    },
    {
        id: 'p4',
        name: 'Smart Water Bottle',
        description: 'A water bottle that tracks your intake and reminds you to stay hydrated throughout the day. Connects to your phone.',
        status: 'draft',
        price: 89.99,
        stock: 30,
        image: 'https://picsum.photos/seed/p4/80/80',
        imageLarge: 'https://picsum.photos/seed/p4/600/400',
        imageHint: 'water bottle',
        brand: 'Baci Tech',
        gtin: '123456789015',
        mpn: 'SWB-04'
    },
    {
        id: 'p5',
        name: 'Leather Journal',
        description: 'A premium leather-bound journal for your thoughts, dreams, and sketches. Made with high-quality paper.',
        status: 'active',
        price: 25.00,
        stock: 200,
        image: 'https://picsum.photos/seed/p5/80/80',
        imageLarge: 'https://picsum.photos/seed/p5/600/400',
        imageHint: 'leather journal',
        brand: 'Baci Stationary',
        gtin: '123456789016',
        mpn: 'JRN-LTH-05'
    },
];

export function getProductById(id: string): Product | undefined {
    return products.find(p => p.id === id);
}

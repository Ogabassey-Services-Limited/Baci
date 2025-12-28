export interface Category {
    id: string;
    name: string;
    slug: string;
    image_url?: string;
    parent_id?: string | null;
}

export interface ProductVariant {
    id: string;
    name: string;
    price_override?: number;
    stock?: number;
    storage?: string;
    color?: string;
    sku?: string;
}

export interface Product {
    id: string;
    name: string;
    slug: string;
    description?: string;
    price: number;
    compare_at_price?: number;
    images: string[];
    category?: Category; // UI often expects a single category for display
    brand?: string;
    condition?: string;
    stock?: number;
    is_featured?: boolean;
    currency?: string;
}

export interface Merchant {
    id: string;
    business_name: string;
    site_title?: string;
    site_tagline?: string;
    site_description?: string;
    logo_url?: string;
    slug: string;
    brand_colors?: {
        primary: string;
        background: string;
        accent: string;
    };
    contact_email?: string;
    phone?: string;
}

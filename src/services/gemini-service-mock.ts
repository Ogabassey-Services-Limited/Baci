export interface ProductRecommendation {
    name: string;
    reason: string;
    price: string;
}

export const searchProductsWithGemini = async (query: string): Promise<ProductRecommendation[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Return mock data based on query
    if (query.toLowerCase().includes('phone')) {
        return [
            { name: 'iPhone 15 Pro Max', reason: 'Best overall performance & camera', price: '₦1,800,000' },
            { name: 'Samsung Galaxy S24 Ultra', reason: 'Top-tier Android experience', price: '₦1,950,000' },
            { name: 'Google Pixel 8 Pro', reason: 'Great AI features & camera', price: '₦1,200,000' },
        ];
    }

    if (query.toLowerCase().includes('laptop')) {
        return [
            { name: 'MacBook Pro M3', reason: 'Powerhouse for creatives', price: '₦2,500,000' },
            { name: 'Dell XPS 15', reason: 'Premium Windows ultrabook', price: '₦2,100,000' },
        ];
    }

    // Default results
    return [
        { name: 'Sony WH-1000XM5', reason: 'Industry-leading noise cancellation', price: '₦450,000' },
        { name: 'PlayStation 5 Slim', reason: 'Next-gen gaming console', price: '₦650,000' },
        { name: 'Apple Watch Series 9', reason: 'Perfect companion for iPhone', price: '₦550,000' },
    ];
};

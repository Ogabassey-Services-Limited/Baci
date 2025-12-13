export interface CategorySEO {
    heading: string;
    description: string;
    features: string[];
    faqs?: { question: string; answer: string }[];
}

export const CATEGORY_SEO_DEFAULTS: Record<string, CategorySEO> = {
    // Mobile Phones Category
    'smartphones': {
        heading: 'What are the best Smartphones in Nigeria?',
        description: `Looking for the best smartphones in Nigeria? At Ogabassey, we offer a wide selection of new and UK-used mobile phones from top brands like Samsung Galaxy, Apple iPhone, Tecno, and Infinix. Whether you need a 5G device, a phone with 5000mAh battery life, or a budget-friendly option under ₦150,000, our structured inventory helps you find the perfect match with warranty protection.`,
        features: [
            '12-Month Warranty',
            'Pay in Installments (Small Small)',
            'Nationwide Delivery',
            '7-Day Return Policy'
        ],
        faqs: [
            {
                question: 'Are the UK used phones reliable?',
                answer: 'Yes, all our UK used phones undergo a rigorous 30-point quality check. We test battery health, screen responsiveness, cameras, and connectivity to ensure they work like new. Plus, they come with a warranty for your peace of mind.'
            },
            {
                question: 'Can I pay on delivery?',
                answer: 'We offer payment on delivery for customers in Lagos. For orders outside Lagos, we require a commitment fee or full payment depending on the location and order value.'
            },
            {
                question: 'Do you offer installment payments?',
                answer: 'Yes, we partner with Small Small and other BNPL providers to offer flexible installment plans. You can pay for your device over 3-6 months.'
            }
        ]
    },

    // Specific Brands
    'samsung': {
        heading: 'Buy Samsung Galaxy Phones in Nigeria',
        description: `Shop the latest Samsung Galaxy smartphones including the S-series flagships, A-series mid-range phones, and Z-series foldables. All our Samsung phones come with official warranty and support. Compare prices for Samsung Galaxy S24, A55, and A35 to get the best deal in Nigeria.`,
        features: [
            'Original Samsung Warranty',
            'Trade-in Available',
            'Free Screen Protection',
            'Official Accessories'
        ],
    },

    'iphone': {
        heading: 'Buy Apple iPhones in Nigeria - New & UK Used',
        description: `Get the best deals on Apple iPhones in Nigeria. From the latest iPhone 16 Pro Max to budget-friendly UK-used iPhone 12 and 13 models. All iPhones are strictly tested for quality and battery health. Choose between brand new sealed units or verified pre-owned devices with warranty.`,
        features: [
            'Battery Health Verified',
            'iCloud Unlocked',
            'Genuine Accessories',
            'Swap Deals Available'
        ],
        faqs: [
            {
                question: 'Is the battery health good on UK used iPhones?',
                answer: 'We guarantee a minimum of 85% battery health on all our UK used iPhones. Any device below this standard is sold at a discounted rate and clearly labeled.'
            },
            {
                question: 'Are the iPhones unlocked?',
                answer: 'Yes, all our iPhones are factory unlocked or carrier unlocked (chip unlock), meaning they will work with any Nigerian network provider (MTN, Airtel, Glo, 9mobile) immediately.'
            }
        ]
    },

    // Computes
    'laptops': {
        heading: 'Where to buy affordable Laptops in Lagos?',
        description: `Discover our range of high-performance laptops for work, school, and gaming. We stock MacBook Pro, MacBook Air, HP Spectre, Dell XPS, and Lenovo ThinkPad. All laptops are professionally inspected and come with genuine operating systems and functional batteries.`,
        features: [
            'Genuine OS Installed',
            'SSD Upgrades Available',
            'Student Discounts',
            'Free Laptop Bag'
        ],
    },

    // Accessories
    'accessories': {
        heading: 'Original Phone & Laptop Accessories',
        description: `Complete your setup with original accessories. We sell authentic chargers, protective cases, screen guards, AirPods, Galaxy Buds, and power banks. Don't risk your device with fake accessories – shop genuine products from Anker, Oraimo, Apple, and Samsung.`,
        features: [
            '100% Original',
            'Fast Charging Guaranteed',
            'Durable Materials',
            'Compatibility Checked'
        ],
    },
};

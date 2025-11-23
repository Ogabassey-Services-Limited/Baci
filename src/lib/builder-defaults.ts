import { Data } from '@measured/puck';
import { PlaceHolderImages } from '@/lib/placeholder-images';

/**
 * Generate default Puck config from merchant's existing template
 * This is used when no draft or published config exists
 */
export function generateDefaultConfig(merchant: any): Data {
    const { generateInitialTemplate } = require('./initial-template-generator');

    return generateInitialTemplate({
        businessName: merchant?.business_name || 'Your Store',
        businessType: merchant?.business_type || 'other',
        brandColors: merchant?.brand_colors || {
            primary: '#3F51B5',
            background: '#FFFFFF',
            accent: '#FF5722'
        },
        merchant
    });
}

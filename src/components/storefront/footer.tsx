'use client';

import { useMerchant } from '@/hooks/use-merchant';
import { ThemedLink } from '@/components/themed';
import { findDarkestColor, getContrastingTextColor } from '@/lib/color-utils';

export function StorefrontFooter() {
    const { merchant } = useMerchant();

    if (!merchant) return null;

    const footerLinks = [
        { key: 'about', label: 'About Us' },
        { key: 'contact', label: 'Contact' },
        { key: 'privacy', label: 'Privacy Policy' },
        { key: 'terms', label: 'Terms and Conditions' },
        { key: 'faq', label: 'FAQs' },
        { key: 'legal', label: 'Legal and Dispute' },
    ];

    const availableFooterLinks = footerLinks.filter(link => merchant.pages?.[link.key as keyof typeof merchant.pages]);

    const brandColors = merchant.brand_colors ? [merchant.brand_colors.primary, merchant.brand_colors.background, merchant.brand_colors.accent].filter(Boolean) : ['#3F51B5'];
    const darkestColor = findDarkestColor(brandColors as string[]);

    return (
        <footer
            className="text-white mt-auto"
            style={{ backgroundColor: darkestColor, color: getContrastingTextColor(darkestColor) }}
        >
            <div className="container mx-auto py-8 px-4 md:px-6">
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <h3 className="text-lg font-semibold mb-4">{merchant.business_name}</h3>
                        <p className="text-sm opacity-80">&copy; {new Date().getFullYear()} {merchant.business_name}. All rights reserved.</p>
                    </div>
                    {availableFooterLinks.length > 0 && (
                        <div className="lg:col-span-2">
                            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                            <nav className="grid grid-cols-2 gap-2">
                                {availableFooterLinks.map((link) => (
                                    <ThemedLink key={link.key} className="text-sm hover:underline underline-offset-4 opacity-80 hover:opacity-100" href={`/pages/${link.key}`}>
                                        {link.label}
                                    </ThemedLink>
                                ))}
                            </nav>
                        </div>
                    )}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Follow Us</h3>
                        <div className="flex space-x-4">
                            {/* Social links can be added here */}
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}

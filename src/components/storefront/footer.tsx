'use client';

import { useMerchant } from '@/hooks/use-merchant';
import { ThemedLink } from '@/components/themed';

/**
 * StorefrontFooter - Now fully themeable via CSS variables
 * 
 * All visual properties are controlled by the theme system:
 * - --theme-footer-bg: Background color
 * - --theme-footer-text: Text color
 * - --theme-footer-link: Link color
 * - --theme-footer-link-hover: Link hover color
 * - --theme-footer-py: Vertical padding
 * - --theme-footer-px: Horizontal padding
 */
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

    return (
        <footer
            className="mt-auto"
            style={{
                backgroundColor: 'var(--theme-footer-bg, #1A202C)',
                color: 'var(--theme-footer-text, #FFFFFF)',
                paddingTop: 'var(--theme-footer-py, 3rem)',
                paddingBottom: 'var(--theme-footer-py, 3rem)',
            }}
        >
            <div
                className="container mx-auto"
                style={{
                    paddingLeft: 'var(--theme-footer-px, 1rem)',
                    paddingRight: 'var(--theme-footer-px, 1rem)',
                }}
            >
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
                                    <a
                                        key={link.key}
                                        href={`/pages/${link.key}`}
                                        className="text-sm hover:underline underline-offset-4 opacity-80 hover:opacity-100 transition-opacity"
                                        style={{
                                            color: 'var(--theme-footer-link, #FFC107)',
                                        }}
                                    >
                                        {link.label}
                                    </a>
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

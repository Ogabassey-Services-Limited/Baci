'use client';

import { StorefrontProductGrid } from '@/components/storefront/product-grid';
import type { TemplatePageProps } from '@/templates/registry';
import {
    Shield,
    Truck,
    Phone,
    Upload,
    CheckCircle2,
    Pill,
    Heart,
    Stethoscope
} from 'lucide-react';
import { useState } from 'react';

/**
 * Pharmaceutical Template - Professional, trustworthy design for pharmacy e-commerce
 * Features: Medical color scheme, trust signals, prescription upload, compliance indicators
 */
export function PharmaceuticalTemplate({ children }: { children: React.ReactNode }) {
    return <div className="template-pharmaceutical bg-white">{children}</div>;
}

export function PharmaceuticalHome(props: TemplatePageProps) {
    const [selectedCategory, setSelectedCategory] = useState('All');

    const merchant = props.merchant || {
        business_name: 'MedCare Pharmacy',
        logo_url: undefined,
        brand_colors: {
            primary: '#2563EB',
            background: '#FFFFFF',
            accent: '#10B981',
        },
    };

    const categories = [
        { name: 'All Products', value: 'All', icon: Pill },
        { name: 'Prescription', value: 'Prescription', icon: Stethoscope },
        { name: 'OTC Medications', value: 'OTC', icon: Pill },
        { name: 'Vitamins & Supplements', value: 'Vitamins', icon: Heart },
    ];

    const trustBadges = [
        { icon: Shield, title: 'Licensed Pharmacist', subtitle: 'Available 24/7' },
        { icon: CheckCircle2, title: '100% Authentic', subtitle: 'Verified Medications' },
        { icon: Truck, title: 'Fast Delivery', subtitle: 'Same-day available' },
        { icon: Phone, title: 'Free Consultation', subtitle: 'Talk to experts' },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Section - Professional Medical Theme */}
            <section className="relative bg-linear-to-br from-blue-600 to-blue-700 text-white">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAgNHYyaDJ2LTJoLTJ6bS0yIDJoLTJ2Mmgydi0yek0zMiAzOGgtMnYyaDJ2LTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />

                <div className="relative max-w-7xl mx-auto px-6 py-16">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                <Pill className="w-6 h-6" />
                            </div>
                            <div className="flex gap-2">
                                <span className="px-3 py-1 bg-green-500 text-white text-xs font-semibold rounded-full">
                                    Licensed
                                </span>
                                <span className="px-3 py-1 bg-white/20 text-white text-xs font-semibold rounded-full">
                                    HIPAA Compliant
                                </span>
                            </div>
                        </div>

                        <h1 className="text-5xl font-bold mb-4 leading-tight">
                            Your Trusted Online Pharmacy
                        </h1>
                        <p className="text-xl text-blue-100 mb-8 leading-relaxed">
                            Quality medications delivered to your door. Licensed pharmacists available for consultation.
                            100% authentic products guaranteed.
                        </p>

                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={() => {
                                    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-lg"
                            >
                                Shop Now
                            </button>
                            <button
                                onClick={() => {
                                    // TODO: Implement prescription upload feature
                                    alert('Prescription upload coming soon!');
                                }}
                                className="px-8 py-4 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors shadow-lg flex items-center gap-2"
                            >
                                <Upload className="w-5 h-5" />
                                Upload Prescription
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust Badges Bar */}
            <section className="bg-white border-y border-gray-200 py-8">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {trustBadges.map((badge, index) => {
                            const Icon = badge.icon;
                            return (
                                <div key={index} className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                        <Icon className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900 text-sm">{badge.title}</div>
                                        <div className="text-xs text-gray-600">{badge.subtitle}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Prescription Upload CTA */}
            <section className="bg-linear-to-r from-green-50 to-blue-50 py-12">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
                        <div className="grid md:grid-cols-2 gap-8 items-center">
                            <div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                                    Need Prescription Medications?
                                </h2>
                                <p className="text-gray-600 mb-6 leading-relaxed">
                                    Upload your prescription securely and our licensed pharmacists will verify and process your order.
                                    Fast, safe, and convenient.
                                </p>
                                <div className="space-y-3 mb-6">
                                    {[
                                        'Upload prescription (photo or PDF)',
                                        'Pharmacist verification within 1 hour',
                                        'Order delivered to your doorstep'
                                    ].map((step, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                                                {idx + 1}
                                            </div>
                                            <span className="text-gray-700">{step}</span>
                                        </div>
                                    ))}
                                </div>
                                <button className="px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors flex items-center gap-2">
                                    <Upload className="w-5 h-5" />
                                    Upload Prescription Now
                                </button>
                            </div>
                            <div className="relative h-64 bg-linear-to-br from-blue-100 to-green-100 rounded-xl flex items-center justify-center">
                                <div className="text-center">
                                    <Upload className="w-16 h-16 text-blue-600/30 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm">Prescription Upload Placeholder</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Category Navigation */}
            <section className="py-12 bg-white">
                <div className="max-w-7xl mx-auto px-6">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
                        Shop by Category
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {categories.map((category) => {
                            const Icon = category.icon;
                            const isActive = selectedCategory === category.value;
                            return (
                                <button
                                    key={category.value}
                                    onClick={() => setSelectedCategory(category.value)}
                                    className={`p-6 rounded-xl border-2 transition-all ${isActive
                                        ? 'border-blue-600 bg-blue-50 shadow-lg'
                                        : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                                        }`}
                                >
                                    <Icon className={`w-10 h-10 mx-auto mb-3 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                                    <span className={`block text-center font-medium ${isActive ? 'text-blue-900' : 'text-gray-700'}`}>
                                        {category.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Products Section - With Custom Theme Styling */}
            <section
                id="products"
                className="py-16 bg-gray-50"
                style={{
                    '--store-primary': '#2563EB',
                    '--store-primary-text': '#FFFFFF',
                    '--store-accent': '#10B981',
                } as React.CSSProperties}
            >
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl font-bold text-gray-900 mb-4">
                            Our Products
                        </h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            All medications verified by licensed pharmacists. 100% authentic products guaranteed.
                        </p>
                    </div>

                    {/* Custom styled filter bar that matches pharmaceutical theme */}
                    <div className="mb-8">
                        <div className="bg-linear-to-r from-blue-50 to-green-50 border border-blue-200 rounded-xl p-4 shadow-sm">
                            <div className="flex flex-wrap justify-center gap-2">
                                {categories.map((category) => {
                                    const isActive = selectedCategory === category.value;
                                    return (
                                        <button
                                            key={category.value}
                                            onClick={() => setSelectedCategory(category.value)}
                                            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'bg-white hover:bg-blue-50 text-gray-700 hover:shadow-sm'
                                                }`}
                                        >
                                            {category.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <StorefrontProductGrid
                        title=""
                        columns={4}
                        limit={12}
                        showFilters={false}
                    />
                </div>
            </section>

            {/* Healthcare Resources */}
            <section className="py-16 bg-white border-t border-gray-200">
                <div className="max-w-7xl mx-auto px-6">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        Health & Wellness Resources
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                title: 'Medication Guides',
                                description: 'Learn about proper usage, dosage, and side effects of common medications.',
                                icon: Pill,
                            },
                            {
                                title: 'Health Tips',
                                description: 'Expert advice on maintaining wellness and managing chronic conditions.',
                                icon: Heart,
                            },
                            {
                                title: 'Ask a Pharmacist',
                                description: 'Free consultation with licensed pharmacists available 24/7.',
                                icon: Phone,
                            },
                        ].map((resource, idx) => {
                            const Icon = resource.icon;
                            return (
                                <div key={idx} className="p-6 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all">
                                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                                        <Icon className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{resource.title}</h3>
                                    <p className="text-gray-600">{resource.description}</p>
                                    <span className="inline-block mt-4 text-blue-600 font-medium cursor-pointer hover:text-blue-700">
                                        Learn More →
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-16 bg-linear-to-r from-blue-600 to-blue-700 text-white">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="grid md:grid-cols-3 gap-8 text-center">
                        <div>
                            <div className="text-5xl font-bold mb-2">50K+</div>
                            <div className="text-blue-100">Happy Customers</div>
                        </div>
                        <div className="border-x border-white/20">
                            <div className="text-5xl font-bold mb-2">24/7</div>
                            <div className="text-blue-100">Pharmacist Support</div>
                        </div>
                        <div>
                            <div className="text-5xl font-bold mb-2">100%</div>
                            <div className="text-blue-100">Authentic Products</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-300 py-12">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-4">
                                {merchant.business_name}
                            </h3>
                            <p className="text-sm leading-relaxed mb-4">
                                Your trusted online pharmacy. Licensed, verified, and committed to your health.
                            </p>
                            <div className="flex gap-2">
                                <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">Licensed</span>
                                <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">HIPAA</span>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">Shop</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-blue-400 transition-colors">Prescription Medications</a></li>
                                <li><a href="#" className="hover:text-blue-400 transition-colors">OTC Products</a></li>
                                <li><a href="#" className="hover:text-blue-400 transition-colors">Vitamins & Supplements</a></li>
                                <li><a href="#" className="hover:text-blue-400 transition-colors">Personal Care</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">Support</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-blue-400 transition-colors">Contact Pharmacist</a></li>
                                <li><a href="#" className="hover:text-blue-400 transition-colors">Upload Prescription</a></li>
                                <li><a href="#" className="hover:text-blue-400 transition-colors">Track Order</a></li>
                                <li><a href="#" className="hover:text-blue-400 transition-colors">FAQs</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white mb-4">Legal</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</a></li>
                                <li><a href="#" className="hover:text-blue-400 transition-colors">HIPAA Compliance</a></li>
                                <li><a href="#" className="hover:text-blue-400 transition-colors">Terms of Service</a></li>
                                <li><a href="#" className="hover:text-blue-400 transition-colors">Licensing Information</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-gray-800 pt-6 text-center text-sm">
                        <p>&copy; {new Date().getFullYear()} {merchant.business_name}. All rights reserved.</p>
                        <p className="mt-2 text-gray-500">
                            Licensed pharmacy. For medical emergencies, call 911 or visit your nearest emergency room.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

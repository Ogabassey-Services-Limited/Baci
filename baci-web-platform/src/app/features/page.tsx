import {
  BarChart,
  Globe,
  Palette,
  ShoppingBag,
  Smartphone,
  Zap,
} from 'lucide-react';
import type { Metadata } from 'next';
import AppBody from '@/components/app-body';
import { PlatformFooter } from '@/components/platform/footer';
import { PlatformHeader } from '@/components/platform/header';

export const metadata: Metadata = {
  title: 'Features - Baci',
  description:
    'Explore the powerful features that make Baci the best AI e-commerce builder.',
};

export default function FeaturesPage() {
  const features = [
    {
      icon: <Zap className="w-8 h-8 text-yellow-500" />,
      title: 'AI-Powered Generation',
      description:
        'Generate your entire store structure, copy, and branding in seconds. Our AI understands your niche and builds a tailored experience.',
    },
    {
      icon: <Palette className="w-8 h-8 text-purple-500" />,
      title: 'Smart Theming',
      description:
        'Upload your logo and watch as our system extracts your brand colors and applies them intelligently across your entire storefront.',
    },
    {
      icon: <ShoppingBag className="w-8 h-8 text-blue-500" />,
      title: 'Inventory Management',
      description:
        'Track stock, manage variants, and get low-stock alerts. Simple enough for beginners, powerful enough for pros.',
    },
    {
      icon: <BarChart className="w-8 h-8 text-green-500" />,
      title: 'Real-time Analytics',
      description:
        'Know exactly how your store is performing. Track visitors, sales, and conversion rates with our built-in dashboard.',
    },
    {
      icon: <Smartphone className="w-8 h-8 text-pink-500" />,
      title: 'Mobile First',
      description:
        'Every store built on Baci is fully responsive and optimized for mobile shoppers, ensuring you never miss a sale.',
    },
    {
      icon: <Globe className="w-8 h-8 text-cyan-500" />,
      title: 'Custom Domains',
      description:
        'Connect your own domain name to build trust, or get started instantly with a free baci.shop subdomain.',
    },
  ];

  return (
    <AppBody>
      <div className="flex flex-col min-h-screen bg-background font-sans selection:bg-accent/30">
        <PlatformHeader />
        <main className="flex-1 pt-24 pb-16">
          <section className="container px-4 md:px-6">
            <div className="text-center mb-16 max-w-3xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                Everything you need to succeed
              </h1>
              <p className="text-xl text-muted-foreground">
                Powerful tools simplified for modern commerce.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: List is static
                  key={i}
                  className="p-8 rounded-2xl border border-border bg-card hover:shadow-lg transition-shadow"
                >
                  <div className="mb-6 p-3 bg-accent/5 w-fit rounded-xl">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </main>
        <PlatformFooter />
      </div>
    </AppBody>
  );
}

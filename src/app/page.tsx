
'use client';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import AppBody from '@/components/app-body';
import { CheckCircle2, Sparkles, Zap, Store, Palette, ShoppingBag, TrendingUp, BarChart } from 'lucide-react';

function BaciLandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: 'How to create your online store with Baci',
            description: 'Create a professional online store in minutes using AI-powered tools.',
            step: [
              {
                '@type': 'HowToStep',
                name: 'Choose your business type',
                text: 'Tell us about your business and let our AI generate a customized store in seconds. We\'ll create everything from your logo to product categories.',
                position: 1,
              },
              {
                '@type': 'HowToStep',
                name: 'Customize your store',
                text: 'Add products, adjust colors, upload your logo. Our AI helps you create professional product descriptions and optimize your store for sales.',
                position: 2,
              },
              {
                '@type': 'HowToStep',
                name: 'Go live and start selling',
                text: 'Launch your store with a custom domain or subdomain. Start selling immediately with built-in payments, inventory management, and order processing.',
                position: 3,
              },
            ],
          }),
        }}
      />
      <header className="px-4 lg:px-6 h-16 flex items-center shadow-sm sticky top-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-50 border-b">
        <Link href="/" className="flex items-center">
          <Logo />
          <span className="sr-only">Baci</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="#features">Features</Link>
          </Button>
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="#how-it-works">How It Works</Link>
          </Button>
          <Button asChild variant="outline" className="border-[#2D3E68] text-[#2D3E68] hover:bg-[#2D3E68] hover:text-white">
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild className="bg-[#FF9F43] hover:bg-[#ff8c1a] text-white">
            <Link href="/onboarding">Sign Up</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative w-full pt-6 pb-20 md:pt-10 md:pb-32 lg:pt-12 lg:pb-40 overflow-hidden bg-gradient-to-br from-[#2D3E68] via-[#3d5a9f] to-[#2D3E68]">
          {/* Geometric Shapes */}
          <div className="absolute top-10 right-10 w-24 h-24 bg-[#FF9F43] rounded-2xl transform rotate-12 opacity-20" />
          <div className="absolute bottom-20 left-20 w-32 h-32 bg-[#FF9F43] rounded-2xl transform -rotate-6 opacity-20" />
          <div className="absolute top-1/2 right-1/3 w-16 h-16 bg-[#ffb366] rounded-full opacity-10" />
          <div className="absolute bottom-1/3 left-1/2 w-20 h-20 bg-[#FF9F43] opacity-10" />

          <div className="container px-4 md:px-6 relative z-10">
            <div className="flex flex-col items-center space-y-8 text-center">
              <div className="space-y-6 max-w-4xl">
                <div className="inline-block px-4 py-2 bg-[#FF9F43]/20 rounded-full text-[#ffb366] text-sm font-semibold mb-4">
                  ✨ AI-Powered E-commerce Platform
                </div>
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl text-white leading-tight">
                  Build your online store in minutes. It's{' '}
                  <span className="bg-gradient-to-r from-[#FF9F43] to-[#ffb366] text-transparent bg-clip-text">
                    easier than you think
                  </span>{' '}
                  with AI.
                </h1>
                <p className="mx-auto max-w-[700px] text-blue-100 text-lg md:text-xl">
                  Launch a professional e-commerce store powered by AI. No coding required.
                  Perfect for retail businesses ready to sell online.
                </p>
              </div>
              <div className="flex flex-col gap-4 min-[400px]:flex-row">
                <Button asChild size="lg" className="bg-[#FF9F43] hover:bg-[#ff8c1a] text-white text-lg px-8 py-6 h-auto font-semibold shadow-lg">
                  <Link href="/onboarding">Get Started Free →</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-white border-white bg-white/10 hover:bg-white/20 text-lg px-8 py-6 h-auto">
                  <Link href="#how-it-works">See How It Works</Link>
                </Button>
              </div>
              <div className="flex items-center gap-8 pt-8 text-white/80 text-sm flex-wrap justify-center">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#FF9F43]" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#FF9F43]" />
                  <span>Setup in 5 minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#FF9F43]" />
                  <span>10,000+ stores created</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof Section */}
        <section className="w-full py-12 bg-[#fef7ed]">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col md:flex-row items-center justify-center gap-12">
              <div className="text-center">
                <div className="flex gap-1 justify-center mb-2">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-6 h-6 fill-[#FF9F43]" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                    </svg>
                  ))}
                </div>
                <p className="text-2xl font-bold text-[#2D3E68]">4.9/5</p>
                <p className="text-sm text-gray-600">From 1,000+ merchants</p>
              </div>
              <div className="h-12 w-px bg-gray-300 hidden md:block" />
              <div className="text-center">
                <p className="text-3xl font-bold text-[#2D3E68]">10,000+</p>
                <p className="text-sm text-gray-600">Active stores created</p>
              </div>
              <div className="h-12 w-px bg-gray-300 hidden md:block" />
              <div className="text-center">
                <p className="text-3xl font-bold text-[#2D3E68]">$5M+</p>
                <p className="text-sm text-gray-600">In sales processed</p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="w-full py-20 md:py-32 bg-white">
          <div className="container px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-24 items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-8 text-[#2D3E68]">
                  How to create your store
                </h2>
                <div className="space-y-8">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#2D3E68] flex items-center justify-center text-white font-bold text-lg">
                      1
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2 text-[#2D3E68]">Choose your business type</h3>
                      <p className="text-gray-600">
                        Tell us about your business and let our AI generate a customized store in seconds.
                        We'll create everything from your logo to product categories.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#2D3E68] flex items-center justify-center text-white font-bold text-lg">
                      2
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2 text-[#2D3E68]">Customize your store</h3>
                      <p className="text-gray-600">
                        Add products, adjust colors, upload your logo. Our AI helps you create professional
                        product descriptions and optimize your store for sales.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#2D3E68] flex items-center justify-center text-white font-bold text-lg">
                      3
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2 text-[#2D3E68]">Go live and start selling</h3>
                      <p className="text-gray-600">
                        Launch your store with a custom domain or subdomain. Start selling immediately
                        with built-in payments, inventory management, and order processing.
                      </p>
                    </div>
                  </div>
                </div>
                <Button asChild size="lg" className="mt-8 bg-[#2D3E68] hover:bg-[#1a2332] text-white">
                  <Link href="/onboarding">Create Your Store →</Link>
                </Button>
              </div>

              {/* Preview Visual */}
              <div className="relative">
                <div className="absolute -top-8 -right-8 w-24 h-24 bg-[#FF9F43] rounded-2xl transform rotate-12 opacity-20" />
                <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-[#2D3E68] rounded-2xl transform -rotate-6 opacity-20" />
                <div className="relative bg-gradient-to-br from-[#f0f4ff] to-[#fef7ed] rounded-3xl p-8 shadow-2xl">
                  <div className="bg-white rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm font-semibold text-gray-600">Welcome to AI Store Builder</div>
                      <Sparkles className="h-5 w-5 text-[#FF9F43]" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-[#2D3E68]">Let AI create your store in minutes</h3>
                    <Button className="w-full bg-gradient-to-r from-[#2D3E68] to-[#3d5a9f] hover:from-[#1a2332] hover:to-[#2D3E68] text-white">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Get Started
                    </Button>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 text-[#FF9F43]" />
                        <span>AI-powered product descriptions</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 text-[#FF9F43]" />
                        <span>Automatic inventory management</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 text-[#FF9F43]" />
                        <span>Built-in payment processing</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-20 md:py-32 bg-[#fef7ed]">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-4 text-[#2D3E68]">
                One app that has all the features your business needs
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Everything you need to build, manage, and grow your online store
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-[#f0f4ff] rounded-xl flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-[#2D3E68]" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-[#2D3E68]">AI-Powered Design</h3>
                <p className="text-gray-600">
                  Let AI generate your entire store, from layout to product descriptions. Professional results in seconds.
                </p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-[#fff5eb] rounded-xl flex items-center justify-center mb-4">
                  <Palette className="h-6 w-6 text-[#FF9F43]" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-[#2D3E68]">Custom Branding</h3>
                <p className="text-gray-600">
                  Upload your logo, choose your colors, and make your store uniquely yours. No design skills required.
                </p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-[#f0f4ff] rounded-xl flex items-center justify-center mb-4">
                  <ShoppingBag className="h-6 w-6 text-[#2D3E68]" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-[#2D3E68]">Product Management</h3>
                <p className="text-gray-600">
                  Easy inventory tracking, variant management, and bulk operations. Scale effortlessly as you grow.
                </p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-[#fff5eb] rounded-xl flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-[#FF9F43]" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-[#2D3E68]">Lightning Fast</h3>
                <p className="text-gray-600">
                  Built on modern technology for blazing-fast load times. Better performance means more sales.
                </p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-[#f0f4ff] rounded-xl flex items-center justify-center mb-4">
                  <Store className="h-6 w-6 text-[#2D3E68]" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-[#2D3E68]">Multi-Channel Ready</h3>
                <p className="text-gray-600">
                  Manage your online store, physical sales, and inventory all in one dashboard.
                </p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-[#fff5eb] rounded-xl flex items-center justify-center mb-4">
                  <BarChart className="h-6 w-6 text-[#FF9F43]" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-[#2D3E68]">Business Analytics</h3>
                <p className="text-gray-600">
                  Track sales, monitor inventory, and get insights to make better business decisions.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Two-Column Features */}
        <section className="w-full py-20 md:py-32 bg-[#f0f4ff]">
          <div className="container px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4 text-[#2D3E68]">
                  Turn your physical store into a smart store
                </h2>
                <p className="text-lg text-gray-600 mb-6">
                  Generate barcodes for your products for better inventory management and set up checkout
                  software on your device for faster sales in your physical store.
                </p>
                <Button asChild className="bg-[#2D3E68] hover:bg-[#1a2332] text-white">
                  <Link href="/onboarding">
                    Learn More →
                  </Link>
                </Button>
              </div>
              <div className="relative h-[400px] bg-white rounded-2xl shadow-lg p-6 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <ShoppingBag className="h-24 w-24 mx-auto mb-4" />
                  <p>Point of Sale Preview</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-20 md:py-32 bg-white">
          <div className="container px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <div className="order-2 lg:order-1 relative h-[400px] bg-[#fef7ed] rounded-2xl shadow-lg p-6 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <TrendingUp className="h-24 w-24 mx-auto mb-4 text-[#FF9F43]" />
                  <p>Analytics Dashboard Preview</p>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <h2 className="text-3xl font-bold mb-4 text-[#2D3E68]">
                  Have visibility on your business operations
                </h2>
                <p className="text-lg text-gray-600 mb-6">
                  Don't do business blindly. View your staff actions, sales, inventory and analytics across
                  numerous store locations with one dashboard.
                </p>
                <Button asChild className="bg-[#FF9F43] hover:bg-[#ff8c1a] text-white">
                  <Link href="/onboarding">
                    Get Started →
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="w-full py-20 md:py-32 bg-[#2D3E68]">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-white mb-4">
                Trusted by over 10,000 SMEs
              </h2>
              <p className="text-xl text-blue-100">
                See what business owners like yourself are saying about Baci
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="bg-white p-6 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#FF9F43] flex items-center justify-center text-white font-bold">
                    AN
                  </div>
                  <div>
                    <p className="font-semibold text-[#2D3E68]">Amara Nwosu</p>
                    <p className="text-sm text-gray-600">Fashion Boutique Owner</p>
                  </div>
                </div>
                <p className="text-gray-700">
                  "Baci transformed my business! I went from a small physical shop to having customers
                  nationwide. The AI setup was incredibly easy."
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#2D3E68] flex items-center justify-center text-white font-bold">
                    TK
                  </div>
                  <div>
                    <p className="font-semibold text-[#2D3E68]">Tunde Kayode</p>
                    <p className="text-sm text-gray-600">Electronics Store</p>
                  </div>
                </div>
                <p className="text-gray-700">
                  "The inventory management features have saved me countless hours. I can finally focus
                  on growing my business instead of paperwork."
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#FF9F43] flex items-center justify-center text-white font-bold">
                    CO
                  </div>
                  <div>
                    <p className="font-semibold text-[#2D3E68]">Chioma Okafor</p>
                    <p className="text-sm text-gray-600">Beauty Products</p>
                  </div>
                </div>
                <p className="text-gray-700">
                  "My sales tripled after launching my Baci store. The platform is so easy to use,
                  and my customers love the professional look."
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="w-full py-20 md:py-32 bg-gradient-to-br from-[#FF9F43] via-[#ff8c1a] to-[#2D3E68] relative overflow-hidden">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-2xl transform rotate-12 opacity-10" />
          <div className="absolute bottom-20 right-20 w-40 h-40 bg-white rounded-2xl transform -rotate-6 opacity-10" />

          <div className="container px-4 md:px-6 relative z-10">
            <div className="flex flex-col items-center space-y-8 text-center">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-white max-w-3xl">
                Ready to start selling? Create your store now.
              </h2>
              <p className="text-xl text-white/90 max-w-2xl">
                Join thousands of merchants who have already launched their online stores with Baci.
                No credit card required to get started.
              </p>
              <div className="flex flex-col gap-4 min-[400px]:flex-row">
                <Button asChild size="lg" className="bg-white text-[#2D3E68] hover:bg-gray-100 text-lg px-8 py-6 h-auto font-semibold shadow-lg">
                  <Link href="/onboarding">Get Started Free →</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 bg-[#1a2332] text-white">
        <div className="container px-4 md:px-6">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <Logo className="mb-4" />
              <p className="text-sm text-gray-400">
                Build your e-commerce empire with AI-powered tools.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#features" className="hover:text-white">Features</Link></li>
                <li><Link href="#how-it-works" className="hover:text-white">How It Works</Link></li>
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
            <p>&copy; {new Date().getFullYear()} Baci. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <AppBody>
      <BaciLandingPage />
    </AppBody>
  );
}

import { Mail, MapPin, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import AppBody from '@/components/app-body';
import { PlatformFooter } from '@/components/platform/footer';
import { PlatformHeader } from '@/components/platform/header';
import { PlatformContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'Contact Us - Baci',
  description: 'Get in touch with the Baci team.',
};

export default function ContactPage() {
  return (
    <AppBody>
      <div className="flex flex-col min-h-screen bg-background font-sans selection:bg-accent/30">
        <PlatformHeader />
        <main className="flex-1 pt-24 pb-16">
          <section className="container px-4 md:px-6">
            <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
              <div>
                <h1 className="text-4xl font-bold tracking-tight mb-6">
                  Get in touch
                </h1>
                <p className="text-lg text-muted-foreground mb-8">
                  Have questions about Baci? Our team is here to help. Fill out
                  the form and we'll get back to you as soon as possible.
                </p>

                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Email Us</h3>
                      <p className="text-muted-foreground">
                        support@usebaci.com
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                      <Phone className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Call Us</h3>
                      <p className="text-muted-foreground">+234 916 944 9282</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Visit Us</h3>
                      <p className="text-muted-foreground">Lagos, Nigeria</p>
                    </div>
                  </div>
                </div>
              </div>

              <PlatformContactForm />
            </div>
          </section>
        </main>
        <PlatformFooter />
      </div>
    </AppBody>
  );
}

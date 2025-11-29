import AppBody from '@/components/app-body';
import { PlatformHeader } from '@/components/platform/header';
import { PlatformFooter } from '@/components/platform/footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Baci Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <AppBody showNewsletterWidget={false}>
      <div className="flex flex-col min-h-screen">
        <PlatformHeader />
        <main className="flex-1 pt-32 pb-24">
          <div className="container max-w-3xl prose-baci">
            <h1>Privacy Policy</h1>
            <p className="text-lg text-muted-foreground">Last updated: November 28, 2025</p>
            
            <p>
              At Baci, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our services.
            </p>

            <h2>Information We Collect</h2>
            <p>
              We collect information that you provide directly to us when you register for an account, create a store, make a purchase, or communicate with us. This may include your name, email address, business information, and payment details.
            </p>

            <h2>How We Use Your Information</h2>
            <ul>
              <li>To provide and maintain our Service</li>
              <li>To notify you about changes to our Service</li>
              <li>To allow you to participate in interactive features</li>
              <li>To provide customer support</li>
              <li>To gather analysis or valuable information so that we can improve our Service</li>
            </ul>

            <h2>Data Security</h2>
            <p>
              The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.
            </p>

            <h2>Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at <a href="mailto:privacy@usebaci.com">privacy@usebaci.com</a>.
            </p>
          </div>
        </main>
        <PlatformFooter />
      </div>
    </AppBody>
  );
}

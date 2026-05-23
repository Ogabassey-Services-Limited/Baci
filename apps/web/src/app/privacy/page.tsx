import '@/app/globals.css';
import type { Metadata } from 'next';
import AppBody from '@/components/app-body';
import { PlatformFooter } from '@/components/platform/footer';
import { PlatformHeader } from '@/components/platform/header';

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
            <p className="text-lg text-muted-foreground">
              Last updated: February 1, 2026
            </p>

            <p>
              At Baci, we take your privacy seriously. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your
              information when you visit our website or use our services.
            </p>

            <h2>Information We Collect</h2>
            <p>
              We collect information that you provide directly to us when you
              register for an account, create a store, make a purchase, or
              communicate with us. This may include your name, email address,
              business information, and payment details.
            </p>

            <h2>How We Use Your Information</h2>
            <ul>
              <li>To provide and maintain our Service</li>
              <li>To notify you about changes to our Service</li>
              <li>To allow you to participate in interactive features</li>
              <li>To provide customer support</li>
              <li>
                To gather analysis or valuable information so that we can
                improve our Service
              </li>
            </ul>

            <h2>Data Security</h2>
            <p>
              The security of your data is important to us, but remember that no
              method of transmission over the Internet, or method of electronic
              storage is 100% secure. While we strive to use commercially
              acceptable means to protect your Personal Data, we cannot
              guarantee its absolute security.
            </p>

            <h2>Subscriptions and Payments</h2>
            <p>
              Baci offers auto-renewable subscription plans through Apple&apos;s
              App Store. When you subscribe:
            </p>
            <ul>
              <li>
                Payment will be charged to your Apple ID account at confirmation
                of purchase
              </li>
              <li>
                Subscription automatically renews unless cancelled at least 24
                hours before the end of the current period
              </li>
              <li>
                Your account will be charged for renewal within 24 hours prior
                to the end of the current period
              </li>
              <li>
                You can manage and cancel your subscriptions by going to your
                Apple ID account settings after purchase
              </li>
              <li>
                Any unused portion of a free trial period will be forfeited when
                you purchase a subscription
              </li>
            </ul>
            <p>
              Subscription data and purchase history are processed by Apple and
              RevenueCat. We receive confirmation of your subscription status
              but do not have access to your payment card details.
            </p>

            <h2>Third-Party Services</h2>
            <p>
              We use the following third-party services that may collect
              information:
            </p>
            <ul>
              <li>
                <strong>Apple App Store</strong> - For app distribution and
                in-app purchases
              </li>
              <li>
                <strong>RevenueCat</strong> - For subscription management and
                analytics
              </li>
              <li>
                <strong>Supabase</strong> - For authentication and data storage
              </li>
              <li>
                <strong>Payment Processors</strong> - Paystack, Korapay for
                transaction processing
              </li>
            </ul>

            <h2>Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please
              contact us at{' '}
              <a href="mailto:privacy@usebaci.com">privacy@usebaci.com</a>.
            </p>
          </div>
        </main>
        <PlatformFooter />
      </div>
    </AppBody>
  );
}

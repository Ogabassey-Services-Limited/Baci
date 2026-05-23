import '@/app/globals.css';
import type { Metadata } from 'next';
import AppBody from '@/components/app-body';
import { PlatformFooter } from '@/components/platform/footer';
import { PlatformHeader } from '@/components/platform/header';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Baci Terms of Service',
};

export default function TermsPage() {
  return (
    <AppBody showNewsletterWidget={false}>
      <div className="flex flex-col min-h-screen">
        <PlatformHeader />
        <main className="flex-1 pt-32 pb-24">
          <div className="container max-w-3xl prose-baci">
            <h1>Terms of Service</h1>
            <p className="text-lg text-muted-foreground">
              Last updated: November 28, 2025
            </p>

            <p>
              Please read these Terms of Service ("Terms", "Terms of Service")
              carefully before using the Baci website and services operated by
              Baci ("us", "we", or "our").
            </p>

            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Service you agree to be bound by these
              Terms. If you disagree with any part of the terms then you may not
              access the Service.
            </p>

            <h2>2. Accounts</h2>
            <p>
              When you create an account with us, you must provide us
              information that is accurate, complete, and current at all times.
              Failure to do so constitutes a breach of the Terms, which may
              result in immediate termination of your account on our Service.
            </p>

            <h2>3. Content</h2>
            <p>
              Our Service allows you to post, link, store, share and otherwise
              make available certain information, text, graphics, videos, or
              other material ("Content"). You are responsible for the Content
              that you post to the Service, including its legality, reliability,
              and appropriateness.
            </p>

            <h2>4. Termination</h2>
            <p>
              We may terminate or suspend access to our Service immediately,
              without prior notice or liability, for any reason whatsoever,
              including without limitation if you breach the Terms.
            </p>

            <h2>5. Changes</h2>
            <p>
              We reserve the right, at our sole discretion, to modify or replace
              these Terms at any time. If a revision is material we will try to
              provide at least 30 days notice prior to any new terms taking
              effect.
            </p>
          </div>
        </main>
        <PlatformFooter />
      </div>
    </AppBody>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Delete Account | Baci',
  description:
    'Request deletion of your Baci account and associated data. Learn about what data is deleted and the process.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Delete Your Baci Account
          </h1>
          <p className="text-gray-600 text-lg">
            We&apos;re sorry to see you go. This page explains how to request
            deletion of your account and what happens to your data.
          </p>
        </div>

        {/* Steps Section */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            How to Request Account Deletion
          </h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="shrink-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-semibold">
                1
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  Log into Your Account
                </h3>
                <p className="text-gray-600 mt-1">
                  Open the Baci app or visit{' '}
                  <Link
                    href="https://usebaci.com"
                    className="text-red-600 underline"
                  >
                    usebaci.com
                  </Link>{' '}
                  and sign in to your account.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-semibold">
                2
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  Navigate to Account Settings
                </h3>
                <p className="text-gray-600 mt-1">
                  Go to <strong>Account</strong> → <strong>Settings</strong> →{' '}
                  <strong>Privacy &amp; Security</strong>.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-semibold">
                3
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  Request Account Deletion
                </h3>
                <p className="text-gray-600 mt-1">
                  Click <strong>&quot;Delete My Account&quot;</strong> and
                  confirm your request. You will receive a confirmation email.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-semibold">
                4
              </div>
              <div>
                <h3 className="font-medium text-gray-900">
                  Alternative: Email Us
                </h3>
                <p className="text-gray-600 mt-1">
                  If you cannot access your account, email{' '}
                  <a
                    href="mailto:privacy@usebaci.com"
                    className="text-red-600 underline"
                  >
                    privacy@usebaci.com
                  </a>{' '}
                  with your account email and we will process your request
                  within 30 days.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Data Deletion Section */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            What Data is Deleted
          </h2>
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="font-medium text-gray-900 mb-3">
              Immediately Deleted:
            </h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 mb-6">
              <li>Your profile information (name, email, phone number)</li>
              <li>Saved addresses</li>
              <li>Wishlist items</li>
              <li>Shopping cart contents</li>
              <li>App preferences and settings</li>
              <li>Push notification tokens</li>
            </ul>

            <h3 className="font-medium text-gray-900 mb-3">
              Retained for Legal/Business Purposes (90 days):
            </h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2 mb-6">
              <li>
                Order history (for refunds, disputes, and warranty claims)
              </li>
              <li>Transaction records (legal/tax compliance)</li>
              <li>
                Payment information (processed by Paystack, not stored by us)
              </li>
            </ul>

            <h3 className="font-medium text-gray-900 mb-3">
              Permanently Retained (Anonymized):
            </h3>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>
                Aggregated analytics data (e.g., total orders, no personal
                identifiers)
              </li>
            </ul>
          </div>
        </section>

        {/* Timeline Section */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Deletion Timeline
          </h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <ul className="space-y-3 text-gray-700">
              <li>
                <strong>Within 24 hours:</strong> Your account is deactivated
                and you can no longer log in.
              </li>
              <li>
                <strong>Within 7 days:</strong> Personal data is permanently
                deleted from our primary systems.
              </li>
              <li>
                <strong>Within 90 days:</strong> Retained data (order history)
                is anonymized or deleted.
              </li>
              <li>
                <strong>Backups:</strong> May take up to 30 additional days to
                be purged from encrypted backups.
              </li>
            </ul>
          </div>
        </section>

        {/* Contact Section */}
        <section className="text-center border-t pt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Questions?
          </h2>
          <p className="text-gray-600">
            Contact our privacy team at{' '}
            <a
              href="mailto:privacy@usebaci.com"
              className="text-red-600 underline"
            >
              privacy@usebaci.com
            </a>
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Last updated: December 2024
          </p>
        </section>
      </div>
    </main>
  );
}

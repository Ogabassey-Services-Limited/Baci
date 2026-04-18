import { Construction, Store } from 'lucide-react';

interface StoreNotPublishedProps {
  businessName: string;
}

export function StoreNotPublished({ businessName }: StoreNotPublishedProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <div className="text-center px-4 max-w-md">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Store className="h-12 w-12 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
              <Construction className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          Coming Soon
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-2">
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            {businessName}
          </span>{' '}
          is currently setting up their store.
        </p>

        <p className="text-sm text-gray-500 dark:text-gray-500">
          Check back later to explore their products and start shopping.
        </p>

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Are you the store owner?{' '}
            <a
              href="/login"
              className="text-primary hover:underline font-medium"
            >
              Log in to your dashboard
            </a>{' '}
            to complete setup.
          </p>
        </div>
      </div>
    </div>
  );
}

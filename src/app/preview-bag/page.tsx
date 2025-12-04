import { BagIcon } from '@/components/bag-icon';
import { BagLoader } from '@/components/ui/bag-loader';

export default function PreviewBagPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-12 p-8 bg-gray-50 dark:bg-gray-900">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">Bag Icon & Loader Preview</h1>
        <p className="text-muted-foreground">
          Reviewing the extracted vector icon and new loader animation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full max-w-2xl">
        {/* Icon Section */}
        <div className="flex flex-col items-center gap-6 p-6 bg-white dark:bg-black/20 rounded-2xl shadow-sm border">
          <h2 className="text-lg font-semibold">Vector Icon</h2>
          <div className="flex items-end gap-4">
            <div className="flex flex-col items-center gap-2">
              <BagIcon width={24} height={24} />
              <span className="text-xs text-muted-foreground">24px</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <BagIcon width={48} height={48} />
              <span className="text-xs text-muted-foreground">48px</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <BagIcon width={96} height={96} />
              <span className="text-xs text-muted-foreground">96px</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Scales perfectly without pixelation.
          </p>
        </div>

        {/* Loader Section */}
        <div className="flex flex-col items-center gap-6 p-6 bg-white dark:bg-black/20 rounded-2xl shadow-sm border">
          <h2 className="text-lg font-semibold">Loading Animation</h2>
          <div className="flex items-center justify-center h-24">
            <BagLoader size={64} />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Smooth pulse animation using Framer Motion.
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { PageConfigSchema } from '@/schemas/page-blocks';

interface MobilePreviewProps {
  config: unknown;
}

export function MobilePreview({ config }: MobilePreviewProps) {
  // Validate the config against our shared schema
  const result = PageConfigSchema.safeParse(config);

  if (!result.success) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
        <p className="font-bold">Invalid Mobile Configuration</p>
        <pre className="text-xs mt-2">{result.error.message}</pre>
      </div>
    );
  }

  const { content } = result.data;

  return (
    <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-14 rounded-[2.5rem] h-[600px] w-[300px] shadow-xl">
      <div className="h-[32px] w-[3px] bg-gray-800 absolute left-[-17px] top-[72px] rounded-l-lg" />
      <div className="h-[46px] w-[3px] bg-gray-800 absolute left-[-17px] top-[124px] rounded-l-lg" />
      <div className="h-[46px] w-[3px] bg-gray-800 absolute left-[-17px] top-[178px] rounded-l-lg" />
      <div className="h-[64px] w-[3px] bg-gray-800 absolute right-[-17px] top-[142px] rounded-r-lg" />
      <div className="rounded-4xl overflow-hidden w-full h-full bg-white dark:bg-gray-900">
        <div className="h-full overflow-y-auto scrollbar-hide">
          {/* Mock Status Bar */}
          <div className="h-6 bg-black flex justify-between px-6 items-center text-[10px] text-white">
            <span>9:41</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 bg-white/20 rounded-full" />
              <div className="w-3 h-3 bg-white/20 rounded-full" />
            </div>
          </div>

          {content.map((block) => (
            <div key={block.props.id} className="border-b border-gray-100 p-2">
              <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">
                {block.type}
              </div>
              {block.type === 'Header' && (
                <div className="h-10 bg-gray-50 rounded flex items-center px-3 justify-between">
                  <span className="text-xs font-bold">
                    {block.props.storeName}
                  </span>
                  <div className="w-4 h-4 bg-gray-200 rounded-full" />
                </div>
              )}
              {block.type === 'HeroCarousel' && (
                <div className="aspect-video bg-gray-100 rounded relative overflow-hidden flex items-center justify-center">
                  <span className="text-[10px] text-gray-400">
                    {block.props.slides[0]?.title}
                  </span>
                </div>
              )}
              {block.type === 'ProductGrid' && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="aspect-square bg-gray-50 rounded" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { AD_CONFIG } from './ad-config';

interface AdUnitProps {
  placementKey: keyof typeof AD_CONFIG;
  className?: string;
}

export function AdUnit({ placementKey, className = '' }: AdUnitProps) {
  const config = AD_CONFIG[placementKey];

  if (!config) {
    return null;
  }

  return (
    <div className={`my-6 flex w-full items-center justify-center ${className}`}>
      <div className="flex flex-col items-center">
        <span className="ogabassey-ad-placeholder-text mb-1 ml-1 self-start font-medium text-[9px] uppercase tracking-widest">
          Sponsored
        </span>
        <div
          className="relative flex flex-col items-center justify-center overflow-hidden border border-gray-100 bg-gray-50 text-center shadow-sm"
          style={{
            width: '100%',
            maxWidth: `${config.width}px`,
            height: `${config.height}px`,
          }}
        >
          <div
            className="flex h-full w-full flex-col items-center justify-center p-4"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #e5e7eb 0, #e5e7eb 1px, transparent 1px, transparent 10px)',
            }}
          >
            <span className="ogabassey-ad-placeholder-text mb-1 font-bold text-xs uppercase tracking-widest">
              Ad Space
            </span>
            <span className="ogabassey-ad-placeholder-text font-medium text-[10px]">
              {config.name}
            </span>
            <span className="ogabassey-ad-placeholder-text mt-1 text-[9px]">
              {config.width}x{config.height}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface HeaderSearchProps {
  glassEffect?: boolean;
  isScrolled?: boolean;
  layout?: 'logo-left-nav-center' | 'logo-left-nav-right' | 'logo-center';
  mobile?: boolean;
  onChange: (value: string) => void;
  radius: 'none' | 'sm' | 'md' | 'full';
  style: 'outline' | 'filled' | 'minimal';
  value: string;
}

const searchClasses = {
  outline: 'bg-transparent border-input',
  filled: 'bg-muted border-transparent',
  minimal:
    'bg-transparent border-transparent border-b border-input rounded-none px-0',
};

const radiusClasses = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  full: 'rounded-full',
};

export function HeaderSearch({
  glassEffect = false,
  isScrolled = false,
  layout = 'logo-left-nav-center',
  mobile = false,
  onChange,
  radius,
  style,
  value,
}: HeaderSearchProps) {
  if (mobile) {
    return (
      <Input
        type="search"
        placeholder="Search products..."
        className="w-full placeholder:!text-current"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <div
      className={cn('hidden md:block relative max-w-xs w-full', {
        'order-3': true,
        'ml-auto': layout === 'logo-left-nav-center',
      })}
    >
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4" />
        <Input
          type="search"
          placeholder="Search..."
          className={cn(
            'pl-9 transition-all focus-visible:ring-1 placeholder:!text-current',
            searchClasses[style],
            radiusClasses[radius],
            glassEffect && !isScrolled
              ? 'bg-white/10 border-white/20 text-white'
              : ''
          )}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}

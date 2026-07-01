import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const PasswordInput = ({ className, ...props }: InputProps) => {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="relative group">
      <Input
        type={showPassword ? 'text' : 'password'}
        className={cn('pr-10', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent flex items-center justify-center transition-opacity opacity-70 hover:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
        aria-label="Show password"
        aria-pressed={showPassword}
      >
        {showPassword ? (
          <EyeOff className="size-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <Eye className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
      </button>
    </div>
  );
};
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };

'use client';

import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface AiCommandBarProps {
  onCommand: (command: string) => void;
  isLoading: boolean;
  compact?: boolean;
}

export function AiCommandBar({
  onCommand,
  isLoading,
  compact = false,
}: AiCommandBarProps) {
  const [command, setCommand] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    onCommand(command);
    setCommand('');
  };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="relative">
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Describe changes..."
            className="pr-10"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-1 top-1 h-8 w-8"
            disabled={isLoading || !command.trim()}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Try: "Change header background to blue" or "Add a hero section"
        </p>
      </form>
    );
  }

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
      <Card className="p-2 shadow-xl border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Sparkles className="w-4 h-4" />
            </div>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Describe changes with AI..."
              className="pl-9 pr-4 h-10 bg-background/50 border-transparent focus:border-primary/20 focus:bg-background transition-all"
              disabled={isLoading}
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading || !command.trim()}
            className="h-10 px-4 transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                Generate <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}

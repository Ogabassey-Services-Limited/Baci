'use client';

import { ArrowRight, Lightbulb, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface GeminiCommandBarProps {
  onCommand: (command: string) => void;
  isLoading: boolean;
  compact?: boolean;
  disabled?: boolean;
}

const SUGGESTIONS = [
  'Make the site look modern and professional',
  'Add a testimonials section with customer reviews',
  'Change the color scheme to blue and white',
  'Create a hero section with a call-to-action',
  'Add a features section highlighting our benefits',
  'Make the header sticky and dark',
  'Add social media icons to the footer',
  'Create a newsletter signup section',
  'Add a video introduction',
  'Make the site feel more luxurious',
  'Add a contact form',
  'Create a product showcase grid',
];

export function GeminiCommandBar({
  onCommand,
  isLoading,
  compact = false,
  disabled = false,
}: GeminiCommandBarProps) {
  const [command, setCommand] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || !command.trim()) return;

    onCommand(command);
    setCommand('');
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setCommand(suggestion);
    setShowSuggestions(false);
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="relative">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Tell Gemini what to change..."
              className="pl-9 pr-10 bg-linear-to-r from-purple-50 to-blue-50 border-purple-200 focus:border-purple-400 focus:ring-purple-400"
              disabled={isLoading || disabled}
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              disabled={isLoading || disabled || !command.trim()}
              aria-label="Apply Gemini command"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>

          {showSuggestions && !isLoading && !disabled && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Try these suggestions:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.slice(0, 6).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-xs px-2.5 py-1.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-colors"
                    aria-label={`Quick suggestion: ${suggestion}`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
          <p className="font-medium text-foreground">Powered by Gemini AI</p>
          <p>Try commands like:</p>
          <ul className="space-y-0.5 pl-4 list-disc">
            <li>&quot;Make the hero background blue&quot;</li>
            <li>&quot;Add a features section&quot;</li>
            <li>&quot;Change all buttons to green&quot;</li>
            <li>&quot;Make the site feel premium&quot;</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-50">
      <Card className="p-3 shadow-2xl border-purple-200 bg-linear-to-r from-white via-purple-50/50 to-blue-50/50 backdrop-blur-sm supports-[backdrop-filter]:bg-white/95">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-medium text-purple-600 hidden sm:inline">
                  Gemini AI
                </span>
              </div>
              <Input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Describe what you want to change... (e.g., 'make it blue', 'add testimonials')"
                className="pl-24 pr-4 h-12 bg-white/80 border-purple-200 focus:border-purple-400 focus:ring-purple-400 text-base"
                disabled={isLoading || disabled}
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading || disabled || !command.trim()}
              className="h-12 px-6 bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition-all"
              aria-label="Apply Gemini command"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Apply <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          {showSuggestions && !isLoading && !disabled && (
            <div className="space-y-2 animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-2 text-xs font-medium text-purple-700">
                <Lightbulb className="w-4 h-4" />
                <span>Quick suggestions:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.slice(0, 8).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-sm px-3 py-1.5 rounded-lg bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 hover:border-purple-300 transition-all shadow-sm hover:shadow"
                    aria-label={`Quick suggestion: ${suggestion}`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}

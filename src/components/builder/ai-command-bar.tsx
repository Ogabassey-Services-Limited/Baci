'use client';

import { useState } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface AiCommandBarProps {
    onCommand: (prompt: string) => Promise<void>;
    isLoading?: boolean;
}

export function AiCommandBar({ onCommand, isLoading = false }: AiCommandBarProps) {
    const [prompt, setPrompt] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isLoading) return;

        await onCommand(prompt);
        setPrompt('');
    };

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
            <Card className="p-2 shadow-xl border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Sparkles className="w-5 h-5" />
                        )}
                    </div>

                    <Input
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe changes... e.g., 'Make the search bar round' or 'Change theme to dark blue'"
                        className="flex-1 border-0 shadow-none focus-visible:ring-0 bg-transparent h-12 text-lg"
                        disabled={isLoading}
                    />

                    <Button
                        type="submit"
                        size="icon"
                        disabled={!prompt.trim() || isLoading}
                        className="rounded-full w-10 h-10"
                    >
                        <Send className="w-4 h-4" />
                        <span className="sr-only">Generate</span>
                    </Button>
                </form>
            </Card>
        </div>
    );
}

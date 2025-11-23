'use client';

import { Puck, Data } from '@measured/puck';
import '@measured/puck/puck.css';
import { builderConfig } from './config';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Loader2, Save, Globe, ArrowLeft, Smartphone, Tablet, Monitor } from 'lucide-react';
import Link from 'next/link';
import { StorefrontProvider } from '@/contexts/storefront-context';
import { useRouter } from 'next/navigation';
import { AiCommandBar } from './ai-command-bar';
import { defaultTheme, ThemeConfiguration } from '@/lib/theme-config';
import { applyTheme } from '@/lib/theme-manager';
import { ThemeEditor } from './theme-editor-redesigned';
import { Palette } from 'lucide-react';

export default function BuilderClient() {
    const [data, setData] = useState<Data | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [showThemeEditor, setShowThemeEditor] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            try {
                const res = await fetch('/api/builder?slug=home');

                // Check if response is ok
                if (!res.ok) {
                    if (res.status === 401) {
                        router.push('/login');
                        return;
                    }
                    console.error('API error:', res.status, res.statusText);
                    throw new Error(`API error: ${res.status}`);
                }

                // Check if response has content
                const text = await res.text();
                if (!text) {
                    console.log('Empty response, using default config');
                    setData({
                        content: [],
                        root: { title: 'Home' },
                        zones: {}
                    });
                    setLoading(false);
                    return;
                }

                // Parse JSON
                const json = JSON.parse(text);

                if (json.config) {
                    setData(json.config);

                    // Apply theme if it exists, otherwise use default
                    if (json.config.theme) {
                        applyTheme(json.config.theme);
                    } else {
                        applyTheme(defaultTheme);
                    }

                    // Show info if this is the default template
                    if (json.isDefault) {
                        toast({
                            title: 'Starting from your template',
                            description: 'We\'ve loaded your current storefront as a starting point. Customize it to make it your own!',
                        });
                    }
                } else {
                    // Default empty state with theme
                    const defaultData = {
                        content: [],
                        root: { title: 'Home' },
                        zones: {},
                        theme: defaultTheme
                    };
                    setData(defaultData);
                    applyTheme(defaultTheme);
                }
            } catch (error) {
                console.error('Failed to load builder data:', error);
                toast({
                    title: 'Error',
                    description: 'Failed to load page configuration. Using default template.',
                    variant: 'destructive',
                });
                // Set default data even on error
                const defaultData = {
                    content: [],
                    root: { title: 'Home' },
                    zones: {},
                    theme: defaultTheme
                };
                setData(defaultData);
                applyTheme(defaultTheme);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [toast]);

    const handleSave = async (newData: Data) => {
        setSaving(true);
        try {
            await fetch('/api/builder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: 'home',
                    name: 'Home',
                    config: newData
                })
            });

            // Don't toast on every auto-save or manual save unless explicit?
            // For now, let's just save quietly or maybe show a small indicator
        } catch (error) {
            console.error('Failed to save:', error);
            toast({
                title: 'Error',
                description: 'Failed to save changes.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!data) return;

        setPublishing(true);
        // First save current state
        await handleSave(data);

        try {
            const res = await fetch('/api/builder', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: 'home' })
            });

            if (!res.ok) throw new Error('Failed to publish');

            toast({
                title: 'Published! 🚀',
                description: 'Your changes are now live on your storefront.',
            });
        } catch (error) {
            console.error('Failed to publish:', error);
            toast({
                title: 'Error',
                description: 'Failed to publish changes.',
                variant: 'destructive',
            });
        } finally {
            setPublishing(false);
        }
    };

    const handleAiCommand = async (prompt: string) => {
        setIsAiLoading(true);
        try {
            const response = await fetch('/api/builder/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    currentConfig: data
                }),
            });

            if (!response.ok) throw new Error('Failed to process AI request');

            const result = await response.json();
            console.log('=== AI Response ===');
            console.log('Full result:', result);
            console.log('Config exists:', !!result.config);
            console.log('Current data before update:', data);

            if (result.config) {
                console.log('New config to apply:', result.config);
                console.log('Calling setData...');
                setData(result.config);

                // Apply theme if it was updated
                if (result.config.theme) {
                    applyTheme(result.config.theme);
                }

                console.log('setData called successfully');

                // Force a small delay to ensure state update
                setTimeout(() => {
                    console.log('Data after update:', data);
                }, 100);

                toast({
                    title: "Design Updated",
                    description: "AI has applied your changes.",
                });
            } else {
                console.warn('No config in AI response');
            }
        } catch (error) {
            console.error('AI Command Error:', error);
            toast({
                title: "Error",
                description: "Failed to process AI command. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsAiLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const viewports = [
        { width: 360, height: 'auto' as const, label: 'Mobile' },
        { width: 768, height: 'auto' as const, label: 'Tablet' },
        { width: 1280, height: 'auto' as const, label: 'Desktop' },
    ];

    return (
        <div className="h-screen flex flex-col bg-background">
            <header className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur z-10">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" asChild className="h-9 w-9">
                        <Link href="/dashboard">
                            <ArrowLeft className="w-4 h-4" />
                            <span className="sr-only">Back to Dashboard</span>
                        </Link>
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSave(data!)}
                        disabled={saving}
                        className="h-9"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        <span className="ml-2 hidden sm:inline">Save Draft</span>
                    </Button>
                    <Button
                        size="sm"
                        onClick={handlePublish}
                        disabled={publishing}
                        className="h-9"
                    >
                        {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                        <span className="ml-2 hidden sm:inline">Publish</span>
                    </Button>
                </div>
            </header>

            <div className="flex-1 overflow-hidden flex">
                {/* Theme Editor Sidebar */}
                {showThemeEditor && (
                    <div className="w-80 border-r bg-background overflow-hidden flex flex-col">
                        <ThemeEditor
                            theme={(data as any)?.theme || defaultTheme}
                            onChange={(newTheme: ThemeConfiguration) => {
                                setData(prev => prev ? { ...prev, theme: newTheme } as any : null);
                            }}
                            onReset={() => {
                                applyTheme(defaultTheme);
                                setData(prev => prev ? { ...prev, theme: defaultTheme } as any : null);
                            }}
                        />
                    </div>
                )}

                {/* Main Builder */}
                <div className="flex-1 relative">
                    <StorefrontProvider>
                        <Puck
                            config={builderConfig}
                            data={data || { content: [], root: { title: 'Home' }, zones: {} } as any}
                            onPublish={handlePublish}
                            onChange={setData}
                            viewports={viewports}
                        />
                    </StorefrontProvider>
                    <AiCommandBar onCommand={handleAiCommand} isLoading={isAiLoading} />

                    {/* Theme Editor Toggle Button */}
                    <button
                        onClick={() => setShowThemeEditor(!showThemeEditor)}
                        className="absolute top-4 right-4 z-50 p-2 rounded-md bg-background border shadow-sm hover:bg-accent transition-colors"
                        title={showThemeEditor ? "Hide Theme Editor" : "Show Theme Editor"}
                    >
                        <Palette className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}


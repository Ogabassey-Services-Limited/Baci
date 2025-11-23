
'use client';

import { Puck, Data } from '@measured/puck';
import '@measured/puck/puck.css';
import { builderConfig } from './config';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Loader2, Save, Globe, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AiCommandBar } from './ai-command-bar';
import { defaultTheme, ThemeConfiguration } from '@/lib/theme-config';
import { applyTheme } from '@/lib/theme-manager';
import { ThemeEditor } from './theme-editor-redesigned';
import { Palette } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useMerchant } from '@/hooks/use-merchant';

export default function BuilderClient() {
    const [data, setData] = useState<Data | null>(null);
    const [pageLoading, setPageLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [showThemeEditor, setShowThemeEditor] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { merchant, loading: merchantLoading } = useMerchant();

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            if (authLoading || merchantLoading) return;
            if (!user || !merchant) {
                setPageLoading(false);
                return;
            }

            try {
                const res = await fetch('/api/builder?slug=home');

                if (!res.ok) {
                    if (res.status === 401) {
                        router.push('/login');
                        return;
                    }
                    throw new Error(`API error: ${res.status}`);
                }

                const json = await res.json();

                if (json.config) {
                    setData(json.config);
                    if (json.config.theme) {
                        applyTheme(json.config.theme);
                    } else {
                        applyTheme(defaultTheme);
                    }
                    if (json.isDefault) {
                        toast({
                            title: 'Starting from your template',
                            description: 'We\'ve loaded your current storefront as a starting point. Customize it to make it your own!',
                        });
                    }
                } else {
                    const defaultData = {
                        content: [],
                        root: { title: 'Home' },
                        zones: {},
                        theme: defaultTheme
                    };
                    setData(defaultData);
                    applyTheme(defaultData.theme);
                }
            } catch (error) {
                console.error('Failed to load builder data:', error);
                toast({
                    title: 'Error',
                    description: 'Failed to load page configuration. Using default template.',
                    variant: 'destructive',
                });
                const defaultData = {
                    content: [],
                    root: { title: 'Home' },
                    zones: {},
                    theme: defaultTheme
                };
                setData(defaultData);
                applyTheme(defaultData.theme);
            } finally {
                setPageLoading(false);
            }
        };

        loadData();
    }, [user, merchant, authLoading, merchantLoading, router, toast]);

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

            if (result.config) {
                setData(result.config);
                if (result.config.theme) {
                    applyTheme(result.config.theme);
                }
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

    if (authLoading || merchantLoading || pageLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!user || !merchant) {
         return (
            <div className="flex h-screen items-center justify-center">
                <p>Redirecting to login...</p>
            </div>
        );
    }

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

                <div className="flex-1 relative">
                        <Puck
                            config={builderConfig}
                            data={data || { content: [], root: { title: 'Home' }, zones: {} } as any}
                            onPublish={handlePublish}
                            onChange={setData}
                        />
                    <AiCommandBar onCommand={handleAiCommand} isLoading={isAiLoading} />

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

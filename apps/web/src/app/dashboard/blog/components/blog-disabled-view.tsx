import { PenTool } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function BlogDisabledView() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
                <p className="text-muted-foreground">
                    Create and manage blog posts for your store
                </p>
            </div>

            <Card>
                <CardContent className="py-16">
                    <div className="text-center max-w-md mx-auto">
                        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
                            <PenTool className="w-8 h-8 text-accent" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Blog Feature</h2>
                        <p className="text-muted-foreground mb-6">
                            Create blog posts to drive traffic, improve SEO, and rank on
                            Google Discover. Enable the blog feature to get started.
                        </p>
                        <Button asChild>
                            <Link href="/dashboard/settings">Enable Blog Feature</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

'use client';

import { AlertCircle } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface OrderStateCardProps {
  title: string;
  message: string;
  actionLabel: string;
  actionHref: Route;
}

export function OrderStateCard(props: OrderStateCardProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Card className="border-destructive/50">
          <CardContent className="p-10 text-center">
            <AlertCircle className="mx-auto mb-4 h-14 w-14 text-destructive/60" />
            <h1 className="mb-2 text-xl font-semibold">{props.title}</h1>
            <p className="mb-6 text-muted-foreground">{props.message}</p>
            <Button asChild variant="outline">
              <Link href={props.actionHref}>{props.actionLabel}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { fetchGoogleSheet } from '@/app/dashboard/products/actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface GoogleSheetImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (csvContent: string, url: string, saveUrl: boolean) => void;
  initialUrl?: string;
}

export function GoogleSheetImportDialog({
  open,
  onOpenChange,
  onImport,
  initialUrl = '',
}: GoogleSheetImportDialogProps) {
  const [url, setUrl] = useState(initialUrl);
  const [saveUrl, setSaveUrl] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const wasOpenRef = useRef(open);
  const { toast } = useToast();

  // Sync URL when the dialog is opened to avoid clobbering in-progress edits.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setUrl(initialUrl);
    }
    wasOpenRef.current = open;
  }, [open, initialUrl]);

  const handleImport = async () => {
    if (!url) return;

    setIsLoading(true);
    try {
      const csvContent = await fetchGoogleSheet(url);
      onImport(csvContent, url, saveUrl);
      onOpenChange(false);
      // Don't clear URL if we saved it, keeps it ready for next time
      if (!saveUrl) setUrl('');

      toast({
        title: 'Success',
        description: 'Google Sheet imported successfully.',
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Import Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to import Google Sheet',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import from Google Sheet</DialogTitle>
          <DialogDescription>
            Sync your products directly from a Google Sheet.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="url">Google Sheet URL</Label>
            <Input
              id="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
            />

            <div className="text-xs text-muted-foreground space-y-2 mt-2 bg-muted/50 p-3 rounded-md border">
              <p className="font-medium text-foreground">
                Permissions Required (Desktop Only):
              </p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Go to your Google Sheet (on a computer)</li>
                <li>
                  Click <strong>File &gt; Share &gt; Publish to web</strong>
                </li>
                <li>
                  Important: Change from "Web page" to{' '}
                  <strong>Comma-separated values (.csv)</strong>
                </li>
                <li>Click Publish, copy that link, and paste it above</li>
              </ol>
              <p className="text-amber-600 dark:text-amber-400 mt-2">
                ⚠️ Private sheets are not supported yet.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-x-2">
            <Checkbox
              id="saveUrl"
              checked={saveUrl}
              onCheckedChange={(c) => setSaveUrl(!!c)}
            />
            <label
              htmlFor="saveUrl"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Save this URL for 1-click sync updates
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isLoading || !url}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Importing…
              </>
            ) : (
              'Import & Analyze'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

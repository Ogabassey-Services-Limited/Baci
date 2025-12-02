import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { fetchGoogleSheet } from '@/app/dashboard/products/actions';
import { Button } from '@/components/ui/button';
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
  onImport: (csvContent: string) => void;
}

export function GoogleSheetImportDialog({
  open,
  onOpenChange,
  onImport,
}: GoogleSheetImportDialogProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleImport = async () => {
    if (!url) return;

    setIsLoading(true);
    try {
      const csvContent = await fetchGoogleSheet(url);
      onImport(csvContent);
      onOpenChange(false);
      setUrl('');
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import from Google Sheet</DialogTitle>
          <DialogDescription>
            Enter the URL of your Google Sheet. Ensure the sheet is "Published
            to the web" (File &gt; Share &gt; Publish to web) or publicly
            accessible.
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              'Import'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

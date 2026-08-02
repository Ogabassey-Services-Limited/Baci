import { toast } from '@/hooks/use-toast';

export function validateImageUpload(file: File) {
  if (!file.type.startsWith('image/')) {
    toast({
      title: 'Error',
      description: 'File type not supported.',
      variant: 'destructive',
    });
    return false;
  }
  if (file.size / 1024 / 1024 > 20) {
    toast({
      title: 'Error',
      description: 'File size too big (max 20MB).',
      variant: 'destructive',
    });
    return false;
  }

  return true;
}

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function NewBlogPostRecoveryDialog({
  open,
  setOpen,
  onDiscard,
  onRecover,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onDiscard: () => void;
  onRecover: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recover Draft?</AlertDialogTitle>
          <AlertDialogDescription>
            We found an unsaved draft from a previous session. Would you like to
            restore it?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard}>Discard</AlertDialogCancel>
          <AlertDialogAction onClick={onRecover}>
            Recover Draft
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

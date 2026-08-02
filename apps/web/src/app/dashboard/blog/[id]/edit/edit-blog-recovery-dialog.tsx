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

export function EditBlogRecoveryDialog({
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
          <AlertDialogTitle>Recover Unsaved Changes?</AlertDialogTitle>
          <AlertDialogDescription>
            We found unsaved changes from a previous session. Would you like to
            restore them?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard}>Discard</AlertDialogCancel>
          <AlertDialogAction onClick={onRecover}>
            Recover Changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

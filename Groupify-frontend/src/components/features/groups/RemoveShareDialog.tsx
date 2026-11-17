import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../ui/alert-dialog";
import { SHEET_Z_INDEX } from "../../ui/sheet";

interface RemoveShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackName: string;
  onRemove: () => void;
}

/** Confirms removing a share, from the song row's menu or the song detail. */
export default function RemoveShareDialog({ open, onOpenChange, trackName, onRemove }: RemoveShareDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* Above the song sheet on phones, which it can open from, scrim included. */}
      <AlertDialogContent style={{ zIndex: SHEET_Z_INDEX + 1 }} overlayStyle={{ zIndex: SHEET_Z_INDEX + 1 }}>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove song from group?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove "{trackName}" from the group feed. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onRemove} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

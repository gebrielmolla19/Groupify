import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../ui/alert-dialog";
import { SHEET_Z_INDEX } from "../../ui/sheet";
import { buttonVariants } from "../../ui/button";

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
          <AlertDialogTitle>Remove this song?</AlertDialogTitle>
          <AlertDialogDescription>
            "{trackName}" leaves the group feed for everyone. You can't undo this.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onRemove} className={buttonVariants({ variant: "destructive" })}>
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

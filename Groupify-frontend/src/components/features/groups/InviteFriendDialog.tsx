import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { logger } from '../../../utils/logger';

interface InviteFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onInviteSent?: () => void;
  onSendInvite: (groupId: string, spotifyId: string) => Promise<any>;
  isSubmitting?: boolean;
}

export default function InviteFriendDialog({
  open,
  onOpenChange,
  groupId,
  onInviteSent,
  onSendInvite,
  isSubmitting = false,
}: InviteFriendDialogProps) {
  const [spotifyId, setSpotifyId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate input
    if (!spotifyId.trim()) {
      setError('Spotify User ID is required');
      return;
    }

    try {
      await onSendInvite(groupId, spotifyId.trim());

      // Reset form and close dialog on success
      setSpotifyId('');
      setError(null);
      onOpenChange(false);
      onInviteSent?.();
    } catch (error) {
      // Error is already handled by the hook (toast notification)
      logger.error('Failed to send invite:', error);
    }
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      setSpotifyId('');
      setError(null);
      onOpenChange(false);
    }
  };

  const handleSpotifyIdChange = (value: string) => {
    setSpotifyId(value);
    if (error) {
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Invite a Friend</DialogTitle>
          <DialogDescription>
            Enter your friend's Spotify User ID to invite them to this group.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Spotify User ID Input */}
            <div className="space-y-2">
              <Label htmlFor="spotify-user-id">
                Spotify User ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="spotify-user-id"
                placeholder="Enter Spotify User ID"
                value={spotifyId}
                onChange={(e) => handleSpotifyIdChange(e.target.value)}
                disabled={isSubmitting}
                className={error ? 'border-destructive' : ''}
                aria-invalid={!!error}
                aria-describedby={error ? 'spotify-id-error' : undefined}
              />
              {error && (
                <p id="spotify-id-error" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                You can find a user's Spotify ID in their profile URL or by asking them.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-black w-full sm:w-auto min-h-[44px]"
              disabled={isSubmitting || !spotifyId.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invite'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


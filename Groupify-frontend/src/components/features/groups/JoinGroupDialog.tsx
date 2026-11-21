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

interface JoinGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoinGroup: (inviteCode: string) => Promise<any>;
  isSubmitting?: boolean;
  /** Shows "Start a new group instead", which should close this and open the create dialog. */
  onCreateInstead?: () => void;
}

export default function JoinGroupDialog({
  open,
  onOpenChange,
  onJoinGroup,
  isSubmitting = false,
  onCreateInstead,
}: JoinGroupDialogProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate input
    if (!inviteCode.trim()) {
      setError('Join code is required');
      return;
    }

    if (inviteCode.trim().length !== 16) {
      setError('Join code must be exactly 16 characters');
      return;
    }

    try {
      await onJoinGroup(inviteCode.trim().toUpperCase());

      // Reset form and close dialog on success
      setInviteCode('');
      setError(null);
      onOpenChange(false);
    } catch (error) {
      // Error is already handled by the hook (toast notification)
      const errorMessage = error instanceof Error ? error.message : 'Failed to join group';
      setError(errorMessage);
      logger.error('Failed to join group:', error);
    }
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      setInviteCode('');
      setError(null);
      onOpenChange(false);
    }
  };

  const handleInviteCodeChange = (value: string) => {
    // Convert to uppercase and limit to 16 characters
    const upperValue = value.toUpperCase().slice(0, 16);
    setInviteCode(upperValue);
    if (error) {
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a group</DialogTitle>
          <DialogDescription>Paste the 16-character code a friend sent you.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="invite-code" className="text-soft">Join code</Label>
              <span className="font-mono text-xs text-quiet" aria-hidden="true">{inviteCode.length}/16</span>
            </div>
            <Input
              id="invite-code"
              placeholder="XXXXXXXXXXXXXXXX"
              value={inviteCode}
              onChange={(e) => handleInviteCodeChange(e.target.value)}
              disabled={isSubmitting}
              className="font-mono tracking-[0.06em]"
              maxLength={16}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              aria-invalid={!!error}
              aria-describedby={error ? 'invite-code-error' : undefined}
              autoFocus
            />
            {error && (
              <p id="invite-code-error" className="text-sm text-danger">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="items-stretch sm:items-center">
            {onCreateInstead && (
              <Button type="button" variant="link" className="px-0 sm:mr-auto" onClick={onCreateInstead} disabled={isSubmitting}>
                Start a new group instead
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || inviteCode.trim().length !== 16}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Joining…
                </>
              ) : (
                'Join group'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

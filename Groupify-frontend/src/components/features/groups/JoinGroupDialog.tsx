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
}

export default function JoinGroupDialog({
  open,
  onOpenChange,
  onJoinGroup,
  isSubmitting = false,
}: JoinGroupDialogProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate input
    if (!inviteCode.trim()) {
      setError('Invite code is required');
      return;
    }

    if (inviteCode.trim().length !== 16) {
      setError('Invite code must be exactly 16 characters');
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
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Join a Group</DialogTitle>
          <DialogDescription>
            Enter the 16-character invite code to join a music sharing group.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Invite Code Input */}
            <div className="space-y-2">
              <Label htmlFor="invite-code">
                Invite Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invite-code"
                placeholder="Enter 16-character code"
                value={inviteCode}
                onChange={(e) => handleInviteCodeChange(e.target.value)}
                disabled={isSubmitting}
                className={error ? 'border-destructive' : ''}
                maxLength={16}
                aria-invalid={!!error}
                aria-describedby={error ? 'invite-code-error' : undefined}
                autoFocus
              />
              {error && (
                <p id="invite-code-error" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {inviteCode.length}/16 characters
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
              disabled={isSubmitting || !inviteCode.trim() || inviteCode.trim().length !== 16}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                'Join Group'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


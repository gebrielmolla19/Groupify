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
import { Textarea } from '../../ui/textarea';
import { Label } from '../../ui/label';
import { logger } from '../../../utils/logger';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateGroup: (data: { name: string; description?: string }) => Promise<any>;
  /** Shows "Have a code? Join instead", which should close this and open the join dialog. */
  onJoinInstead?: () => void;
}

export default function CreateGroupDialog({
  open,
  onOpenChange,
  onCreateGroup,
  onJoinInstead,
}: CreateGroupDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

  const validateForm = (): boolean => {
    const newErrors: { name?: string; description?: string } = {};

    // Validate name
    if (!name.trim()) {
      newErrors.name = 'Group name is required';
    } else if (name.trim().length < 3) {
      newErrors.name = 'Group name must be at least 3 characters';
    } else if (name.trim().length > 100) {
      newErrors.name = 'Group name cannot exceed 100 characters';
    }

    // Validate description
    if (description.trim().length > 500) {
      newErrors.description = 'Description cannot exceed 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateGroup({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      // Reset form and close dialog on success
      setName('');
      setDescription('');
      setErrors({});
      onOpenChange(false);
    } catch (error) {
      // Error is already handled by the hook (toast notification)
      logger.error('Failed to create group:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      setName('');
      setDescription('');
      setErrors({});
      onOpenChange(false);
    }
  };

  // Update error state when user types
  const handleNameChange = (value: string) => {
    setName(value);
    if (errors.name) {
      setErrors(prev => ({ ...prev, name: undefined }));
    }
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    if (errors.description) {
      setErrors(prev => ({ ...prev, description: undefined }));
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a group</DialogTitle>
          <DialogDescription>Name it, then invite people or share its join code.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="group-name" className="text-soft">Name</Label>
                <span className="font-mono text-xs text-quiet" aria-hidden="true">{name.length}/100</span>
              </div>
              <Input
                id="group-name"
                placeholder="Late Night Rotation"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={isSubmitting}
                maxLength={100}
                required
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <p id="name-error" className="text-sm text-danger">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="group-description" className="text-soft">Description (optional)</Label>
                <span className="font-mono text-xs text-quiet" aria-hidden="true">{description.length}/500</span>
              </div>
              <Textarea
                id="group-description"
                placeholder="What goes in here?"
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                disabled={isSubmitting}
                rows={2}
                maxLength={500}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? 'description-error' : undefined}
              />
              {errors.description && (
                <p id="description-error" className="text-sm text-danger">
                  {errors.description}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="items-stretch sm:items-center">
            {onJoinInstead && (
              <Button type="button" variant="link" className="px-0 sm:mr-auto" onClick={onJoinInstead} disabled={isSubmitting}>
                Have a code? Join instead
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Creating…
                </>
              ) : (
                'Create group'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

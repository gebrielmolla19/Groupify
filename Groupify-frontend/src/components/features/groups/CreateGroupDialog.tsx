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
}

export default function CreateGroupDialog({
  open,
  onOpenChange,
  onCreateGroup,
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
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
          <DialogDescription>
            Create a music sharing group to connect with friends and discover new tracks together.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Group Name Input */}
            <div className="space-y-2">
              <Label htmlFor="group-name">
                Group Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="group-name"
                placeholder="Enter group name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={isSubmitting}
                className={errors.name ? 'border-destructive' : ''}
                maxLength={100}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <p id="name-error" className="text-sm text-destructive">
                  {errors.name}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {name.length}/100 characters
              </p>
            </div>

            {/* Description Input */}
            <div className="space-y-2">
              <Label htmlFor="group-description">
                Description <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Textarea
                id="group-description"
                placeholder="Describe your group's vibe or purpose"
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                disabled={isSubmitting}
                className={errors.description ? 'border-destructive' : ''}
                rows={3}
                maxLength={500}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? 'description-error' : undefined}
              />
              {errors.description && (
                <p id="description-error" className="text-sm text-destructive">
                  {errors.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {description.length}/500 characters
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
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Group'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


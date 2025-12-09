import { useState } from 'react';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import AppSidebar from './AppSidebar';
import { NavigateFunction, Group } from '../types';
import { useGroups } from '../hooks/useGroups';

interface JoinGroupScreenProps {
  onNavigate: NavigateFunction;
}

export default function JoinGroupScreen({ onNavigate }: JoinGroupScreenProps) {
  const { joinGroupByCode } = useGroups();
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      setIsSubmitting(true);
      const joinedGroup = await joinGroupByCode(inviteCode.trim().toUpperCase());
      
      // Navigate to group feed with the joined group
      onNavigate('group-feed', joinedGroup);
    } catch (err) {
      // Error is already handled by the hook (toast notification)
      const errorMessage = err instanceof Error ? err.message : 'Failed to join group';
      setError(errorMessage);
      console.error('Failed to join group:', err);
    } finally {
      setIsSubmitting(false);
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
    <div className="flex min-h-screen w-full">
      <AppSidebar currentScreen="join-group" onNavigate={onNavigate} />
      <div className="flex-1 w-full min-w-0">
        <div className="container max-w-2xl mx-auto px-4 py-8 md:py-12">
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate('dashboard')}
              className="mb-4 hover:bg-primary/10"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </Button>
            <h1 className="text-3xl font-bold mb-2">Join a Group</h1>
            <p className="text-muted-foreground">
              Enter the invite code to join a music sharing group
            </p>
          </div>

          {/* Join Form Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Enter Invite Code
              </CardTitle>
              <CardDescription>
                Ask the group owner for the 16-character invite code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
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

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-black"
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
              </form>
            </CardContent>
          </Card>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an invite code? Ask a group member to share it with you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


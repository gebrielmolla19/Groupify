import { useState, useEffect, useCallback } from 'react';
import { Invite, Group } from '../types';
import {
  getUserInvites as apiGetUserInvites,
  acceptInvite as apiAcceptInvite,
  declineInvite as apiDeclineInvite
} from '../lib/api';
import { toast } from 'sonner';

/**
 * Hook to manage user's pending invites across all groups
 */
export const useUserInvites = () => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all pending invites for the current user
   */
  const fetchInvites = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedInvites = await apiGetUserInvites();
      setInvites(fetchedInvites);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch invites';
      setError(errorMessage);
      console.error('Failed to fetch user invites:', err);
      // Don't show toast on initial load to avoid spam
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Accept an invite
   */
  const acceptInvite = useCallback(async (groupId: string, inviteId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const updatedGroup = await apiAcceptInvite(groupId, inviteId);
      
      // Refresh invites list
      await fetchInvites();
      
      toast.success('Invite accepted successfully');
      return updatedGroup;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to accept invite';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchInvites]);

  /**
   * Decline an invite
   */
  const declineInvite = useCallback(async (groupId: string, inviteId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await apiDeclineInvite(groupId, inviteId);
      
      // Refresh invites list
      await fetchInvites();
      
      toast.success('Invite declined successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to decline invite';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchInvites]);

  // Fetch invites on mount
  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  return {
    invites,
    isLoading,
    error,
    fetchInvites,
    acceptInvite,
    declineInvite
  };
};


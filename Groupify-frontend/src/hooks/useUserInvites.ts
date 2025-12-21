import { useState, useEffect, useCallback } from 'react';
import { Invite, Group } from '../types';
import {
  getUserInvites as apiGetUserInvites,
  acceptInvite as apiAcceptInvite,
  declineInvite as apiDeclineInvite,
  getToken
} from '../lib/api';
import { toast } from 'sonner';
import { useUser } from '../contexts/UserContext';
import { logger } from '../utils/logger';

/**
 * Hook to manage user's pending invites across all groups
 */
export const useUserInvites = () => {
  const { isAuthenticated } = useUser();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all pending invites for the current user
   */
  const fetchInvites = useCallback(async () => {
    // Don't fetch if user is not authenticated
    if (!isAuthenticated || !getToken()) {
      setIsLoading(false);
      setInvites([]);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const fetchedInvites = await apiGetUserInvites();
      setInvites(fetchedInvites);
    } catch (err) {
      // Handle "no token" errors gracefully (user is logged out)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch invites';
      if (errorMessage.includes('token') || errorMessage.includes('authentication') || (err as any)?.status === 401) {
        // User is logged out, clear invites silently
        setInvites([]);
        setError(null);
      } else {
        setError(errorMessage);
        logger.error('Failed to fetch user invites:', err);
      }
      // Don't show toast on initial load to avoid spam
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

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

  // Clear invites when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setInvites([]);
      setError(null);
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  return {
    invites,
    isLoading,
    error,
    fetchInvites,
    acceptInvite,
    declineInvite
  };
};


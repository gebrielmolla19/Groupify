import { useState, useCallback } from 'react';
import { Invite } from '../types';
import {
  createInvite as apiCreateInvite,
  acceptInvite as apiAcceptInvite,
  declineInvite as apiDeclineInvite,
  getGroupInvites as apiGetGroupInvites
} from '../lib/api';
import { toast } from 'sonner';

export const useGroupInvites = () => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch invites for a group
   */
  const fetchInvites = useCallback(async (groupId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedInvites = await apiGetGroupInvites(groupId);
      setInvites(fetchedInvites);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch invites';
      setError(errorMessage);
      console.error('Failed to fetch invites:', err);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Send an invite to a user
   */
  const sendInvite = useCallback(async (groupId: string, spotifyId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const newInvite = await apiCreateInvite(groupId, spotifyId);
      
      // Refresh invites list
      await fetchInvites(groupId);
      
      toast.success('Invite sent successfully');
      return newInvite;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invite';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchInvites]);

  /**
   * Accept an invite
   */
  const acceptInvite = useCallback(async (groupId: string, inviteId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const updatedGroup = await apiAcceptInvite(groupId, inviteId);
      
      // Refresh invites list
      await fetchInvites(groupId);
      
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
      await fetchInvites(groupId);
      
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

  return {
    invites,
    isLoading,
    error,
    fetchInvites,
    sendInvite,
    acceptInvite,
    declineInvite
  };
};


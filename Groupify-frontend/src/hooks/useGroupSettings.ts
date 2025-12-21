import { useState, useCallback, useMemo } from 'react';
import { GroupSettings } from '../types';
import {
  getGroupSettings as apiGetGroupSettings,
  updateGroupSettings as apiUpdateGroupSettings,
  removeGroupMember as apiRemoveGroupMember,
  deleteGroup as apiDeleteGroup,
  leaveGroup as apiLeaveGroup
} from '../lib/api';
import { toast } from 'sonner';
import { useUser } from '../contexts/UserContext';

export const useGroupSettings = (groupId: string, ownerId?: string) => {
  const { user } = useUser();
  const [settings, setSettings] = useState<GroupSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute isOwner from current user and ownerId
  const isOwner = useMemo(() => {
    if (!user || !ownerId) return false;
    return user._id === ownerId;
  }, [user, ownerId]);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedSettings = await apiGetGroupSettings(groupId);
      setSettings(fetchedSettings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch group settings';
      setError(errorMessage);
      console.error('Failed to fetch group settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  const updateSettings = useCallback(async (updates: { name?: string; description?: string }) => {
    try {
      setIsLoading(true);
      setError(null);
      const updatedSettings = await apiUpdateGroupSettings(groupId, updates);
      setSettings(updatedSettings);
      toast.success('Group settings updated successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update group settings';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  const removeMember = useCallback(async (memberId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await apiRemoveGroupMember(groupId, memberId);
      toast.success('Member removed successfully');
      // Refetch settings to update members list
      await fetchSettings();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove member';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [groupId, fetchSettings]);

  const deleteGroup = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await apiDeleteGroup(groupId);
      toast.success(result.message || 'Group deleted successfully');
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete group';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  const leaveGroup = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await apiLeaveGroup(groupId);
      toast.success(result.message || 'Left group successfully');
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to leave group';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  return {
    settings,
    isLoading,
    error,
    fetchSettings,
    updateSettings,
    removeMember,
    deleteGroup,
    leaveGroup,
    isOwner
  };
};


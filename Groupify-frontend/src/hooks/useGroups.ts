import { useState, useEffect, useCallback } from 'react';
import { Group } from '../types';
import {
  getUserGroups as apiGetUserGroups,
  createGroup as apiCreateGroup,
  joinGroupByCode as apiJoinGroupByCode,
  joinGroup as apiJoinGroup,
  leaveGroup as apiLeaveGroup,
  getToken
} from '../lib/api';
import { toast } from 'sonner';
import { useUser } from '../contexts/UserContext';
import { logger } from '../utils/logger';

export const useGroups = () => {
  const { isAuthenticated } = useUser();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    // Don't fetch if user is not authenticated
    if (!isAuthenticated || !getToken()) {
      setIsLoading(false);
      setGroups([]);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const fetchedGroups = await apiGetUserGroups();
      setGroups(fetchedGroups);
    } catch (err) {
      // Handle "no token" errors gracefully (user is logged out)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch groups';
      if (errorMessage.includes('token') || errorMessage.includes('authentication') || errorMessage.includes('401')) {
        // User is logged out, clear groups silently
        setGroups([]);
        setError(null);
      } else {
        setError(errorMessage);
        logger.error('Failed to fetch groups:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const createGroup = useCallback(async (data: { name: string; description?: string }) => {
    try {
      const newGroup = await apiCreateGroup(data);
      setGroups(prev => [newGroup, ...prev]);
      logger.info('Group created:', { groupId: newGroup._id, name: newGroup.name });
      toast.success('Group created successfully');
      return newGroup;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create group';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  const joinGroupByCode = useCallback(async (inviteCode: string) => {
    try {
      const joinedGroup = await apiJoinGroupByCode(inviteCode);
      setGroups(prev => [joinedGroup, ...prev]);
      logger.info('Group joined:', { groupId: joinedGroup._id, name: joinedGroup.name });
      toast.success('Successfully joined group');
      return joinedGroup;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join group';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  const joinGroup = useCallback(async (groupId: string, inviteCode: string) => {
    try {
      const joinedGroup = await apiJoinGroup(groupId, inviteCode);
      setGroups(prev => [joinedGroup, ...prev]);
      logger.info('Group joined:', { groupId: joinedGroup._id, name: joinedGroup.name });
      toast.success('Successfully joined group');
      return joinedGroup;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join group';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  const leaveGroup = useCallback(async (groupId: string) => {
    try {
      await apiLeaveGroup(groupId);
      setGroups(prev => prev.filter(g => g._id !== groupId));
      logger.info('Group left:', { groupId });
      toast.success('Successfully left group');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to leave group';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Clear groups when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setGroups([]);
      setError(null);
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  return {
    groups,
    isLoading,
    error,
    fetchGroups,
    createGroup,
    joinGroupByCode,
    joinGroup,
    leaveGroup,
    refetch: fetchGroups
  };
};


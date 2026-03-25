/**
 * Groups Context
 * Provides shared group state across all consumers to avoid duplicate API requests.
 * All components that previously called useGroups() independently now share a single
 * fetch and a single state via this context.
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
import { useUser } from './UserContext';
import { logger } from '../utils/logger';

interface GroupsContextType {
  groups: Group[];
  isLoading: boolean;
  error: string | null;
  fetchGroups: () => Promise<void>;
  refetch: () => Promise<void>;
  createGroup: (data: { name: string; description?: string }) => Promise<Group>;
  joinGroupByCode: (inviteCode: string) => Promise<Group>;
  joinGroup: (groupId: string, inviteCode: string) => Promise<Group>;
  leaveGroup: (groupId: string) => Promise<void>;
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
}

const GroupsContext = createContext<GroupsContextType | undefined>(undefined);

interface GroupsProviderProps {
  children: ReactNode;
}

export function GroupsProvider({ children }: GroupsProviderProps) {
  const { isAuthenticated } = useUser();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    // Don't fetch if user is not authenticated or token is missing
    const token = getToken();
    if (!isAuthenticated || !token) {
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
      // Handle network errors and auth errors gracefully
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch groups';

      // Check if it's a network error (Failed to fetch) or auth error
      if (
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('token') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('401') ||
        errorMessage.includes('403')
      ) {
        // User is logged out or network issue - clear groups silently
        setGroups([]);
        setError(null);
        // Only log if it's not a simple "no auth" case
        if (!errorMessage.includes('Failed to fetch')) {
          logger.debug('Groups fetch skipped - user not authenticated');
        }
      } else {
        // Real error - log it
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

  const value: GroupsContextType = {
    groups,
    isLoading,
    error,
    fetchGroups,
    refetch: fetchGroups,
    createGroup,
    joinGroupByCode,
    joinGroup,
    leaveGroup,
    setGroups,
  };

  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}

export function useGroupsContext() {
  const context = useContext(GroupsContext);
  if (context === undefined) {
    throw new Error('useGroupsContext must be used within a GroupsProvider');
  }
  return context;
}

import { useState, useEffect, useCallback } from 'react';
import { Group } from '../types';
import {
  getUserGroups as apiGetUserGroups,
  createGroup as apiCreateGroup,
  joinGroupByCode as apiJoinGroupByCode,
  joinGroup as apiJoinGroup,
  leaveGroup as apiLeaveGroup
} from '../lib/api';
import { toast } from 'sonner';

export const useGroups = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedGroups = await apiGetUserGroups();
      setGroups(fetchedGroups);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch groups';
      setError(errorMessage);
      console.error('Failed to fetch groups:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createGroup = useCallback(async (data: { name: string; description?: string }) => {
    try {
      const newGroup = await apiCreateGroup(data);
      setGroups(prev => [newGroup, ...prev]);
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


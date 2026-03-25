/**
 * useGroups hook
 * Delegates to GroupsContext so all components share a single fetch and state.
 * The original logic lives in GroupsContext.tsx.
 */
import { useGroupsContext } from '../contexts/GroupsContext';

export const useGroups = () => {
  return useGroupsContext();
};

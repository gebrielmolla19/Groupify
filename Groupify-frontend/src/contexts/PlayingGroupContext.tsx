/**
 * Playing Group Context
 * Tracks which group's playlist is currently being played
 */

import { createContext, useContext, useState, ReactNode } from 'react';
import { Group } from '../types';
import { SortOption } from '../hooks/usePlaylist';

interface PlayingGroupContextType {
  playingGroup: Group | null;
  setPlayingGroup: (group: Group | null) => void;
  sortBy: SortOption;
  setSortBy: (sortBy: SortOption) => void;
}

const PlayingGroupContext = createContext<PlayingGroupContextType | undefined>(undefined);

interface PlayingGroupProviderProps {
  children: ReactNode;
}

export function PlayingGroupProvider({ children }: PlayingGroupProviderProps) {
  const [playingGroup, setPlayingGroup] = useState<Group | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('most-listened');

  const value: PlayingGroupContextType = {
    playingGroup,
    setPlayingGroup,
    sortBy,
    setSortBy,
  };

  return <PlayingGroupContext.Provider value={value}>{children}</PlayingGroupContext.Provider>;
}

export function usePlayingGroup() {
  const context = useContext(PlayingGroupContext);
  if (context === undefined) {
    throw new Error('usePlayingGroup must be used within a PlayingGroupProvider');
  }
  return context;
}


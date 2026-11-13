import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'groupify-last-group';

/** The group ID in a /groups/:id(/...) path, or null. */
export function groupIdFromPath(pathname: string): string | null {
  return pathname.match(/^\/groups\/([^/]+)/)?.[1] ?? null;
}

function readLastGroup(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    logger.warn('Could not read the last opened group', err);
    return null;
  }
}

/**
 * The group the user last had open, remembered on this device, so the phone
 * Groups tab can take them back to it.
 */
export function useLastGroup(): string | null {
  const { pathname } = useLocation();
  const current = groupIdFromPath(pathname);

  useEffect(() => {
    if (!current) return;
    try {
      localStorage.setItem(STORAGE_KEY, current);
    } catch (err) {
      logger.warn('Could not save the last opened group', err);
    }
  }, [current]);

  return current ?? readLastGroup();
}

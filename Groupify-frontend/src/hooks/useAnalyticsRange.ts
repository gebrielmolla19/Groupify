import { useCallback, useState } from 'react';
import { ANALYTICS_RANGES, type AnalyticsRange } from '../types/analytics';
import { logger } from '../utils/logger';

export const ANALYTICS_RANGE_STORAGE_KEY = 'groupify-analytics-range';
const DEFAULT_RANGE: AnalyticsRange = '30d';

const isAnalyticsRange = (value: unknown): value is AnalyticsRange =>
  (ANALYTICS_RANGES as readonly unknown[]).includes(value);

function readSavedRange(): AnalyticsRange {
  try {
    const saved = localStorage.getItem(ANALYTICS_RANGE_STORAGE_KEY);
    // Anything else (nothing saved, or an old value such as 24h) starts on the default.
    return isAnalyticsRange(saved) ? saved : DEFAULT_RANGE;
  } catch (error) {
    logger.warn('[useAnalyticsRange] Could not read the saved range; using 30d', error);
    return DEFAULT_RANGE;
  }
}

/**
 * The period Group Dynamics shows, shared by every section on the page.
 * Remembered in this browser so the next visit opens on the same period.
 */
export function useAnalyticsRange(): [AnalyticsRange, (range: AnalyticsRange) => void] {
  const [range, setRangeState] = useState<AnalyticsRange>(readSavedRange);

  const setRange = useCallback((next: AnalyticsRange) => {
    setRangeState(next);
    try {
      localStorage.setItem(ANALYTICS_RANGE_STORAGE_KEY, next);
    } catch (error) {
      // The page still switches; only the next visit won't remember it.
      logger.warn('[useAnalyticsRange] Could not save the range', error);
    }
  }, []);

  return [range, setRange];
}

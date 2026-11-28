import { useCallback, useEffect, useRef, useState } from 'react';
import { getBetweenYou } from '../lib/api';
import { ApiError } from '../lib/apiError';
import { logger } from '../utils/logger';
import type { BetweenYou, ViewerSummaryRange } from '../types/analytics';

/**
 * The "Between you" section of Group Dynamics for the signed-in member.
 * `memberId` picks the other member for the pair view; leave it undefined to
 * let the server pick. Load failures come back as `error`, with the HTTP
 * `errorStatus` when there was one (0 otherwise); no toast.
 */
export const useBetweenYou = (
  groupId: string | undefined,
  range: ViewerSummaryRange,
  memberId: string | undefined
) => {
  const [data, setData] = useState<BetweenYou | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  // Only the latest request may write state, so a slow answer for an old
  // range or member never replaces a newer one.
  const latestRequest = useRef(0);

  const fetchBetween = useCallback(async () => {
    if (!groupId) {
      setIsLoading(false);
      return;
    }
    const request = ++latestRequest.current;
    setIsLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      const result = await getBetweenYou(groupId, range, memberId);
      if (request === latestRequest.current) setData(result);
    } catch (err) {
      logger.error('Failed to fetch Between you:', err);
      if (request === latestRequest.current) {
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to fetch Between you');
        setErrorStatus(err instanceof ApiError ? err.status : 0);
      }
    } finally {
      if (request === latestRequest.current) setIsLoading(false);
    }
  }, [groupId, range, memberId]);

  useEffect(() => {
    fetchBetween();
  }, [fetchBetween]);

  return { data, isLoading, error, errorStatus, refetch: fetchBetween };
};

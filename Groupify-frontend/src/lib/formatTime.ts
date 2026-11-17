/**
 * Format a track position/length as a clock: m:ss, or h:mm:ss past an hour
 * (e.g. 0 → "0:00", 245000 → "4:05", 3725000 → "1:02:05").
 */
export const formatTrackTime = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
};

/**
 * Format milliseconds into human-readable time string
 * @param ms - Time in milliseconds
 * @returns Formatted string (e.g., "5m", "2h 10m", "1d", "3d 5h")
 */
export const formatTime = (ms: number): string => {
  if (ms < 0) return '0s';
  if (ms < 1000) return `${Math.round(ms)}ms`;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${days}d`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${seconds}s`;
};


/**
 * How long ago something happened, as the largest whole unit
 * (e.g. "now", "5m", "3h", "2d", "2w", "1mo", "1y"). Used in song rows.
 */
export const formatAge = (ms: number): string => {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
};

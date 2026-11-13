/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';

// `--destructive-foreground` is the text colour for a *filled* destructive
// button, and it equals `--raised`, the card colour. Used anywhere else it
// draws text in the colour of the card behind it (#69). Red text on a
// surface uses `text-danger` instead.
const sources = import.meta.glob('./**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

describe('text-destructive-foreground', () => {
  it('is only used on a filled destructive background', () => {
    const offenders = Object.entries(sources).flatMap(([file, source]) =>
      source
        .split('\n')
        .map((line, i) => ({ line, at: `${file}:${i + 1}` }))
        .filter(({ line }) => line.includes('text-destructive-foreground') && !/(?:^|[\s"'`])bg-destructive(?![\w/-])/.test(line))
        .map(({ at }) => at),
    );
    expect(offenders).toEqual([]);
  });
});

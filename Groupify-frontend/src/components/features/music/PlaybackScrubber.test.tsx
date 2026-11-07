import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import PlaybackScrubber from './PlaybackScrubber';

// Radix Slider measures itself with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  vi.useRealTimers();
});

describe('PlaybackScrubber', () => {
  it('renders nothing until the duration is known', () => {
    const { container } = render(
      <PlaybackScrubber position={0} duration={0} isPlaying={false} onSeek={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows elapsed and total time', () => {
    render(<PlaybackScrubber position={65_000} duration={245_000} isPlaying={false} onSeek={vi.fn()} />);
    expect(screen.getByText('1:05')).toBeInTheDocument();
    expect(screen.getByText('4:05')).toBeInTheDocument();
  });

  it('advances between player updates while playing', () => {
    vi.useFakeTimers();
    render(<PlaybackScrubber position={10_000} duration={245_000} isPlaying onSeek={vi.fn()} />);
    expect(screen.getByText('0:10')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText('0:13')).toBeInTheDocument();
  });

  it('does not advance while paused', () => {
    vi.useFakeTimers();
    render(<PlaybackScrubber position={10_000} duration={245_000} isPlaying={false} onSeek={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText('0:10')).toBeInTheDocument();
  });

  it('seeks with the keyboard and reports the new position', () => {
    const onSeek = vi.fn();
    render(<PlaybackScrubber position={10_000} duration={245_000} isPlaying={false} onSeek={onSeek} />);

    const thumb = screen.getByRole('slider');
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });

    expect(onSeek).toHaveBeenCalledWith(11_000);
    expect(screen.getByText('0:11')).toBeInTheDocument();
  });

  it('keeps advancing after a keyboard seek (does not stay stuck in drag mode)', () => {
    vi.useFakeTimers();
    const onSeek = vi.fn();
    render(<PlaybackScrubber position={10_000} duration={245_000} isPlaying onSeek={onSeek} />);

    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenCalledWith(11_000);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText('0:14')).toBeInTheDocument();
  });

  it('is not interactive when disabled', () => {
    const onSeek = vi.fn();
    render(<PlaybackScrubber position={10_000} duration={245_000} isPlaying={false} onSeek={onSeek} disabled />);

    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(onSeek).not.toHaveBeenCalled();
  });
});

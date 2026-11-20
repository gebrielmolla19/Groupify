import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedStatus from './FeedStatus';

describe('FeedStatus', () => {
  it('takes the whole feed when the load failed and nothing is shown, and retries', async () => {
    const onRetry = vi.fn();
    render(<FeedStatus error="Internal server error" isLoading={false} shareCount={0} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent("This group didn't load");
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('is a compact row when shares are still on screen', () => {
    render(<FeedStatus error="Internal server error" isLoading={false} shareCount={3} onRetry={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't refresh this feed.");
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('says nothing is shared yet in a new group, and offers to invite', async () => {
    const onInvite = vi.fn();
    render(<FeedStatus error={null} isLoading={false} shareCount={0} onRetry={vi.fn()} onInvite={onInvite} />);
    expect(screen.getByRole('heading', { name: 'Nothing shared yet' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Invite people first' }));
    expect(onInvite).toHaveBeenCalledTimes(1);
  });

  it('shows nothing while loading or when the feed has shares', () => {
    const { container, rerender } = render(<FeedStatus error="x" isLoading shareCount={0} onRetry={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<FeedStatus error={null} isLoading={false} shareCount={2} onRetry={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

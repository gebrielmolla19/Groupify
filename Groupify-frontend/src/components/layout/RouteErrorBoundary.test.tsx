import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouteErrorBoundary } from './RouteErrorBoundary';

function Boom(): never {
  throw new Error('screen exploded');
}

// jsdom reports errors React catches as window "error" events; mark them handled.
const swallowWindowError = (e: ErrorEvent) => e.preventDefault();

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught render errors to console.error; keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.addEventListener('error', swallowWindowError);
  });

  afterEach(() => {
    window.removeEventListener('error', swallowWindowError);
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      <RouteErrorBoundary>
        <p>Feed</p>
      </RouteErrorBoundary>
    );
    expect(screen.getByText('Feed')).toBeInTheDocument();
  });

  it('shows the fallback when a child throws, leaving siblings rendered', () => {
    render(
      <div>
        <nav>Sidebar</nav>
        <RouteErrorBoundary>
          <Boom />
        </RouteErrorBoundary>
      </div>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    expect(screen.getByText('Sidebar')).toBeInTheDocument();
  });

  it('recovers when remounted with a new key (navigation)', () => {
    const { rerender } = render(
      <RouteErrorBoundary key="/groups/a">
        <Boom />
      </RouteErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    rerender(
      <RouteErrorBoundary key="/profile">
        <p>Profile</p>
      </RouteErrorBoundary>
    );
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });
});

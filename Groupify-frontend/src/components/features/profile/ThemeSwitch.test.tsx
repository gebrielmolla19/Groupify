import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'next-themes';
import { ThemeSwitch } from './ThemeSwitch';

function renderSwitch() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="groupify-theme">
      <ThemeSwitch />
    </ThemeProvider>,
  );
}

describe('ThemeSwitch', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    // jsdom has no matchMedia; next-themes needs it for the "system" option.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }));
  });

  it('starts on dark by default', () => {
    renderSwitch();
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('gives every option a 44px touch target below md', () => {
    renderSwitch();
    for (const name of ['Dark', 'Light', 'Device']) {
      expect(screen.getByRole('radio', { name })).toHaveClass('h-11', 'md:h-9');
    }
  });

  it('switches to light and remembers the choice', async () => {
    const user = userEvent.setup();
    renderSwitch();
    await user.click(screen.getByRole('radio', { name: 'Light' }));
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement).toHaveClass('light');
    expect(localStorage.getItem('groupify-theme')).toBe('light');
  });

  it('keeps the current choice when the active option is pressed again', async () => {
    const user = userEvent.setup();
    renderSwitch();
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
  });
});

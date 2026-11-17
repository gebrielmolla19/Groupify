import { test, expect } from '@playwright/test';

// #67: the phone media query must not give every element a transition.
// transition-property defaults to "all", so a global transition-duration
// made Radix popovers animate from their off-screen starting transform.
test.describe('phone transitions', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('elements without a transition of their own get none at phone width', async ({ page }) => {
    await page.goto('/login');
    const durations = await page.evaluate(() => {
      const probe = document.createElement('div');
      document.body.appendChild(probe);
      const result = {
        probe: getComputedStyle(probe).transitionDuration,
        html: getComputedStyle(document.documentElement).transitionDuration,
      };
      probe.remove();
      return result;
    });
    expect(durations).toEqual({ probe: '0s', html: '0s' });
  });
});

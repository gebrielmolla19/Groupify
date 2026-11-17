import { test, expect } from '@playwright/test';
import { openSampleFeed } from './support/sampleFeed';

// #75: the pending-invites panel was fixed to the window and covered the
// header's Settings and Invite buttons. It now sits inside the feed.
for (const width of [1024, 1440]) {
  test(`at ${width}px a pending invite covers no header button`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openSampleFeed(page, { theme: 'dark', pendingInvite: true });
    await expect(page.getByText('Invited Person')).toBeVisible();

    // Retry while the feed settles: the header can re-render as data arrives.
    await expect(async () => {
      for (const name of ['Group settings', 'Invite a friend to group']) {
        const box = await page.getByRole('button', { name }).boundingBox();
        if (!box) throw new Error(`${name} has no box yet`);
        // Points across the button (inside its rounded corners) must hit the
        // button itself, not something drawn on top of it.
        const points = [0.25, 0.75].flatMap((fx) => [0.25, 0.75].map((fy) => [box.x + box.width * fx, box.y + box.height * fy]));
        for (const [x, y] of points) {
          const hit = await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest('button')?.getAttribute('aria-label'), [x, y]);
          expect(hit, `${name} at (${x}, ${y})`).toBe(name);
        }
      }
    }).toPass({ timeout: 5000 });

    // The invites are still reachable, inside the feed's main region.
    await expect(page.getByRole('main').getByRole('region', { name: 'Group Invites' })).toBeVisible();
  });
}

test('no invites section when nothing is pending', async ({ page }) => {
  await openSampleFeed(page, { theme: 'dark' });
  await expect(page.getByText('Sample Track 1')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Group Invites' })).toHaveCount(0);
});

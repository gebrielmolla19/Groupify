import { test, expect, type Page } from '@playwright/test';
import { openSampleFeed } from './support/sampleFeed';
import { contrast } from './support/contrast';

// #57 slice 4: the new song row. Sample feed (see support/sampleFeed.ts):
// 1 shared by me, heard by 1 of 2; 2 shared by a friend, not heard by me;
// 3 shared by me, heard by both, liked by me.
const row = (page: Page, n: number) => page.getByRole('list', { name: 'Shares' }).getByRole('listitem').filter({ hasText: `Sample Track ${n}` });

test('marks unheard shares and shows who has heard each one', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSampleFeed(page, { theme: 'dark' });

  await expect(row(page, 2).getByTestId('unheard-dot')).toBeVisible();
  await expect(row(page, 2).getByText('Sample Track 2')).toHaveCSS('font-weight', '700');
  await expect(row(page, 2)).toContainText('not heard yet');
  for (const n of [1, 3]) await expect(row(page, n).getByTestId('unheard-dot')).toHaveCount(0);

  await expect(row(page, 1).getByRole('group', { name: '1 of 2 members heard it' })).toBeVisible();
  await expect(row(page, 3).getByRole('group', { name: '2 of 2 members heard it' })).toBeVisible();
  await expect(row(page, 1)).toContainText('You');
  await expect(row(page, 2)).toContainText('Test Friend');
});

test('like toggles from the row', async ({ page }) => {
  await openSampleFeed(page, { theme: 'dark' });
  await expect(row(page, 3).getByRole('button', { name: /^Unlike Sample Track 3, 1 like$/ })).toHaveAttribute('aria-pressed', 'true');

  const like = row(page, 1).getByRole('button', { name: /^Like Sample Track 1/ });
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  await like.click();
  await expect(row(page, 1).getByRole('button', { name: /^Unlike Sample Track 1, 1 like$/ })).toHaveAttribute('aria-pressed', 'true');
});

test('other actions live in the three-dot menu', async ({ page }) => {
  await openSampleFeed(page, { theme: 'dark' });
  await row(page, 1).getByRole('button', { name: 'More actions for Sample Track 1' }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: 'Play' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Open in Spotify' })).toHaveAttribute('href', 'https://open.spotify.com/track/t1');
  await menu.getByRole('menuitem', { name: 'Remove from group' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Remove this song?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  // Radix can leave the page unclickable after a dialog opened from a menu.
  await expect(page.locator('body')).not.toHaveCSS('pointer-events', 'none');
  await row(page, 2).getByRole('button', { name: /^Like Sample Track 2/ }).click();
  await expect(row(page, 2).getByRole('button', { name: /^Unlike Sample Track 2/ })).toBeVisible();
});

test('at 375px the row fits, with 44px controls', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openSampleFeed(page, { theme: 'dark' });
  await expect(row(page, 1)).toContainText('1/2 heard');

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  for (const n of [1, 2, 3]) {
    // The heard count is never cut off; the sharer's name gives way instead.
    const count = row(page, n).locator('p [data-tour="listeners"]');
    const fits = await count.evaluate((el) => el.getBoundingClientRect().right <= el.closest('p')!.getBoundingClientRect().right + 0.5);
    expect(fits, `heard count on row ${n}`).toBe(true);
    for (const name of [/^(Like|Unlike) Sample Track/, /More actions/, /^Play /]) {
      const box = (await row(page, n).getByRole('button', { name }).boundingBox())!;
      expect(box.width, `${name} on row ${n}`).toBeGreaterThanOrEqual(44);
      expect(box.height, `${name} on row ${n}`).toBeGreaterThanOrEqual(44);
    }
  }
});

// #104: the like icon was a white-filled <img>, invisible on the light theme.
for (const theme of ['light', 'dark'] as const) {
  test(`like icon reaches 3:1 contrast on the ${theme} theme`, async ({ page }) => {
    await openSampleFeed(page, { theme });
    await page.waitForFunction(() => document.getAnimations().every((a) => !(a instanceof CSSTransition)));
    const button = row(page, 1).getByRole('button', { name: /^Like Sample Track 1/ });
    const [icon, bg] = await button.evaluate((el) => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      const rgba = (css: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data];
      };
      // The first opaque background behind the button.
      let node: Element | null = el.parentElement;
      let back = rgba(getComputedStyle(document.body).backgroundColor);
      while (node) {
        const c = rgba(getComputedStyle(node).backgroundColor);
        if (c[3] === 255) { back = c; break; }
        node = node.parentElement;
      }
      return [rgba(getComputedStyle(el.querySelector('svg')!).color), back];
    });
    expect(contrast(icon, bg)).toBeGreaterThanOrEqual(3);
  });
}

import { test, expect, type Page } from '@playwright/test';
import { openSampleFeed } from './support/sampleFeed';

// #57 slice 4: the song detail, a pane beside the feed on desktop and a
// bottom sheet on phones. Sample feed (see support/sampleFeed.ts):
// 1 shared by me, heard by Test Friend; 2 shared by Test Friend, heard by
// Other Member; 3 shared by me, heard by both, liked by me.
const row = (page: Page, n: number) => page.getByRole('list', { name: 'Shares' }).getByRole('listitem').filter({ hasText: `Sample Track ${n}` });
const details = (page: Page, n: number) => row(page, n).getByRole('button', { name: `Show details for Sample Track ${n}` });

test.describe('desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSampleFeed(page, { theme: 'dark' });
  });

  test('"See how it spread" opens the share\'s journey in Group Dynamics', async ({ page }) => {
    await row(page, 2).click();
    const pane = page.getByRole('complementary', { name: 'Song details' });
    await pane.getByRole('link', { name: 'See how it spread' }).click();

    await expect(page).toHaveURL(/\/groups\/g1\/analytics\?share=sh2$/);
    const journey = page.getByRole('article', { name: 'Sample Track 2' });
    await expect(journey).toContainText('Shared by Test Friend');
    await expect(journey).toContainText('1 of 2 have listened');
    await expect(journey.getByRole('listitem').filter({ hasText: 'Other Member' })).toContainText('4 min');
    await expect(journey.getByRole('listitem').filter({ hasText: 'You' })).toContainText('Not yet');

    // Search, then a chip, then pick another share from the list.
    const songs = page.getByRole('list', { name: 'Songs' });
    await page.getByRole('searchbox', { name: 'Search songs' }).fill('another');
    await expect(songs.getByRole('button', { name: /Sample Track 1\b/ })).toHaveCount(0);
    await page.getByRole('searchbox', { name: 'Search songs' }).fill('');
    await page.getByRole('radio', { name: 'Yours 2' }).click();
    await songs.getByRole('button', { name: /Sample Track 3/ }).click();
    await expect(page.getByRole('article', { name: 'Sample Track 3' })).toContainText('Everyone listened within 8 min');
    await expect(page).toHaveURL(/\?share=sh3$/);

    // A new period keeps the picked share: it's sent as the share to include.
    const reload = page.waitForRequest((r) => {
      const url = new URL(r.url());
      return url.pathname.endsWith('/analytics/g1/songs') && url.searchParams.get('range') === '7d';
    });
    await page.getByRole('radiogroup', { name: 'Period for Group Dynamics' }).getByRole('radio', { name: '7d' }).click();
    expect(new URL((await reload).url()).searchParams.get('share')).toBe('sh3');
    await expect(page.getByRole('article', { name: 'Sample Track 3' })).toBeVisible();
  });

  test('clicking a row opens it in the detail pane', async ({ page }) => {
    await expect(page.getByRole('complementary', { name: 'Song details' })).toHaveCount(0);
    await row(page, 3).click(); // the row body, over the sharer column
    const pane = page.getByRole('complementary', { name: 'Song details' });
    await expect(pane.getByRole('heading', { name: 'Sample Track 3' })).toBeVisible();
    await expect(details(page, 3)).toHaveAttribute('aria-current', 'true');
    await expect(pane).toContainText('Shared by you');
    await expect(pane.getByRole('heading', { name: 'Everyone has heard it' })).toBeVisible();
    await expect(pane.getByRole('listitem').filter({ hasText: 'Test Friend' })).toContainText('+4m');
    await expect(pane.getByRole('listitem').filter({ hasText: 'Other Member' })).toContainText('+8m');
    await expect(pane.getByRole('link', { name: 'Open in Spotify' })).toHaveAttribute('href', 'https://open.spotify.com/track/t3');
    await expect(pane.getByRole('button', { name: 'Remove from group' })).toBeVisible();
    await expect(pane.getByRole('button', { name: 'Like, 1 like' })).toHaveAttribute('aria-pressed', 'true');
    await expect(pane.getByRole('button', { name: /mark/i })).toHaveCount(0);

    // The group name keeps its room: the header's button labels give way.
    const name = page.getByRole('heading', { level: 1, name: 'Sample Group' });
    expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'View group playlist' }).getByText('View Playlist')).toBeHidden();

    // The pane sits beside the feed, not over it.
    const paneBox = (await pane.boundingBox())!;
    const feedBox = (await page.getByRole('list', { name: 'Shares' }).boundingBox())!;
    expect(paneBox.x).toBeGreaterThanOrEqual(feedBox.x + feedBox.width);
  });

  test('Enter on a row opens it; the like and close buttons work', async ({ page }) => {
    // The row's own buttons keep their clicks.
    await row(page, 2).getByRole('button', { name: /^Like Sample Track 2/ }).click();
    await expect(page.getByRole('complementary', { name: 'Song details' })).toHaveCount(0);

    await details(page, 2).focus();
    await page.keyboard.press('Enter');
    const pane = page.getByRole('complementary', { name: 'Song details' });
    await expect(pane.getByRole('heading', { name: 'Sample Track 2' })).toBeVisible();
    await expect(pane).toBeFocused();
    await expect(pane).toContainText('Shared by Test Friend');
    await expect(pane.getByRole('heading', { name: '1 of 2 have heard it' })).toBeVisible();
    await expect(pane.getByRole('listitem').filter({ hasText: 'You' })).toContainText('Not yet');

    // Liking in the pane updates the row too.
    await pane.getByRole('button', { name: 'Like, 1 like' }).click();
    await expect(pane.getByRole('button', { name: 'Like, 0 likes' })).toHaveAttribute('aria-pressed', 'false');
    await expect(row(page, 2).getByRole('button', { name: /^Like Sample Track 2, 0 likes$/ })).toBeVisible();

    await pane.getByRole('button', { name: 'Close song details' }).click();
    await expect(pane).toHaveCount(0);
    await expect(details(page, 2)).toBeFocused();
  });

  test('the pane resizes from its gutter', async ({ page }) => {
    await details(page, 1).click();
    const pane = page.getByRole('complementary', { name: 'Song details' });
    const before = (await pane.boundingBox())!.width;
    await page.getByRole('separator', { name: 'Resize details' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await pane.boundingBox())!.width).toBe(before + 16);
  });
});

test.describe('phone', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openSampleFeed(page, { theme: 'dark' });
  });

  test('a row opens a bottom sheet that fits, and focus returns to the row', async ({ page }) => {
    await row(page, 1).click(); // the row body, over the title
    const sheet = page.getByRole('dialog', { name: 'Sample Track 1' });
    await expect(sheet).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Song details' })).toHaveCount(0);
    await expect(sheet.getByRole('heading', { name: '1 of 2 have heard it' })).toBeVisible();
    await expect(sheet.getByRole('listitem').filter({ hasText: 'Other Member' })).toContainText('Not yet');

    const box = (await sheet.boundingBox())!;
    expect(box.y + box.height).toBeCloseTo(812, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    for (const name of ['Play', /^Like, /, 'Open in Spotify', 'Remove from group', 'Close']) {
      const control = sheet.getByRole(name === 'Open in Spotify' ? 'link' : 'button', { name });
      const b = (await control.boundingBox())!;
      expect(b.height, String(name)).toBeGreaterThanOrEqual(44);
      expect(b.width, String(name)).toBeGreaterThanOrEqual(44);
    }

    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(details(page, 1)).toBeFocused();
  });

  test('remove from the sheet asks first, above the sheet, then returns focus to the feed', async ({ page }) => {
    await details(page, 1).click();
    const sheet = page.getByRole('dialog', { name: 'Sample Track 1' });
    await expect(sheet).toBeVisible();
    // Measured now: the sheet leaves the accessibility tree under the confirm.
    const sheetBox = (await sheet.boundingBox())!;
    await sheet.getByRole('button', { name: 'Remove from group' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Remove this song?' });
    await expect(confirm).toBeVisible();
    // Its scrim dims the sheet too. The confirm is a bottom sheet itself on
    // phones, so probe the song sheet's top edge, which it doesn't cover.
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.getAttribute('data-slot'), [sheetBox.x + 8, sheetBox.y + 8]);
    expect(hit).toBe('alert-dialog-overlay');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toHaveCount(0);
    await expect(sheet).toBeVisible();

    // Removing it closes the sheet, and focus lands on a row that's left.
    await sheet.getByRole('button', { name: 'Remove from group' }).click();
    await confirm.getByRole('button', { name: 'Remove' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(row(page, 1)).toHaveCount(0);
    await expect(details(page, 2)).toBeFocused();
  });

  test('between phone and 1280px the detail is a sheet too', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await details(page, 3).click();
    await expect(page.getByRole('dialog', { name: 'Sample Track 3' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Song details' })).toHaveCount(0);
  });
});

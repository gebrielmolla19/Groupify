import { test, expect } from '@playwright/test';
import { openSampleFeed } from './support/sampleFeed';

// #77: the feed header's icon buttons hard-coded white text, so their icons
// vanished on the light theme. WCAG 1.4.11 asks for 3:1 for icons.
function luminance([r, g, b]: number[]) {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: number[], b: number[]) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

for (const theme of ['light', 'dark'] as const) {
  test(`header icons reach 3:1 contrast on the ${theme} theme`, async ({ page }) => {
    await openSampleFeed(page, { theme });
    // Buttons transition their colour when the theme class lands; measure the settled value.
    await page.waitForFunction(() => document.getAnimations().every((a) => !(a instanceof CSSTransition)));
    const colours = await page.evaluate(() => {
      // Computed colours may be oklab()/color-mix(); a canvas pixel gives sRGB.
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      const rgb = (css: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b, a / 255];
      };
      // The header is translucent; blend it over the page behind it.
      const header = rgb(getComputedStyle(document.querySelector('header')!).backgroundColor);
      const page = rgb(getComputedStyle(document.body).backgroundColor);
      const a = header[3] ?? 1;
      const bg = [0, 1, 2].map((i) => header[i] * a + page[i] * (1 - a));
      const labels = ['Back to dashboard', 'View group playlist', 'View group analytics', 'Group settings'];
      return { bg, icons: labels.map((l) => [l, rgb(getComputedStyle(document.querySelector(`[aria-label="${l}"]`)!).color)] as const) };
    });
    for (const [label, colour] of colours.icons) {
      expect(contrast(colour, colours.bg), label).toBeGreaterThanOrEqual(3);
    }
  });
}

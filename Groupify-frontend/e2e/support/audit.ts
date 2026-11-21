// Layout and contrast checks shared by the responsive audit (#57).
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { contrast } from './contrast';

export type Finding = { check: 'overflow' | 'tap-target' | 'text-contrast' | 'icon-contrast'; detail: string };

/** The page itself must not scroll sideways. */
export async function pageOverflow(page: Page): Promise<Finding[]> {
  const { scroll, client, wide } = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    // Name the widest visible elements that reach past the right edge, to say what overflows.
    const wide = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && el.getClientRects().length > 0)
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''}.${[...el.classList].slice(0, 3).join('.')}`);
    return { scroll: root.scrollWidth, client: root.clientWidth, wide };
  });
  return scroll > client ? [{ check: 'overflow', detail: `page is ${scroll}px wide in a ${client}px window (${wide.join(', ')})` }] : [];
}

/**
 * Every visible control must be at least 44px tall on a phone. Inline text
 * links are exempt (WCAG 2.5.8 inline exception), as are controls the
 * accessibility tree hides (behind an open dialog, or decorative).
 */
export async function smallTapTargets(page: Page): Promise<Finding[]> {
  const small = await page.evaluate(() => {
    const selector = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=switch], [role=radio], [role=tab], [role=menuitem], [role=checkbox], [role=option], [role=slider]';
    const seen = new Set<Element>();
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      // Count a control once even when its parent also matches (a radio input inside a label button).
      if ([...seen].some((s) => s.contains(el))) continue;
      seen.add(el);
      if (el.closest('[aria-hidden=true], [inert]') || el.hasAttribute('disabled')) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;
      if (el.tagName === 'A' && style.display === 'inline') continue;
      const box = el.getBoundingClientRect();
      // Visually hidden (sr-only) and off-screen controls are not tap targets.
      if (box.width <= 1 || box.height <= 1 || box.right <= 0 || box.left >= window.innerWidth) continue;
      if (box.height < 43.5) {
        const name = el.getAttribute('aria-label') || el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 40) || el.getAttribute('placeholder') || el.tagName.toLowerCase();
        out.push(`${name} (${Math.round(box.height)}px)`);
      }
    }
    return out;
  });
  return small.map((detail) => ({ check: 'tap-target', detail }));
}

/** axe-core's colour-contrast rule: 4.5:1 for text (3:1 for large text). */
export async function textContrast(page: Page): Promise<Finding[]> {
  const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  return results.violations.flatMap((v) =>
    v.nodes.map((n) => {
      const data = n.any[0]?.data as { contrastRatio?: number; fgColor?: string; bgColor?: string } | undefined;
      const text = n.html.replace(/\s+/g, ' ').slice(0, 80);
      return { check: 'text-contrast' as const, detail: `${data?.contrastRatio}:1 ${data?.fgColor} on ${data?.bgColor}: ${text}` };
    }),
  );
}

/**
 * Icon-only controls need 3:1 against what is behind them (WCAG 1.4.11).
 * axe doesn't check icons, so compare the icon's colour with the first
 * opaque background up the tree, blending translucent layers on the way.
 */
export async function iconContrast(page: Page): Promise<Finding[]> {
  const pairs = await page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const rgba = (css: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const behind = (el: Element | null): number[] => {
      const layers: number[][] = [];
      for (let e = el; e; e = e.parentElement) {
        const c = rgba(getComputedStyle(e).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] >= 1) break;
      }
      // Compose from the bottom (opaque) layer up; the page is white if nothing is opaque.
      return layers.reverse().reduce((acc, [r, g, b, a]) => [r * a + acc[0] * (1 - a), g * a + acc[1] * (1 - a), b * a + acc[2] * (1 - a)], [255, 255, 255]);
    };
    const out: { name: string; fg: number[]; bg: number[] }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('button, a[href], [role=button]')) {
      if (el.closest('[aria-hidden=true], [inert]') || el.hasAttribute('disabled')) continue;
      const svg = el.querySelector('svg');
      if (!svg || el.innerText.trim()) continue;
      const box = el.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1 || getComputedStyle(el).visibility === 'hidden') continue;
      const style = getComputedStyle(svg);
      const paint = style.stroke !== 'none' && style.stroke ? style.stroke : style.fill;
      const fg = rgba(paint === 'none' ? style.color : paint);
      // Opacity on the icon or the control fades it into the background.
      const alpha = fg[3] * Number(style.opacity) * Number(getComputedStyle(el).opacity);
      const bg = behind(el);
      out.push({ name: el.getAttribute('aria-label') ?? el.tagName.toLowerCase(), fg: [0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha)), bg });
    }
    return out;
  });
  return pairs
    .map((p) => ({ ...p, ratio: contrast(p.fg, p.bg) }))
    .filter((p) => p.ratio < 3)
    .map((p) => ({ check: 'icon-contrast', detail: `${p.ratio.toFixed(2)}:1 ${p.name}` }));
}

/** Wait until nothing is animating, so colours and positions have settled. */
export async function settle(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getComputedTiming().iterations ?? 1) === Infinity));
  await page.waitForTimeout(150);
}

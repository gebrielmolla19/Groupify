import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import GroupCover from './GroupCover';
import { makeGroupCover } from '../../../lib/groupCover';

describe('GroupCover', () => {
  it('draws the generated cover for the group, hidden from screen readers', () => {
    const id = '65f1a2b3c4d5e6f700000001';
    const expected = makeGroupCover(id);
    const { container } = render(<GroupCover groupId={id} className="size-10" />);
    const cover = container.firstElementChild as HTMLElement;

    expect(cover).toHaveAttribute('aria-hidden', 'true');
    expect(cover).toHaveAttribute('data-pattern', expected.pattern);
    expect(cover).toHaveClass('size-10', 'overflow-hidden');
    expect(cover.firstElementChild?.children).toHaveLength(expected.shapes.length);
  });

  it('draws different covers for different groups', () => {
    const a = render(<GroupCover groupId="65f1a2b3c4d5e6f700000001" />).container.innerHTML;
    const b = render(<GroupCover groupId="65f1a2b3c4d5e6f700000002" />).container.innerHTML;
    expect(a).not.toBe(b);
  });
});

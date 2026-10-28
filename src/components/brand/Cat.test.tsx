import { describe, expect, test } from 'bun:test';
import { render } from '@/test/render';
import { CatHead, type CatMood, CatPeek, CatSitting, CatSleeping } from './Cat';

const MOODS: CatMood[] = ['idle', 'happy', 'think', 'wow', 'sleep', 'wink', 'focus'];

describe('current Suu artwork', () => {
  test.each(MOODS)('legacy mood %s uses the new logo cat', (mood) => {
    const { container, getByRole } = render(<CatHead mood={mood} size={80} />);
    expect(getByRole('img', { name: 'Суу муур' })).toBeTruthy();
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('80');
    expect(container.querySelector('image')?.getAttribute('href')).toBe('/brand/suu-logo-head.webp');
    expect(container.querySelector('path')).toBeNull();
  });

  test.each([CatSitting, CatPeek, CatSleeping])('legacy illustration uses the current mascot', (Cat) => {
    const { container } = render(<Cat size={120} />);
    expect(container.querySelector('image')?.getAttribute('href')).toBe('/brand/suu-logo-head.webp');
  });
});

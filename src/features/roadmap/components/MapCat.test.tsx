import { expect, test } from 'bun:test';
import { ITEMS } from '@/features/shop/catalog';
import { render } from '@/test/render';
import { MapCat } from './MapCat';

test('new sitting Su is the default and invalid or non-outfit items cannot change it', () => {
  const view = render(<MapCat />);
  for (const outfit of [undefined, 'missing', 'skin-night']) {
    view.rerender(<MapCat outfit={outfit} />);
    expect(view.container.querySelector('image')?.getAttribute('href')).toBe('/brand/suu-sitting.webp');
  }
});

test('equipped clothing uses its exact shop artwork and updates when changed', () => {
  const view = render(<MapCat />);
  for (const item of ITEMS.filter((item) => item.kind === 'outfit' && item.art)) {
    view.rerender(<MapCat outfit={item.id} />);
    expect(view.container.querySelector('svg')?.getAttribute('viewBox')).toBe(item.art!.join(' '));
    expect(view.container.querySelector('[data-outfit]')?.getAttribute('data-outfit')).toBe(item.id);
    expect(view.container.querySelector('image')?.getAttribute('href')).toBe('/brand/suu-outfits.webp');
  }
  view.rerender(<MapCat />);
  expect(view.container.querySelector('image')?.getAttribute('href')).toBe('/brand/suu-sitting.webp');
});

test('shop accessories are worn over sitting Su', () => {
  const view = render(<MapCat outfit="outfit-crown" />);
  expect(view.container.querySelector('text')?.textContent).toBe('👑');
  expect(view.container.querySelector('.roadmap-cat-eyelids')).toBeTruthy();
});

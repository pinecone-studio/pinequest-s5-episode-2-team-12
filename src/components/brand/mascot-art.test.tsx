import { expect, test } from 'bun:test';
import { ITEMS } from '@/features/shop/catalog';
import { earn, emptyWallet, equip, purchase } from '@/features/shop/lib/wallet';
import { render } from '@/test/render';
import { Avatar } from './Avatar';
import { Logo } from './Decor';

test('the logo and default avatar use the supplied brand artwork', () => {
  const { container } = render(
    <>
      <Logo />
      <Avatar name="Student" />
    </>,
  );
  expect(
    [...container.querySelectorAll('image')].every(
      (i) => i.getAttribute('href') === '/brand/suu-logo-head.png',
    ),
  ).toBe(true);
  expect(container.querySelectorAll('image').length).toBe(2);
});

test('each supplied outfit can be bought, equipped, shown, and taken off', () => {
  const outfits = ITEMS.filter((item) => item.art);
  expect(outfits).toHaveLength(20);
  for (const outfit of outfits) {
    const bought = purchase(earn(emptyWallet(), 1000, 'test', 'seed'), outfit.id, outfit.id);
    if (!bought.ok) throw new Error(bought.reason);
    const dressed = equip(bought.wallet, outfit.id);
    const { container, rerender, unmount } = render(
      <Avatar name="Student" outfit={dressed.equipped.outfit} />,
    );
    expect(container.querySelector('image')?.getAttribute('href')).toBe('/brand/suu-outfits.png');
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe(outfit.art?.join(' '));
    const undressed = equip(dressed, outfit.id);
    rerender(<Avatar name="Student" outfit={undressed.equipped.outfit} />);
    expect(container.querySelector('image')?.getAttribute('href')).toBe('/brand/suu-logo-head.png');
    unmount();
  }
});

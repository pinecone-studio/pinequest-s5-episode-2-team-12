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
      (i) => i.getAttribute('href') === '/brand/suu-logo-head.webp',
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
    expect(container.querySelector('image')?.getAttribute('href')).toBe('/brand/suu-outfits.webp');
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe(outfit.art?.join(' '));
    const undressed = equip(dressed, outfit.id);
    rerender(<Avatar name="Student" outfit={undressed.equipped.outfit} />);
    expect(container.querySelector('image')?.getAttribute('href')).toBe('/brand/suu-logo-head.webp');
    unmount();
  }
});

test('the equipped scarf stays anchored to the avatar neck at small and profile sizes', () => {
  for (const size of [32, 40, 48, 76]) {
    const { container, unmount } = render(
      <Avatar name="Tuya" size={size} accessories={{ neck: 'outfit-scarf' }} />,
    );
    const scarf = container.querySelector('img')!;
    expect(scarf.getAttribute('src')).toBe('/brand/shop-accessories/scarf.png');
    expect(parseFloat(scarf.style.top)).toBeCloseTo(size * 0.8);
    expect(parseFloat(scarf.style.width)).toBeCloseTo(size * 0.6);
    expect(parseFloat(scarf.style.top)).toBeLessThan(size);
    expect(parseFloat(scarf.style.top) + parseFloat(scarf.style.height)).toBeLessThan(size * 1.25);
    unmount();
  }
});

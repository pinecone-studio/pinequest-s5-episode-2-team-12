import { expect, test } from 'bun:test';
import { render, screen } from '@/test/render';
import { BankTopics } from './BankTopics';

const counts = { alg: 616, adv: 540, psda: 421, geo: 348 };

test('shows the four domain cards with their counts, linking to each paginated domain', () => {
  render(<BankTopics counts={counts} />);
  expect(screen.getByRole('heading', { name: 'Асуултын сан' })).toBeTruthy();
  expect(screen.getByText('1925')).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Энгийн бутархай' })).toBeNull();
  const cards = [
    ['Алгебр', 'alg', '616 бодлого'],
    ['Ахисан математик', 'adv', '540 бодлого'],
    ['Өгөгдөл ба бодлого', 'psda', '421 бодлого'],
    ['Геометр', 'geo', '348 бодлого'],
  ];
  for (const [name, domain, count] of cards) {
    const link = screen.getByRole('link', { name });
    expect(link.getAttribute('href')).toBe(`/bank?view=official&domain=${domain}`);
    expect(link.textContent).toContain(count);
  }
});

test('an unreachable bank shows a status instead of counts', () => {
  render(<BankTopics counts={null} />);
  expect(screen.getByRole('status').textContent).toContain('Асуултын сантай холбогдох боломжгүй');
  expect(screen.getAllByRole('link')).toHaveLength(4);
});

test('all topic scenes use only the unchanged original Suu sitting artwork', () => {
  const { container } = render(<BankTopics counts={counts} />);
  const images = [...container.querySelectorAll('.bank-mascot image')];
  expect(images).toHaveLength(4);
  expect(images.every((image) => image.getAttribute('href') === '/brand/suu-sitting.webp')).toBe(true);
  expect(container.querySelectorAll('.bank-mascot-prop')).toHaveLength(4);
  expect(container.querySelectorAll('.bank-mascot[aria-hidden="true"]')).toHaveLength(4);
});

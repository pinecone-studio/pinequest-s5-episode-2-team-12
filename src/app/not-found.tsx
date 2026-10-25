import Link from 'next/link';
import { CatHead } from '@/components/brand';
import { routes } from '@/lib/routes';

export default function NotFound() {
  return (
    <main className="min-h-dvh grid place-items-center gutter text-center">
      <div className="grid justify-items-center gap-3">
        <CatHead size={90} mood="wow" />
        <h1 className="font-display font-bold text-2xl text-ink">404</h1>
        <p className="text-ink-2">Энэ хуудас олдсонгүй.</p>
        <Link className="text-leaf-2 font-bold underline" href={routes.home}>
          Нүүр рүү буцах
        </Link>
      </div>
    </main>
  );
}

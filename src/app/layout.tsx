import type { Metadata, Viewport } from 'next';
import { Caveat, JetBrains_Mono, Onest, Oranienbaum, Roboto_Slab, Yeseva_One } from 'next/font/google';
import type { ReactNode } from 'react';
import { THEME_SCRIPT } from '@/lib/theme';
import './globals.css';
import './emerald-workspace.css';
import { Providers } from './providers';

const oranienbaum = Oranienbaum({
  weight: '400',
  subsets: ['latin', 'cyrillic'],
  variable: '--font-oranienbaum',
  display: 'swap',
});

const onest = Onest({ subsets: ['latin', 'cyrillic'], variable: '--font-onest', display: 'swap' });
const display = Yeseva_One({
  weight: '400',
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-yeseva-one',
  display: 'swap',
});
// accent faces load when a page uses them, so the home screen's bandwidth goes to the map and the app code
const mono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-jetbrains',
  display: 'swap',
  preload: false,
});
const slab = Roboto_Slab({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-roboto-slab',
  display: 'swap',
  preload: false,
});
const caveat = Caveat({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-caveat',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: { default: 'Suprep — SAT Math', template: '%s · Suprep' },
  description: 'Монгол сурагчдад зориулсан AI SAT Math платформ. Desmos Академи, AI багш Суу.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef3ea' },
    { media: '(prefers-color-scheme: dark)', color: '#07120c' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="mn"
      suppressHydrationWarning
      className={`${onest.variable} ${oranienbaum.variable} ${display.variable} ${mono.variable} ${slab.variable} ${caveat.variable}`}
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: constant script that applies the saved theme before paint */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

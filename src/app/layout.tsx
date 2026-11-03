import type { Metadata, Viewport } from 'next';
import { Caveat, JetBrains_Mono, Onest, Oranienbaum, Roboto_Slab, Yeseva_One } from 'next/font/google';
import type { ReactNode } from 'react';
import { getMessages } from '@/lib/i18n';
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
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
      { url: '/favicon-16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-48.png', type: 'image/png', sizes: '48x48' },
      { url: '/favicon-64.png', type: 'image/png', sizes: '64x64' },
      { url: '/favicon-128.png', type: 'image/png', sizes: '128x128' },
      { url: '/favicon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/favicon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon-16.png',
    other: [
      { rel: 'mask-icon', url: '/favicon.svg', color: '#16a34a' },
    ],
  },
  manifest: '/site.webmanifest',
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
        <Providers messages={getMessages('mn')}>{children}</Providers>
      </body>
    </html>
  );
}

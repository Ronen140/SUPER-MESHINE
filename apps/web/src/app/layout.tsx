import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'SUPER-MESHINE',
  description: 'Round 7a bootstrap — hello world hitting tRPC health.check.',
};

/**
 * Root layout. Round 7a is monolingual (English) — i18n routing arrives in 7b
 * along with `next-intl`. The `lang` attribute is set to `en` for now; once
 * locale routing exists this becomes a dynamic value driven by the segment.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

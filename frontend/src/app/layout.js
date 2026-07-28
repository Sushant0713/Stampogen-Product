import { Outfit, DM_Sans } from 'next/font/google';
import { AppProviders } from '@/contexts/AppProviders';
import { AppToaster } from '@/components/common/AppToaster';
import '@/styles/globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata = {
  title: 'Stampogen',
  description: 'Multi-tenant SaaS platform',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmSans.variable}`}>
      <body>
        <AppProviders>
          {children}
          <AppToaster />
        </AppProviders>
      </body>
    </html>
  );
}

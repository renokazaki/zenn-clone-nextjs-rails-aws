import type { Metadata } from 'next';
import { Suspense } from 'react';
import ThemeRegistry from '@/components/ThemeRegistry';
import Header from '@/app/_components/Header';
import Snackbar from '@/app/_components/Snackbar';
import { getCurrentUser } from '@/lib/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zenn Clone',
  description: 'Zenn clone app',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();

  return (
    <html lang="ja">
      <body>
        <ThemeRegistry>
          <Header currentUser={currentUser} />
          <main style={{ flex: 1 }}>{children}</main>
          <Suspense fallback={null}>
            <Snackbar />
          </Suspense>
        </ThemeRegistry>
      </body>
    </html>
  );
}

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function CurrentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      `/sign_in?message=${encodeURIComponent('サインインが必要です')}&severity=error`,
    );
  }

  return <>{children}</>;
}

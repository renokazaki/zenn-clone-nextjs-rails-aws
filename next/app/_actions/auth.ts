'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchApi } from '@/lib/api';

type AuthState = { error: string } | null;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30,
};

export async function signIn(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  let accessToken = '';
  let uid = '';
  let client = '';
  let success = false;

  try {
    const res = await fetchApi('/auth/sign_in', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      return { error: 'メールアドレスまたはパスワードが正しくありません' };
    }

    accessToken = res.headers.get('access-token') ?? '';
    uid = res.headers.get('uid') ?? '';
    client = res.headers.get('client') ?? '';
    success = true;
  } catch {
    return { error: 'ネットワークエラーが発生しました' };
  }

  if (success) {
    const cookieStore = await cookies();
    cookieStore.set('access-token', accessToken, COOKIE_OPTIONS);
    cookieStore.set('uid', uid, COOKIE_OPTIONS);
    cookieStore.set('client', client, COOKIE_OPTIONS);
    redirect(`/?message=${encodeURIComponent('サインインしました')}&severity=success`);
  }

  return { error: '予期しないエラーが発生しました' };
}

export async function signUp(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;

  try {
    const res = await fetchApi('/auth', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        name,
        confirm_success_url: process.env.NEXT_PUBLIC_FRONT_BASE_URL ?? 'http://localhost:8000',
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const errorMsg =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data?.errors?.full_messages as string[] | undefined)?.join(', ') ??
        'サインアップに失敗しました';
      return { error: errorMsg };
    }
  } catch {
    return { error: 'ネットワークエラーが発生しました' };
  }

  redirect(
    `/sign_in?message=${encodeURIComponent('確認メールを送信しました。メールをご確認ください。')}&severity=success`,
  );
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access-token')?.value;
  const uid = cookieStore.get('uid')?.value;
  const client = cookieStore.get('client')?.value;

  if (accessToken && uid && client) {
    try {
      await fetchApi('/auth/sign_out', {
        method: 'DELETE',
        headers: { 'access-token': accessToken, uid, client },
      });
    } catch {
      // ローカルのサインアウトは続行する
    }
  }

  cookieStore.delete('access-token');
  cookieStore.delete('uid');
  cookieStore.delete('client');

  redirect(`/?message=${encodeURIComponent('サインアウトしました')}&severity=success`);
}

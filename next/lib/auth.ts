import { cookies } from 'next/headers';
import { fetchApi } from './api';
import type { CurrentUser } from '@/types';

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  return {
    'access-token': cookieStore.get('access-token')?.value ?? '',
    uid: cookieStore.get('uid')?.value ?? '',
    client: cookieStore.get('client')?.value ?? '',
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const uid = cookieStore.get('uid')?.value;
  if (!uid) return null;

  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetchApi('/current/user', {
      headers: authHeaders,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data as CurrentUser;
  } catch {
    return null;
  }
}

'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchApi } from '@/lib/api';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  return {
    'access-token': cookieStore.get('access-token')?.value ?? '',
    uid: cookieStore.get('uid')?.value ?? '',
    client: cookieStore.get('client')?.value ?? '',
  };
}

export async function createArticle(): Promise<void> {
  const authHeaders = await getAuthHeaders();
  let articleId: number | null = null;

  try {
    const res = await fetchApi('/current/articles', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ article: { title: '', status: 'draft', content: '' } }),
    });

    if (res.ok) {
      const data = await res.json();
      articleId = data.id as number;
    }
  } catch {
    // エラーは以下のリダイレクトで処理
  }

  if (articleId) {
    redirect(`/current/articles/${articleId}/edit`);
  } else {
    redirect(
      `/current/articles?message=${encodeURIComponent('記事の作成に失敗しました')}&severity=error`,
    );
  }
}

type ArticleState = { error: string } | null;

export async function updateArticle(
  id: number,
  _prevState: ArticleState,
  formData: FormData,
): Promise<ArticleState> {
  const authHeaders = await getAuthHeaders();
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;
  const status = formData.get('status') as string;

  try {
    const res = await fetchApi(`/current/articles/${id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ article: { title, content, status } }),
    });

    if (!res.ok) {
      return { error: '記事の更新に失敗しました' };
    }
  } catch {
    return { error: 'ネットワークエラーが発生しました' };
  }

  redirect(
    `/current/articles/${id}?message=${encodeURIComponent('記事を更新しました')}&severity=success`,
  );
}

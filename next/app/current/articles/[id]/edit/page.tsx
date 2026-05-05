import { notFound } from 'next/navigation';
import { fetchApi, toCamelCase } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import ArticleEditForm from './_components/ArticleEditForm';
import type { CurrentArticle } from '@/types';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ArticleEditPage({ params }: Props) {
  const { id } = await params;
  let article: CurrentArticle | null = null;

  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetchApi(`/current/articles/${id}`, {
      headers: authHeaders,
      cache: 'no-store',
    });
    if (res.status === 404) notFound();
    if (res.ok) {
      const data = await res.json();
      article = toCamelCase(data.article ?? data) as CurrentArticle;
    }
  } catch {
    notFound();
  }

  if (!article) notFound();

  return <ArticleEditForm article={article} />;
}

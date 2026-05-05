import { notFound } from 'next/navigation';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Link from 'next/link';
import { fetchApi, toCamelCase } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import MarkdownText from '@/app/_components/MarkdownText';
import type { CurrentArticle } from '@/types';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CurrentArticleDetailPage({ params }: Props) {
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button component={Link} href="/current/articles" sx={{ mb: 2 }}>
        ← 記事の管理に戻る
      </Button>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
            {article.title || '(無題)'}
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <MarkdownText content={article.content ?? ''} />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Box
            sx={{
              position: { md: 'sticky' },
              top: 24,
              bgcolor: 'grey.50',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 3,
            }}
          >
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              ステータス
            </Typography>
            <Chip
              label={article.status === 'published' ? '公開' : '下書き'}
              color={article.status === 'published' ? 'primary' : 'default'}
              sx={{ mb: 2 }}
            />
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              投稿日
            </Typography>
            <Typography variant="body2">{article.createdAt}</Typography>
            <Box sx={{ mt: 3 }}>
              <Button
                component={Link}
                href={`/current/articles/${article.id}/edit`}
                variant="outlined"
                size="small"
                fullWidth
              >
                編集する
              </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}

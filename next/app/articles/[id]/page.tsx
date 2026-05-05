import { notFound } from 'next/navigation';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { fetchApi, toCamelCase } from '@/lib/api';
import MarkdownText from '@/app/_components/MarkdownText';
import type { Article } from '@/types';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ArticleDetailPage({ params }: Props) {
  const { id } = await params;
  let article: Article | null = null;

  try {
    const res = await fetchApi(`/articles/${id}`, { cache: 'no-store' });
    if (res.status === 404) notFound();
    if (res.ok) {
      const data = await res.json();
      article = toCamelCase(data.article ?? data) as Article;
    }
  } catch {
    notFound();
  }

  if (!article) notFound();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
            {article.title}
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <MarkdownText content={article.content} />
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
              著者
            </Typography>
            <Typography variant="body1" fontWeight="bold" gutterBottom>
              {article.user.name}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              投稿日
            </Typography>
            <Typography variant="body2">{article.createdAt}</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {article.fromToday}
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}

import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { fetchApi, toCamelCase } from '@/lib/api';
import ArticleCard from '@/app/_components/ArticleCard';
import type { Article } from '@/types';

export default async function HomePage() {
  let articles: Article[] = [];

  try {
    const res = await fetchApi('/articles', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      articles = toCamelCase(data.articles ?? []) as Article[];
    }
  } catch {
    // ネットワークエラー時は空リストを表示
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h5" component="h1" fontWeight="bold" sx={{ mb: 3 }}>
        記事一覧
      </Typography>

      {articles.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          記事がありません
        </Box>
      ) : (
        <Grid container spacing={3}>
          {articles.map((article) => (
            <Grid key={article.id} size={{ xs: 12, sm: 6 }}>
              <ArticleCard article={article} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}

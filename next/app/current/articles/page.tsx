import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import ArticleIcon from '@mui/icons-material/Article';
import Link from 'next/link';
import { fetchApi, toCamelCase } from '@/lib/api';
import { getAuthHeaders } from '@/lib/auth';
import type { CurrentArticle } from '@/types';

export default async function CurrentArticlesPage() {
  let articles: CurrentArticle[] = [];

  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetchApi('/current/articles', {
      headers: authHeaders,
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      articles = toCamelCase(data.articles ?? data) as CurrentArticle[];
    }
  } catch {
    // 空リストを表示
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h5" component="h1" fontWeight="bold" sx={{ mb: 3 }}>
        記事の管理
      </Typography>

      {articles.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          記事がありません。ヘッダーの「新規記事」ボタンから記事を作成してください。
        </Box>
      ) : (
        <List disablePadding>
          {articles.map((article, index) => (
            <Box key={article.id}>
              <ListItem
                secondaryAction={
                  <Box sx={{ display: 'flex' }}>
                    <IconButton
                      component={Link}
                      href={`/current/articles/${article.id}/edit`}
                      aria-label="編集"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      component={Link}
                      href={`/current/articles/${article.id}`}
                      aria-label="詳細"
                    >
                      <ArticleIcon />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body1">{article.title || '(無題)'}</Typography>
                      <Chip
                        label={article.status === 'published' ? '公開' : '下書き'}
                        color={article.status === 'published' ? 'primary' : 'default'}
                        size="small"
                      />
                    </Box>
                  }
                  secondary={article.createdAt}
                />
              </ListItem>
              {index < articles.length - 1 && <Divider />}
            </Box>
          ))}
        </List>
      )}
    </Container>
  );
}

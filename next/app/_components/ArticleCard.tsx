import Link from 'next/link';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import type { Article } from '@/types';

type Props = {
  article: Article;
};

export default function ArticleCard({ article }: Props) {
  const title =
    article.title.length > 45 ? `${article.title.slice(0, 45)}...` : article.title;

  return (
    <Link href={`/articles/${article.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <Card
        sx={{
          height: '100%',
          transition: 'box-shadow 0.2s',
          '&:hover': { boxShadow: 4, cursor: 'pointer' },
        }}
      >
        <CardContent>
          <Typography
            variant="body1"
            component="h2"
            fontWeight="bold"
            gutterBottom
            sx={{ lineHeight: 1.5 }}
          >
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {article.user.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {article.fromToday}
          </Typography>
        </CardContent>
      </Card>
    </Link>
  );
}

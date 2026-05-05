'use client';

import { useState, useActionState } from 'react';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Link from 'next/link';
import { updateArticle } from '@/app/_actions/articles';
import MarkdownText from '@/app/_components/MarkdownText';
import type { CurrentArticle } from '@/types';

type Props = {
  article: CurrentArticle;
};

export default function ArticleEditForm({ article }: Props) {
  const [title, setTitle] = useState(article.title ?? '');
  const [content, setContent] = useState(article.content ?? '');
  const [isPublished, setIsPublished] = useState(article.status === 'published');
  const [showPreview, setShowPreview] = useState(false);

  const boundAction = updateArticle.bind(null, article.id);
  const [state, formAction, isPending] = useActionState(boundAction, null);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box component="form" action={formAction}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={2}
          sx={{ mb: 3 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button component={Link} href={`/current/articles/${article.id}`} size="small">
              ← 戻る
            </Button>
            <Typography variant="h6" component="h1">
              記事の編集
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={showPreview}
                  onChange={(e) => setShowPreview(e.target.checked)}
                  size="small"
                />
              }
              label="プレビュー"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  size="small"
                />
              }
              label={isPublished ? '公開' : '下書き'}
            />
            {/* status は hidden input でフォーム送信 */}
            <input type="hidden" name="status" value={isPublished ? 'published' : 'draft'} />
            <Button type="submit" variant="contained" disabled={isPending} size="small">
              {isPending ? '更新中...' : '更新する'}
            </Button>
          </Stack>
        </Stack>

        {state?.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {state.error}
          </Alert>
        )}

        <TextField
          fullWidth
          name="title"
          label="タイトル"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{ mb: 2 }}
          required
        />

        <Divider sx={{ mb: 2 }} />

        {showPreview ? (
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 3,
              minHeight: 500,
            }}
          >
            {content ? (
              <MarkdownText content={content} />
            ) : (
              <Typography color="text.secondary" fontStyle="italic">
                本文がありません
              </Typography>
            )}
          </Box>
        ) : (
          <TextField
            fullWidth
            name="content"
            label="本文（Markdown）"
            multiline
            rows={22}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Markdownで記事を書いてください..."
          />
        )}

        {/* プレビュー表示時は hidden input で content を送信 */}
        {showPreview && <input type="hidden" name="content" value={content} />}
      </Box>
    </Container>
  );
}

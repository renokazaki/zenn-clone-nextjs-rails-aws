'use client';

import Box from '@mui/material/Box';
import ReactMarkdown from 'react-markdown';

type Props = {
  content: string;
};

export default function MarkdownText({ content }: Props) {
  return (
    <Box
      sx={{
        '& h1': { fontSize: '1.75rem', fontWeight: 'bold', mt: 3, mb: 1.5 },
        '& h2': { fontSize: '1.4rem', fontWeight: 'bold', mt: 3, mb: 1, borderBottom: '1px solid', borderColor: 'divider', pb: 0.5 },
        '& h3': { fontSize: '1.15rem', fontWeight: 'bold', mt: 2.5, mb: 1 },
        '& p': { mb: 1.5, lineHeight: 1.8 },
        '& ul, & ol': { pl: 3, mb: 1.5 },
        '& li': { mb: 0.5, lineHeight: 1.7 },
        '& code': {
          bgcolor: 'grey.100',
          color: 'error.main',
          px: 0.75,
          py: 0.25,
          borderRadius: 0.5,
          fontFamily: 'monospace',
          fontSize: '0.875em',
        },
        '& pre': {
          bgcolor: '#282c34',
          color: '#abb2bf',
          p: 2,
          borderRadius: 1,
          overflow: 'auto',
          mb: 2,
          '& code': {
            bgcolor: 'transparent',
            color: 'inherit',
            p: 0,
          },
        },
        '& blockquote': {
          borderLeft: '4px solid',
          borderColor: 'primary.light',
          pl: 2,
          ml: 0,
          color: 'text.secondary',
          fontStyle: 'italic',
          mb: 1.5,
        },
        '& a': { color: 'primary.main', textDecoration: 'underline' },
        '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1 },
        '& hr': { my: 3, borderColor: 'divider' },
        '& table': { borderCollapse: 'collapse', width: '100%', mb: 2 },
        '& th, & td': { border: '1px solid', borderColor: 'divider', p: 1 },
        '& th': { bgcolor: 'grey.100', fontWeight: 'bold' },
      }}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </Box>
  );
}

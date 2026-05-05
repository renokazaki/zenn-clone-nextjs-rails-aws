'use client';

import { useActionState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { signUp } from '@/app/_actions/auth';

export default function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUp, null);

  return (
    <Box component="form" action={formAction} sx={{ width: '100%' }}>
      {state?.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {state.error}
        </Alert>
      )}

      <TextField
        margin="normal"
        required
        fullWidth
        name="name"
        label="ユーザー名"
        autoComplete="name"
        autoFocus
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="email"
        label="メールアドレス"
        type="email"
        autoComplete="email"
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="password"
        label="パスワード"
        type="password"
        autoComplete="new-password"
        inputProps={{ minLength: 8 }}
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        disabled={isPending}
        sx={{ mt: 3, mb: 2 }}
      >
        {isPending ? '送信中...' : 'サインアップ'}
      </Button>

      <Typography variant="body2" align="center">
        すでにアカウントをお持ちの方は{' '}
        <Link href="/sign_in" style={{ color: 'inherit' }}>
          サインイン
        </Link>
      </Typography>
    </Box>
  );
}

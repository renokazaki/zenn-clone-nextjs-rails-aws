'use client';

import { useActionState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { signIn } from '@/app/_actions/auth';

export default function SignInForm() {
  const [state, formAction, isPending] = useActionState(signIn, null);

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
        name="email"
        label="メールアドレス"
        type="email"
        autoComplete="email"
        autoFocus
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="password"
        label="パスワード"
        type="password"
        autoComplete="current-password"
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        disabled={isPending}
        sx={{ mt: 3, mb: 2 }}
      >
        {isPending ? 'サインイン中...' : 'サインイン'}
      </Button>

      <Typography variant="body2" align="center">
        アカウントをお持ちでない方は{' '}
        <Link href="/sign_up" style={{ color: 'inherit' }}>
          サインアップ
        </Link>
      </Typography>
    </Box>
  );
}

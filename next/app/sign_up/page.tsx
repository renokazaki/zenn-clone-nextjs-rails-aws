import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import SignUpForm from './_components/SignUpForm';

export default function SignUpPage() {
  return (
    <Container maxWidth="xs">
      <Box
        sx={{
          mt: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Typography component="h1" variant="h5" fontWeight="bold">
          サインアップ
        </Typography>
        <SignUpForm />
      </Box>
    </Container>
  );
}

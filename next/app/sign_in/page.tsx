import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import SignInForm from './_components/SignInForm';

export default function SignInPage() {
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
          サインイン
        </Typography>
        <SignInForm />
      </Box>
    </Container>
  );
}

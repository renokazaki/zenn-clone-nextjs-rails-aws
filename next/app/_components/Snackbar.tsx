'use client';

import { useState } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import MuiSnackbar from '@mui/material/Snackbar';
import Alert, { type AlertColor } from '@mui/material/Alert';

export default function Snackbar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const message = searchParams.get('message') ?? '';
  const severity = (searchParams.get('severity') as AlertColor | null) ?? 'success';
  const [open, setOpen] = useState(!!message);

  const handleClose = () => {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('message');
    params.delete('severity');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <MuiSnackbar
      open={open}
      autoHideDuration={3000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <Alert onClose={handleClose} severity={severity} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </MuiSnackbar>
  );
}

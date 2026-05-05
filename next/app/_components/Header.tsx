'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import PersonIcon from '@mui/icons-material/Person';
import { signOut } from '@/app/_actions/auth';
import { createArticle } from '@/app/_actions/articles';
import type { CurrentUser } from '@/types';

type Props = {
  currentUser: CurrentUser | null;
};

export default function Header({ currentUser }: Props) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  return (
    <AppBar position="static" color="default" elevation={1} sx={{ bgcolor: 'white' }}>
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <Box sx={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'primary.main' }}>
            Zenn Clone
          </Box>
        </Link>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {currentUser ? (
            <>
              <form action={createArticle}>
                <Button variant="contained" size="small" type="submit">
                  新規記事
                </Button>
              </form>

              <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                  <PersonIcon fontSize="small" />
                </Avatar>
              </IconButton>

              <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={() => setAnchorEl(null)}
                onClick={() => setAnchorEl(null)}
                slotProps={{ paper: { sx: { minWidth: 160 } } }}
              >
                <MenuItem disabled sx={{ fontSize: '0.8rem', opacity: '1 !important' }}>
                  {currentUser.name}
                </MenuItem>
                <Divider />
                <MenuItem component={Link} href="/current/articles">
                  記事の管理
                </MenuItem>
                <form action={signOut} style={{ display: 'contents' }}>
                  <MenuItem component="button" type="submit" sx={{ width: '100%' }}>
                    サインアウト
                  </MenuItem>
                </form>
              </Menu>
            </>
          ) : (
            <>
              <Button component={Link} href="/sign_in" variant="outlined" size="small">
                サインイン
              </Button>
              <Button component={Link} href="/sign_up" variant="contained" size="small">
                サインアップ
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

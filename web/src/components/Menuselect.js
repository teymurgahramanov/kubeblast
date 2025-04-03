import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Menu, MenuItem, ListItemIcon, ListItemText, Typography, Box, Avatar, Divider } from '@mui/material';
import { AccountCircle, Logout, People, Settings, Star, Person } from '@mui/icons-material';

const Menuselect = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const userRole = sessionStorage.getItem('user_role');
  const isPro = process.env.REACT_APP_IS_PRO === 'true';
  const proRedirectUrl = process.env.REACT_APP_PRO_REDIRECT_URL || 'https://kubeblast.teymur.pro';
  const username = sessionStorage.getItem('username');
  const firstLetter = username ? username.charAt(0).toUpperCase() : '';

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/login');
  };

  const handleNavigation = (path) => {
    navigate(path);
    handleClose();
  };

  const handleProFeature = () => {
    window.location.href = proRedirectUrl;
  };

  const renderProFeature = (text) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>{text}</Typography>
      <Star fontSize="small" sx={{ color: 'var(--warning-color)', fontSize: '0.8rem' }} />
    </Box>
  );

  return (
    <div>
      <Button
        onClick={handleClick}
        sx={{
          color: 'var(--text-primary)',
          textTransform: 'none',
          minWidth: 'auto',
          padding: '4px',
          '&:hover': { backgroundColor: 'var(--background-light)' }
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: 'var(--primary-color)',
            fontSize: '1rem',
            fontWeight: 600
          }}
        >
          {firstLetter}
        </Avatar>
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            mt: 1,
            '& .MuiMenuItem-root': {
              py: 1,
              px: 2
            }
          }
        }}
      >
        <MenuItem sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'flex-start',
          py: 2,
          cursor: 'default',
          '&:hover': { backgroundColor: 'transparent' }
        }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            @{username}
          </Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleNavigation('/profile')}>
          <ListItemIcon>
            <Person fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>

        {userRole === 'admin' && (
          <MenuItem onClick={isPro ? () => handleNavigation('/settings') : handleProFeature}>
            <ListItemIcon>
              <Settings fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              {isPro ? 'Settings' : renderProFeature('Settings')}
            </ListItemText>
          </MenuItem>
        )}

        {userRole === 'admin' && (
          <MenuItem onClick={isPro ? () => handleNavigation('/users') : handleProFeature}>
            <ListItemIcon>
              <People fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              {isPro ? 'Users' : renderProFeature('Users')}
            </ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={handleLogout} sx={{ color: 'var(--danger-color)' }}>
          <ListItemIcon>
            <Logout fontSize="small" sx={{ color: 'var(--danger-color)' }} />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>
    </div>
  );
};

export default Menuselect;

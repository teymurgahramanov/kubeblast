import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Menu, MenuItem, ListItemIcon, ListItemText, Typography, Box } from '@mui/material';
import { AccountCircle, Logout, People, Settings, Star } from '@mui/icons-material';

const Menuselect = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const userRole = sessionStorage.getItem('user_role');
  const isPro = process.env.REACT_APP_IS_PRO === 'true';

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
    window.location.href = 'https://jrunner.teymur.pro';
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
        startIcon={<AccountCircle />}
        sx={{
          color: 'var(--text-primary)',
          textTransform: 'none',
          '&:hover': { backgroundColor: 'var(--background-light)' }
        }}
      >
        {sessionStorage.getItem('username')}
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
        <MenuItem onClick={() => handleNavigation('/profile')}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => handleNavigation('/settings')}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {isPro ? 'Settings' : renderProFeature('Settings')}
          </ListItemText>
        </MenuItem>

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

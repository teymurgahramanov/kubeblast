import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { AccountCircle, Logout, People, Settings } from '@mui/icons-material';

const Menuselect = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const userRole = sessionStorage.getItem('user_role');

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
        {userRole === 'admin' && (
          <MenuItem onClick={() => handleNavigation('/users')}>
            <ListItemIcon>
              <People fontSize="small" />
            </ListItemIcon>
            <ListItemText>Users</ListItemText>
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

import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Menu, MenuItem, ListItemIcon, ListItemText, Typography, Box, Avatar, Divider } from '@mui/material';
import { AccountCircle, Logout, People, Settings, Star, Person, DarkMode, LightMode } from '@mui/icons-material';
import { ColorModeContext } from '../lib/theme';
import { getUserRole, getUsername } from '../utils/auth';
import axiosInstance from "../utils/axiosInstance";
import config from '../config.json';

const Menuselect = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const { mode, toggleColorMode } = useContext(ColorModeContext);
  const userRole = getUserRole();
  const [isPro, setIsPro] = useState(false);
  const proRedirectUrl = config.proRedirectUrl;
  const username = getUsername();
  const firstLetter = username ? username.charAt(0).toUpperCase() : '';

  useEffect(() => {
    const fetchAppStats = async () => {
      try {
        const res = await axiosInstance.get('/stats/app');
        setIsPro(Boolean(res.data?.LICENSE_VALID));
      } catch {
        setIsPro(false);
      }
    };
    fetchAppStats();
  }, []);

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
            width: 38,
            height: 38,
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

        <MenuItem onClick={() => { toggleColorMode(); handleClose(); }}>
          <ListItemIcon>
            {mode === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
          </ListItemIcon>
          <ListItemText>{mode === 'dark' ? 'Light theme' : 'Dark theme'}</ListItemText>
        </MenuItem>

        {userRole === 'admin' && isPro && (
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

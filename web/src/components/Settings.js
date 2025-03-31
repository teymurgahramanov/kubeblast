import React from 'react';
import { Box, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import Menuselect from "./Menuselect";

const Settings = () => {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'white',
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        px: 3,
        py: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Link to="/jobs" style={{ textDecoration: 'none' }}>
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 600, 
              color: 'var(--primary-color)',
              '&:hover': { color: 'var(--primary-dark)' }
            }}
          >
            JRunner
          </Typography>
        </Link>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Menuselect />
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 4, fontWeight: 600, color: 'var(--text-primary)' }}>
          Settings
        </Typography>
        <Typography variant="body1" sx={{ color: 'var(--text-secondary)' }}>
          Settings page content will be added here.
        </Typography>
      </Box>
    </Box>
  );
};

export default Settings; 
import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import axiosInstance from '../utils/axiosInstance';

const Footer = () => {
  const [appVersion, setAppVersion] = useState('');
  const [edition, setEdition] = useState('');

  useEffect(() => {
    const fetchAppVersion = async () => {
      try {
        const response = await axiosInstance.get('/stats/app');
        if (response.data?.APP_VERSION) {
          setAppVersion(response.data.APP_VERSION);
        }
        if (response.data?.EDITION) {
          setEdition(response.data.EDITION);
        }
      } catch (error) {
        console.error('Failed to fetch app version:', error);
        // Silently fail - footer will just not show version
      }
    };

    fetchAppVersion();
  }, []);

  return (
    <Box
      component="footer"
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '0.75rem 2rem',
        backgroundColor: 'var(--background-light)',
        borderTop: '1px solid var(--border-color)',
        textAlign: 'center',
        zIndex: 1000,
        transition: 'all 0.3s ease',
      }}
    >
      <Typography
        variant="body2"
        sx={{
          color: 'var(--text-secondary)',
          fontSize: '0.875rem',
          margin: 0,
        }}
      >
        {appVersion && appVersion}
        {appVersion && edition && ' • '}
        {edition && edition}
      </Typography>
    </Box>
  );
};

export default Footer;


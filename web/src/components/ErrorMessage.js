import React from 'react';
import { Box, Typography } from '@mui/material';
import { Cancel } from '@mui/icons-material';

const ErrorMessage = ({ message }) => {
  if (!message) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography 
        color="error" 
        sx={{ 
          p: 2, 
          bgcolor: '#FEE2E2', 
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <Cancel fontSize="small" />
        {message}
      </Typography>
    </Box>
  );
};

export default ErrorMessage; 
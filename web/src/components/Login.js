import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, TextField, Button, Alert } from '@mui/material';
import { Login as LoginIcon } from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";

const Login = () => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axiosInstance.post('/token', {
        username: credentials.username,
        password: credentials.password
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      // Store the token
      const token = response.data.access_token;
      sessionStorage.setItem('access_token', token);
      sessionStorage.setItem('username', credentials.username);

      // Decode the JWT token to get the role
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join('')
        );
        const decoded = JSON.parse(jsonPayload);
        sessionStorage.setItem('user_role', decoded.role);
      } catch (error) {
        console.error('Error decoding token:', error);
      }

      navigate('/jobs');
    } catch (error) {
      setError('Invalid username or password');
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--background-light)'
    }}>
      <Box sx={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        p: 4,
        mx: 2
      }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography 
            variant="h4" 
            component="h1" 
            sx={{ 
              fontWeight: 600, 
              color: 'var(--text-primary)',
              mb: 1
            }}
          >
            JRunner
          </Typography>
        </Box>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              borderRadius: 1,
              backgroundColor: '#FEE2E2',
              color: 'var(--danger-color)',
              '& .MuiAlert-icon': {
                color: 'var(--danger-color)'
              }
            }}
          >
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              required
              fullWidth
              label="Username"
              name="username"
              value={credentials.username}
              onChange={handleInputChange}
              variant="outlined"
              autoComplete="username"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'white',
                  '&:hover fieldset': {
                    borderColor: 'var(--primary-color)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'var(--primary-color)',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: 'var(--primary-color)',
                },
              }}
            />

            <TextField
              required
              fullWidth
              label="Password"
              name="password"
              type="password"
              value={credentials.password}
              onChange={handleInputChange}
              variant="outlined"
              autoComplete="current-password"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'white',
                  '&:hover fieldset': {
                    borderColor: 'var(--primary-color)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'var(--primary-color)',
                  },
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: 'var(--primary-color)',
                },
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              startIcon={<LoginIcon />}
              sx={{
                backgroundColor: 'var(--primary-color)',
                '&:hover': { backgroundColor: 'var(--primary-dark)' },
                textTransform: 'none',
                py: 1.5,
                mt: 2,
                borderRadius: '8px',
                fontWeight: 500
              }}
            >
              Sign In
            </Button>
          </Box>
        </form>
      </Box>
    </Box>
  );
};

export default Login;

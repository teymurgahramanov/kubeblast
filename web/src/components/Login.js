import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, TextField, Button } from '@mui/material';
import { Login as LoginIcon } from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";
import ErrorMessage from './ErrorMessage';

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
      setError(error.response?.data?.detail || 'Invalid username or password');
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
          <Box
            component="img"
            src="/logo.svg"
            alt="KubeBlast"
            sx={{
              height: 72,
              width: 'auto',
              mb: 2
            }}
          />
        </Box>

        <ErrorMessage message={error} />

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Username"
            name="username"
            value={credentials.username}
            onChange={handleInputChange}
            required
            margin="normal"
          />
          <TextField
            fullWidth
            type="password"
            label="Password"
            name="password"
            value={credentials.password}
            onChange={handleInputChange}
            required
            margin="normal"
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            startIcon={<LoginIcon />}
            sx={{
              mt: 3,
              backgroundColor: 'var(--primary-color)',
              '&:hover': { backgroundColor: 'var(--primary-dark)' },
              textTransform: 'none'
            }}
          >
            Login
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;

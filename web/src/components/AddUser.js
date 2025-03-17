import React, { useState } from 'react';
import { Box, Typography, TextField, Button, IconButton, Select, MenuItem, FormControl, InputLabel, FormControlLabel, Switch } from '@mui/material';
import { Close } from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';

const AddUser = ({ onClose }) => {
  const [userData, setUserData] = useState({
    username: '',
    full_name: '',
    role: '',
    password: '',
    confirmPassword: '',
    enabled: true
  });
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value, checked } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: name === 'enabled' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (userData.password !== userData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const formData = new URLSearchParams();
      formData.append('username', userData.username);
      formData.append('full_name', userData.full_name);
      formData.append('role', userData.role);
      formData.append('password', userData.password);
      formData.append('enabled', userData.enabled);

      await axiosInstance.post('/users', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      onClose();
      window.location.reload(); // Refresh to show the new user
    } catch (error) {
      setError('Error creating user: ' + (error.response?.data || error.message));
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 3
      }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          Add User
        </Typography>
        <IconButton 
          onClick={onClose}
          sx={{ 
            color: 'var(--text-secondary)',
            '&:hover': { color: 'var(--text-primary)' }
          }}
        >
          <Close />
        </IconButton>
      </Box>

      {error && (
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
            {error}
          </Typography>
        </Box>
      )}

      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            required
            fullWidth
            label="Username"
            name="username"
            value={userData.username}
            onChange={handleInputChange}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
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
            fullWidth
            label="Full Name"
            name="full_name"
            value={userData.full_name}
            onChange={handleInputChange}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
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

          <FormControl fullWidth>
            <InputLabel id="role-label" sx={{ 
              '&.Mui-focused': { 
                color: 'var(--primary-color)' 
              } 
            }}>
              Role
            </InputLabel>
            <Select
              labelId="role-label"
              label="Role"
              name="role"
              value={userData.role}
              onChange={handleInputChange}
              required
              sx={{
                '& .MuiOutlinedInput-notchedOutline': {
                  '&:hover': {
                    borderColor: 'var(--primary-color)',
                  },
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'var(--primary-color)',
                },
              }}
            >
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="moderator">Moderator</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>

          <TextField
            required
            fullWidth
            label="Password"
            name="password"
            type="password"
            value={userData.password}
            onChange={handleInputChange}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
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
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            value={userData.confirmPassword}
            onChange={handleInputChange}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
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

          <FormControlLabel
            control={
              <Switch
                checked={userData.enabled}
                onChange={handleInputChange}
                name="enabled"
                color="primary"
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: 'var(--primary-color)',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: 'var(--primary-color)',
                  },
                }}
              />
            }
            label={userData.enabled ? 'Enabled' : 'Disabled'}
            sx={{ mb: 1 }}
          />

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
            <Button
              onClick={onClose}
              variant="outlined"
              sx={{
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-color)',
                '&:hover': {
                  borderColor: 'var(--text-primary)',
                  backgroundColor: 'transparent'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              sx={{
                backgroundColor: 'var(--primary-color)',
                '&:hover': { backgroundColor: 'var(--primary-dark)' },
                textTransform: 'none'
              }}
            >
              Add
            </Button>
          </Box>
        </Box>
      </form>
    </Box>
  );
};

export default AddUser;

// components/FormEditUser.js
import React, { useState } from 'react';
import { Box, Typography, TextField, Button, IconButton, Select, MenuItem, FormControl, InputLabel, FormControlLabel, Switch } from '@mui/material';
import { Close } from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";
import ErrorMessage from './ErrorMessage';

const EditUser = ({ user, onClose, onUpdate }) => {
  const [userData, setUserData] = useState({
    username: user.username,
    email: user.email || '',
    full_name: user.full_name || '',
    role: user.role,
    enabled: user.enabled,
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (userData.password && userData.password !== userData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const dataToUpdate = {
        full_name: userData.full_name,
        role: userData.role,
        enabled: userData.enabled
      };

      // Only include email if it's not empty
      if (userData.email) {
        dataToUpdate.email = userData.email;
      }

      // Only include password if it's not empty
      if (userData.password) {
        dataToUpdate.password = userData.password;
      }

      const formData = new URLSearchParams();
      Object.entries(dataToUpdate).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value);
        }
      });

      await axiosInstance.put(`/users/${user.username}`, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });
      onUpdate();
      onClose();
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
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
          Edit User
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

      <ErrorMessage message={error} />

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
            disabled
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

          <TextField
            fullWidth
            label="Email (Optional)"
            name="email"
            type="email"
            value={userData.email}
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
            fullWidth
            label="New Password (Optional)"
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

          {userData.password && (
            <TextField
              fullWidth
              label="Confirm New Password"
              name="confirmPassword"
              type="password"
              value={userData.confirmPassword}
              onChange={handleInputChange}
              variant="outlined"
              required
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
          )}

          <FormControlLabel
            control={
              <Switch
                checked={userData.enabled}
                onChange={(e) => setUserData(prev => ({
                  ...prev,
                  enabled: e.target.checked
                }))}
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
              Save
            </Button>
          </Box>
        </Box>
      </form>
    </Box>
  );
};

export default EditUser;

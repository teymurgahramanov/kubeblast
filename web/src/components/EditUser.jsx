import { useState } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, Select, MenuItem,
  FormControl, InputLabel, FormControlLabel, Checkbox, Divider,
} from '@mui/material';
import { Close, Edit } from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';
import ErrorMessage from './ErrorMessage';

const inputSx = {
  '& .MuiOutlinedInput-root': { borderRadius: '10px' },
};

const EditUser = ({ user, onClose, onUpdate }) => {
  const [userData, setUserData] = useState({
    username: user.username,
    email: user.email || '',
    full_name: user.full_name || '',
    role: user.role,
    enabled: user.enabled,
    auto_approve: user.auto_approve || false,
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value, checked } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: e.target.type === 'checkbox' ? checked : value,
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
        enabled: userData.enabled,
        auto_approve: userData.auto_approve,
      };
      if (userData.email) dataToUpdate.email = userData.email;
      if (userData.password) dataToUpdate.password = userData.password;

      const formData = new URLSearchParams();
      Object.entries(dataToUpdate).forEach(([key, value]) => {
        if (value !== undefined && value !== null) formData.append(key, value);
      });
      await axiosInstance.put(`/users/${user.username}`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      onUpdate();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 36, height: 36, borderRadius: '10px',
            background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Edit sx={{ fontSize: 18, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: 'text.primary', lineHeight: 1.2 }}>
              Edit User
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {user.username}
            </Typography>
          </Box>
        </Box>
        <IconButton size="medium" onClick={onClose} sx={{ color: 'var(--text-secondary)', '&:hover': { color: 'var(--text-primary)' } }}>
          <Close sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      <Divider sx={{ mb: 2.5, mt: 1.5 }} />

      <ErrorMessage message={error} />

      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5 }}>
            <TextField size="medium" label="Full Name" name="full_name"
              value={userData.full_name} onChange={handleInputChange} sx={inputSx} />
            <TextField size="medium" label="Email" name="email" type="email"
              value={userData.email} onChange={handleInputChange} sx={inputSx} />
          </Box>

          <FormControl size="medium" sx={inputSx}>
            <InputLabel>Role</InputLabel>
            <Select label="Role" name="role" value={userData.role} onChange={handleInputChange} required>
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="moderator">Moderator</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5 }}>
            <TextField size="medium" label="New Password" name="password" type="password"
              value={userData.password} onChange={handleInputChange} sx={inputSx}
              placeholder="Leave blank to keep" />
            {userData.password && (
              <TextField size="medium" required label="Confirm Password" name="confirmPassword" type="password"
                value={userData.confirmPassword} onChange={handleInputChange} sx={inputSx} />
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 3 }}>
            <FormControlLabel
              control={<Checkbox checked={userData.enabled} onChange={handleInputChange} name="enabled" size="medium"
                sx={{ color: 'var(--text-secondary)', '&.Mui-checked': { color: 'var(--primary-color)' } }} />}
              label={<Typography sx={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Enabled</Typography>}
            />
            <FormControlLabel
              control={<Checkbox checked={userData.auto_approve} onChange={handleInputChange} name="auto_approve" size="medium"
                sx={{ color: 'var(--text-secondary)', '&.Mui-checked': { color: 'var(--primary-color)' } }} />}
              label={<Typography sx={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Auto-approve Jobs</Typography>}
            />
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
            <Button onClick={onClose} variant="outlined"
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, px: 2.5, py: 0.8, fontSize: '0.9rem' }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained"
              sx={{
                borderRadius: '10px', textTransform: 'none', fontWeight: 600, px: 2.5, py: 0.8, fontSize: '0.9rem',
                background: 'linear-gradient(135deg, #326CE5 0%, #1e40af 100%)',
                boxShadow: 'none',
                '&:hover': { background: 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)' },
              }}
            >
              Save Changes
            </Button>
          </Box>
        </Box>
      </form>
    </Box>
  );
};

export default EditUser;

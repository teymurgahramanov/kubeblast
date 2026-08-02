import { useState } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, Select, MenuItem,
  FormControl, InputLabel, FormControlLabel, Checkbox, Divider,
} from '@mui/material';
import { Close, PersonAdd } from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';
import ErrorMessage from './ErrorMessage';

const inputSx = {
  '& .MuiOutlinedInput-root': { borderRadius: '10px' },
};

const AddUser = ({ onClose }) => {
  const [formData, setFormData] = useState({
    username: '', full_name: '', email: '',
    password: '', confirmPassword: '',
    role: 'user', enabled: true, auto_approve: false,
  });
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: e.target.type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      const userData = { ...formData };
      delete userData.confirmPassword;
      const formDataToSend = new URLSearchParams();
      Object.entries(userData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) formDataToSend.append(key, value);
      });
      await axiosInstance.post('/users', formDataToSend, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
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
            background: 'linear-gradient(135deg, #326CE5, #7aa2f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PersonAdd sx={{ fontSize: 18, color: '#fff' }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: 'text.primary' }}>
            Add User
          </Typography>
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
            <TextField size="medium" required label="Username" name="username"
              value={formData.username} onChange={handleInputChange} sx={inputSx} />
            <TextField size="medium" label="Full Name" name="full_name"
              value={formData.full_name} onChange={handleInputChange} sx={inputSx} />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5 }}>
            <TextField size="medium" label="Email" name="email" type="email"
              value={formData.email} onChange={handleInputChange} sx={inputSx} />
            <FormControl size="medium" sx={inputSx}>
              <InputLabel>Role</InputLabel>
              <Select label="Role" name="role" value={formData.role} onChange={handleInputChange} required>
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="moderator">Moderator</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5 }}>
            <TextField size="medium" required label="Password" name="password" type="password"
              value={formData.password} onChange={handleInputChange} sx={inputSx} />
            <TextField size="medium" required label="Confirm Password" name="confirmPassword" type="password"
              value={formData.confirmPassword} onChange={handleInputChange} sx={inputSx} />
          </Box>

          <Box sx={{ display: 'flex', gap: 3 }}>
            <FormControlLabel
              control={<Checkbox checked={formData.enabled} onChange={handleInputChange} name="enabled" size="medium"
                sx={{ color: 'var(--text-secondary)', '&.Mui-checked': { color: 'var(--primary-color)' } }} />}
              label={<Typography sx={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Enabled</Typography>}
            />
            <FormControlLabel
              control={<Checkbox checked={formData.auto_approve} onChange={handleInputChange} name="auto_approve" size="medium"
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
              Add User
            </Button>
          </Box>
        </Box>
      </form>
    </Box>
  );
};

export default AddUser;

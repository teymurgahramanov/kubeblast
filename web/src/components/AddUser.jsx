import { useState } from 'react';
import {
  Box, Button, Checkbox, CircularProgress, Divider, FormControl,
  FormControlLabel, IconButton, InputLabel, MenuItem, Select,
  TextField, Typography,
} from '@mui/material';
import { Close, PersonAdd } from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';
import ErrorMessage from './ErrorMessage';

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    backgroundColor: 'background.paper',
  },
};

const optionSx = {
  m: 0,
  px: 1.5,
  py: 1.1,
  minHeight: 58,
  border: '1px solid var(--border-color)',
  borderRadius: '10px',
  alignItems: 'center',
  '& .MuiFormControlLabel-label': { flex: 1 },
};

const AddUser = ({ onClose }) => {
  const [formData, setFormData] = useState({
    username: '', full_name: '', email: '',
    password: '', confirmPassword: '',
    role: 'user', enabled: true, auto_approve: false,
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (event) => {
    const { name, value, checked } = event.target;
    setFormData((currentData) => ({
      ...currentData,
      [name]: event.target.type === 'checkbox' ? checked : value,
    }));
    if (error) setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    setError('');
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
      setIsSubmitting(false);
      onClose();
    } catch (submitError) {
      setError(submitError.response?.data?.detail || submitError.message);
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2.25, sm: 3.5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Box sx={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            backgroundColor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <PersonAdd sx={{ fontSize: 21, color: 'primary.contrastText' }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography id="add-user-title" sx={{ fontWeight: 700, fontSize: '1.15rem', color: 'text.primary', lineHeight: 1.25 }}>
              Add user
            </Typography>
            <Typography sx={{ mt: 0.35, fontSize: '0.8rem', color: 'text.secondary' }}>
              Create an account and configure its access.
            </Typography>
          </Box>
        </Box>
        <IconButton
          aria-label="Close add user dialog"
          size="small"
          onClick={onClose}
          disabled={isSubmitting}
          sx={{ color: 'var(--text-secondary)', '&:hover': { color: 'var(--text-primary)' } }}
        >
          <Close sx={{ fontSize: 19 }} />
        </IconButton>
      </Box>

      <Divider sx={{ my: 2.5 }} />
      <ErrorMessage message={error} />

      <Box component="form" onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary', mb: 1.5 }}>
              Account details
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                required
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                autoComplete="username"
                sx={inputSx}
              />
              <TextField
                label="Full name"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                autoComplete="name"
                sx={inputSx}
              />
              <TextField
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                autoComplete="email"
                sx={inputSx}
              />
              <FormControl sx={inputSx}>
                <InputLabel>Role</InputLabel>
                <Select label="Role" name="role" value={formData.role} onChange={handleInputChange} required>
                  <MenuItem value="user">User</MenuItem>
                  <MenuItem value="moderator">Moderator</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary', mb: 1.5 }}>
              Security
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                required
                label="Password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                autoComplete="new-password"
                sx={inputSx}
              />
              <TextField
                required
                label="Confirm password"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                autoComplete="new-password"
                error={Boolean(formData.confirmPassword && formData.password !== formData.confirmPassword)}
                sx={inputSx}
              />
            </Box>
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary', mb: 1.5 }}>
              Access settings
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <FormControlLabel
                sx={optionSx}
                control={(
                  <Checkbox
                    checked={formData.enabled}
                    onChange={handleInputChange}
                    name="enabled"
                    sx={{ color: 'var(--text-secondary)', '&.Mui-checked': { color: 'var(--primary-color)' } }}
                  />
                )}
                label={(
                  <Box>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>Enabled</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Allow this user to sign in</Typography>
                  </Box>
                )}
              />
              <FormControlLabel
                sx={optionSx}
                control={(
                  <Checkbox
                    checked={formData.auto_approve}
                    onChange={handleInputChange}
                    name="auto_approve"
                    sx={{ color: 'var(--text-secondary)', '&.Mui-checked': { color: 'var(--primary-color)' } }}
                  />
                )}
                label={(
                  <Box>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>Auto-approve jobs</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Skip manual job approval</Typography>
                  </Box>
                )}
              />
            </Box>
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', gap: 1.25, justifyContent: 'flex-end' }}>
            <Button onClick={onClose} variant="outlined" disabled={isSubmitting} sx={{ px: 2.5, minHeight: 42 }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={17} color="inherit" /> : <PersonAdd fontSize="small" />}
              sx={{ px: 2.5, minHeight: 42 }}
            >
              {isSubmitting ? 'Adding…' : 'Add user'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default AddUser;

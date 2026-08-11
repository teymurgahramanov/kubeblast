import { useState } from 'react';
import {
  Box, Button, Checkbox, CircularProgress, Divider, FormControl,
  FormControlLabel, IconButton, InputLabel, MenuItem, Select,
  TextField, Typography,
} from '@mui/material';
import { Close, Edit } from '@mui/icons-material';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (event) => {
    const { name, value, checked } = event.target;
    setUserData((currentData) => ({
      ...currentData,
      [name]: event.target.type === 'checkbox' ? checked : value,
    }));
    if (error) setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (userData.password && userData.password !== userData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    setError('');
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
      setIsSubmitting(false);
      onUpdate();
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
            backgroundColor: 'secondary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Edit sx={{ fontSize: 21, color: 'secondary.contrastText' }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography id="edit-user-title" sx={{ fontWeight: 700, fontSize: '1.15rem', color: 'text.primary', lineHeight: 1.25 }}>
              Edit user
            </Typography>
            <Typography sx={{ mt: 0.35, fontSize: '0.8rem', color: 'text.secondary' }} noWrap>
              Update access for {user.username}
            </Typography>
          </Box>
        </Box>
        <IconButton
          aria-label="Close edit user dialog"
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
                label="Full name"
                name="full_name"
                value={userData.full_name}
                onChange={handleInputChange}
                autoComplete="name"
                sx={inputSx}
              />
              <TextField
                label="Email"
                name="email"
                type="email"
                value={userData.email}
                onChange={handleInputChange}
                autoComplete="email"
                sx={inputSx}
              />
              <FormControl sx={{ ...inputSx, gridColumn: { sm: '1 / -1' } }}>
                <InputLabel>Role</InputLabel>
                <Select label="Role" name="role" value={userData.role} onChange={handleInputChange} required>
                  <MenuItem value="user">User</MenuItem>
                  <MenuItem value="moderator">Moderator</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary', mb: 0.4 }}>
              Change password
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1.5 }}>
              Leave this section blank to keep the current password.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="New password"
                name="password"
                type="password"
                value={userData.password}
                onChange={handleInputChange}
                autoComplete="new-password"
                sx={inputSx}
              />
              <TextField
                label="Confirm password"
                name="confirmPassword"
                type="password"
                value={userData.confirmPassword}
                onChange={handleInputChange}
                autoComplete="new-password"
                required={Boolean(userData.password)}
                disabled={!userData.password}
                error={Boolean(userData.confirmPassword && userData.password !== userData.confirmPassword)}
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
                    checked={userData.enabled}
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
                    checked={userData.auto_approve}
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
              startIcon={isSubmitting ? <CircularProgress size={17} color="inherit" /> : <Edit fontSize="small" />}
              sx={{ px: 2.5, minHeight: 42 }}
            >
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default EditUser;

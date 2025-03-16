import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Alert } from '@mui/material';
import axiosInstance from "../utils/axiosInstance";

const Profile = () => {
  const [profile, setProfile] = useState({
    full_name: '',
    email: ''
  });
  const [passwords, setPasswords] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await axiosInstance.get('/users/me', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` }
      });
      setProfile({
        full_name: response.data.full_name || '',
        email: response.data.email || ''
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error fetching profile: ' + (error.response?.data?.detail || error.message)
      });
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axiosInstance.put('/users/me', 
        { full_name: profile.full_name },
        { headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` } }
      );
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setProfile(prev => ({ ...prev, ...response.data }));
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error updating profile: ' + (error.response?.data?.detail || error.message)
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm_password) {
      setMessage({ type: 'error', text: 'New passwords do not match!' });
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.put('/users/me/password', 
        {
          current_password: passwords.current_password,
          new_password: passwords.new_password
        },
        { headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` } }
      );
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error updating password: ' + (error.response?.data?.detail || error.message)
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, p: 3 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 4, fontWeight: 600, color: 'var(--text-primary)' }}>
        Profile Settings
      </Typography>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage({ type: '', text: '' })}>
          {message.text}
        </Alert>
      )}

      <Box component="form" onSubmit={handleProfileUpdate} sx={{ mb: 6 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Personal Information</Typography>
        <TextField
          fullWidth
          label="Full Name"
          value={profile.full_name}
          onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
          margin="normal"
          variant="outlined"
        />
        <TextField
          fullWidth
          label="Email"
          value={profile.email}
          disabled
          margin="normal"
          variant="outlined"
          sx={{ mb: 2 }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          sx={{
            backgroundColor: 'var(--primary-color)',
            '&:hover': { backgroundColor: 'var(--primary-dark)' },
            mt: 2
          }}
        >
          Update Profile
        </Button>
      </Box>

      <Box component="form" onSubmit={handlePasswordChange}>
        <Typography variant="h6" sx={{ mb: 2 }}>Change Password</Typography>
        <TextField
          fullWidth
          type="password"
          label="Current Password"
          value={passwords.current_password}
          onChange={(e) => setPasswords(prev => ({ ...prev, current_password: e.target.value }))}
          margin="normal"
          variant="outlined"
        />
        <TextField
          fullWidth
          type="password"
          label="New Password"
          value={passwords.new_password}
          onChange={(e) => setPasswords(prev => ({ ...prev, new_password: e.target.value }))}
          margin="normal"
          variant="outlined"
        />
        <TextField
          fullWidth
          type="password"
          label="Confirm New Password"
          value={passwords.confirm_password}
          onChange={(e) => setPasswords(prev => ({ ...prev, confirm_password: e.target.value }))}
          margin="normal"
          variant="outlined"
          sx={{ mb: 2 }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          sx={{
            backgroundColor: 'var(--primary-color)',
            '&:hover': { backgroundColor: 'var(--primary-dark)' },
            mt: 2
          }}
        >
          Change Password
        </Button>
      </Box>
    </Box>
  );
};

export default Profile; 
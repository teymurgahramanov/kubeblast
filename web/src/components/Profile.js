import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Alert } from '@mui/material';
import { Link } from 'react-router-dom';
import axiosInstance from "../utils/axiosInstance";
import Menuselect from "./Menuselect";

const Profile = () => {
  const [profile, setProfile] = useState({
    full_name: '',
    email: ''
  });
  const [passwords, setPasswords] = useState({
    new_password: '',
    confirm_password: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  const fetchProfile = async () => {
    try {
      const username = sessionStorage.getItem('username');
      if (!username) {
        throw new Error('No username found in session');
      }
      
      const response = await axiosInstance.get(`/profile`, {
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

  // Fetch profile on mount and after any updates
  useEffect(() => {
    fetchProfile();
  }, []);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('full_name', profile.full_name);
      formData.append('email', profile.email);

      await axiosInstance.put('/profile', formData, {
        headers: { 
          Authorization: `Bearer ${sessionStorage.getItem('access_token')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      fetchProfile(); // Refresh data after update
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
      setMessage({ type: 'error', text: 'Passwords do not match!' });
      return;
    }
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('password', passwords.new_password);

      await axiosInstance.put('/profile', formData, {
        headers: { 
          Authorization: `Bearer ${sessionStorage.getItem('access_token')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setPasswords({ new_password: '', confirm_password: '' });
      
      // Force logout after password change
      sessionStorage.clear();
      window.location.href = '/login';
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
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'background.paper',
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        px: 3,
        py: 1,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center'
      }}>
        <Link to="/jobs" style={{ textDecoration: 'none', justifySelf: 'start' }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="KubeBlast"
            sx={{
              height: 36,
              width: 'auto',
              '&:hover': { opacity: 0.8 }
            }}
          />
        </Link>
        <Typography variant="h6" sx={{ fontWeight: 600, textAlign: 'center' }}>
          Profile
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifySelf: 'end' }}>
          <Menuselect />
        </Box>
      </Box>

      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, p: 3 }}>

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
            type="email"
            value={profile.email}
            onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
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
    </Box>
  );
};

export default Profile; 
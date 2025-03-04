// components/FormEditUser.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Typography,
  TextField,
  Button,
  Container,
  Box,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
} from '@mui/material';
import axiosInstance from '../utils/axiosInstance';

const FormEditUser = () => {
  const { username } = useParams(); 
  const [userData, setUserData] = useState({
    username: '',
    fullName: '',
    role: '',
    password: '',
    confPassword: '',
    enabled: true,
  });
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  // Fetch user data when the component mounts
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axiosInstance.get(`/users/${username}`);
        setUserData({
          username: response.data.username,
          fullName: response.data.full_name,
          role: response.data.role,
          password: '',
          confPassword: '',
          enabled: response.data.enabled,
        });
      } catch (error) {
        setMsg('User not found or error fetching data.');
      }
    };
    fetchUserData();
  }, [username]);

  // Handler for form submission
  const editUser = async (e) => {
    e.preventDefault();

    // Validate that passwords match
    if (userData.password !== userData.confPassword) {
      setMsg('Passwords do not match!');
      return;
    }

    // Validate that a role is selected
    if (!userData.role) {
      setMsg('Please select a role.');
      return;
    }

    try {
      // Send PUT request to update the user
      await axiosInstance.put(`/users/${username}`, {
        username: userData.username,
        full_name: userData.fullName,
        role: userData.role,
        password: userData.password, // Optionally, can handle password change separately
        enabled: userData.enabled, // Include the enabled status
      });

      // Navigate to the users list page upon successful update
      navigate('/users');
    } catch (error) {
      // Handle errors and display appropriate message
      if (error.response) {
        setMsg(error.response.data.msg);
      } else {
        setMsg('Something went wrong. Please try again.');
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#14213D',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          backgroundColor: '#fff',
          padding: 4,
          borderRadius: 2,
          boxShadow: 3,
        }}
      >
        <Typography variant="h4" align="center" gutterBottom>
          Edit User
        </Typography>
        {msg && <Alert severity="error">{msg}</Alert>}
        <form onSubmit={editUser}>
          <TextField
            label="Username"
            variant="outlined"
            fullWidth
            margin="normal"
            value={userData.username}
            onChange={handleChange}
            name="username"
            required
          />
          <TextField
            label="Full Name"
            variant="outlined"
            fullWidth
            margin="normal"
            value={userData.fullName}
            onChange={handleChange}
            name="fullName"
            required
          />
          <FormControl fullWidth variant="outlined" margin="normal">
            <InputLabel>Role*</InputLabel>
            <Select
              name="role"
              value={userData.role}
              onChange={handleChange}
              required
            >
              <MenuItem value="">Choose option</MenuItem>
              <MenuItem value="admin">admin</MenuItem>
              <MenuItem value="moderator">moderator</MenuItem>
              <MenuItem value="user">user</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Password"
            type="password"
            variant="outlined"
            fullWidth
            margin="normal"
            value={userData.password}
            onChange={handleChange}
            name="password"
          />
          <TextField
            label="Confirm Password"
            type="password"
            variant="outlined"
            fullWidth
            margin="normal"
            value={userData.confPassword}
            onChange={handleChange}
            name="confPassword"
          />
          <FormControlLabel
            control={
              <Switch
                checked={userData.enabled}
                onChange={(e) => setUserData({ ...userData, enabled: e.target.checked })}
                color="primary"
              />
            }
            label="Enabled"
            sx={{ mt: 2 }}
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 3, backgroundColor: '#FCA311' }}
          >
            Save Changes
          </Button>
        </form>
      </Container>
    </Box>
  );
};

export default FormEditUser;

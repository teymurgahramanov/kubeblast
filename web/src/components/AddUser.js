import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const FormAddUser = ({ onAddUser }) => {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [password, setPassword] = useState('');
  const [confPassword, setConfPassword] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [msg, setMsg] = useState('');
  const navigate = useNavigate(); // Assuming navigate is being used

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (password !== confPassword) {
      setMsg('Passwords do not match!');
      return;
    }
    if (!role) {
      setMsg('Please select a role.');
      return;
    }
    if (!username) {
      setMsg('Please enter a username.');
      return;
    }

    // Create FormData instance
    const formData = new FormData();
    formData.append('username', username);
    formData.append('full_name', fullName);
    formData.append('role', role);
    formData.append('password', password);
    formData.append('enabled', enabled);

    try {
      // Send FormData with Content-Type application/x-www-form-urlencoded
      const response = await axiosInstance.post('/users', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      onAddUser(response.data); // Pass the new user data back to parent
      navigate('/users'); // Navigate to the user list page or another appropriate page
    } catch (error) {
      console.error("Error occurred:", error.response?.data); // Log the full error response
      setMsg(error.response?.data?.msg || 'An error occurred while saving.');
    }
  };

  const handleRoleChange = (e) => {
    setRole(e.target.value);
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#14213D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Container maxWidth="sm" sx={{ backgroundColor: '#fff', padding: 4, borderRadius: 2, boxShadow: 3 }}>
        <Typography variant="h4" align="center" gutterBottom>
          Add User
        </Typography>
        {msg && <Alert severity="error">{msg}</Alert>}
        <form onSubmit={handleSubmit}>
          <TextField
            label="Username"
            fullWidth
            value={username} // Ensure controlled input
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <TextField
            label="Full Name"
            fullWidth
            value={fullName} // Ensure controlled input
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <FormControl fullWidth variant="outlined" margin="normal">
            <InputLabel>Role*</InputLabel>
            <Select
              name="role"
              value={role} // Ensure controlled input
              onChange={handleRoleChange}
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
            fullWidth
            value={password} // Ensure controlled input
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <TextField
            label="Confirm Password"
            type="password"
            fullWidth
            value={confPassword} // Ensure controlled input
            onChange={(e) => setConfPassword(e.target.value)}
            required
          />

          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
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
            Add User
          </Button>
        </form>
      </Container>
    </Box>
  );
};

export default FormAddUser;

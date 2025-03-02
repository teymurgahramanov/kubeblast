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
  
    const handleSubmit = async (e) => {
      e.preventDefault();
  
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
  
      try {
        await axiosInstance.post('/users', {
          username,
          full_name: fullName,
          role,
          password,
          enabled,
        });
  
        onAddUser(); // Close modal on success
      } catch (error) {
        setMsg(error.response?.data?.msg || 'Something went wrong. Please try again.');
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
            <TextField label="Username" fullWidth value={username} onChange={(e) => setUsername(e.target.value)} required />
            <TextField label="Full Name" fullWidth value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            
            <FormControl fullWidth variant="outlined" margin="normal">
              <InputLabel>Role*</InputLabel>
              <Select
                name="role"
                value={role}
                onChange={handleRoleChange}
                required
              >
                <MenuItem value="">Choose option</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="moderator">Moderator</MenuItem>
                <MenuItem value="user">User</MenuItem>
              </Select>
            </FormControl>

            <TextField label="Password" type="password" fullWidth value={password} onChange={(e) => setPassword(e.target.value)} required />
            <TextField label="Confirm Password" type="password" fullWidth value={confPassword} onChange={(e) => setConfPassword(e.target.value)} required />

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
            <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 3, backgroundColor: '#FCA311' }}>
              Add User
            </Button>
          </form>
        </Container>
      </Box>
    );
};

export default FormAddUser;

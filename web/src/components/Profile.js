import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, TextField, Button, Alert, IconButton, 
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Tooltip
} from '@mui/material';
import { Add, Delete, Block, ContentCopy, Key } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import axiosInstance from "../utils/axiosInstance";
import Menuselect from "./Menuselect";

const Profile = () => {
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    role: ''
  });
  const [passwords, setPasswords] = useState({
    new_password: '',
    confirm_password: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  
  // PAT state
  const [pats, setPats] = useState([]);
  const [patDialogOpen, setPatDialogOpen] = useState(false);
  const [newPatName, setNewPatName] = useState('');
  const [newPatExpiry, setNewPatExpiry] = useState('');
  const [createdToken, setCreatedToken] = useState('');
  const [tokenCopied, setTokenCopied] = useState(false);

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
        email: response.data.email || '',
        role: response.data.role || ''
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error fetching profile: ' + (error.response?.data?.detail || error.message)
      });
    }
  };

  const fetchPats = async () => {
    try {
      const response = await axiosInstance.get('/profile/pats', {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` }
      });
      setPats(response.data);
    } catch (error) {
      console.error('Error fetching PATs:', error);
    }
  };

  // Fetch profile and PATs on mount
  useEffect(() => {
    fetchProfile();
    fetchPats();
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

  const handleCreatePat = async () => {
    if (!newPatName || newPatName.length < 3) {
      setMessage({ type: 'error', text: 'PAT name must be at least 3 characters' });
      return;
    }
    setLoading(true);
    try {
      const payload = { 
        name: newPatName,
        expires_in_days: newPatExpiry ? parseInt(newPatExpiry) : null
      };
      const response = await axiosInstance.post('/profile/pats', payload, {
        headers: { 
          Authorization: `Bearer ${sessionStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });
      setCreatedToken(response.data.token);
      setNewPatName('');
      setNewPatExpiry('');
      fetchPats();
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error creating PAT: ' + (error.response?.data?.detail || error.message)
      });
      setPatDialogOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokePat = async (patId) => {
    try {
      await axiosInstance.post(`/profile/pats/${patId}/revoke`, {}, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` }
      });
      setMessage({ type: 'success', text: 'PAT revoked successfully' });
      fetchPats();
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error revoking PAT: ' + (error.response?.data?.detail || error.message)
      });
    }
  };

  const handleDeletePat = async (patId) => {
    try {
      await axiosInstance.delete(`/profile/pats/${patId}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` }
      });
      setMessage({ type: 'success', text: 'PAT deleted successfully' });
      fetchPats();
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Error deleting PAT: ' + (error.response?.data?.detail || error.message)
      });
    }
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(createdToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const handleCloseTokenDialog = () => {
    setCreatedToken('');
    setPatDialogOpen(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
            label="Role"
            value={profile.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : ''}
            margin="normal"
            variant="outlined"
            InputProps={{
              readOnly: true,
            }}
          />
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

        {/* Personal Access Tokens Section */}
        <Box sx={{ mt: 6 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Personal Access Tokens</Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setPatDialogOpen(true)}
              sx={{
                backgroundColor: 'var(--primary-color)',
                '&:hover': { backgroundColor: 'var(--primary-dark)' },
                textTransform: 'none'
              }}
            >
              Create Token
            </Button>
          </Box>
          
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2 }}>
            Personal access tokens can be used to authenticate API requests without using your password.
          </Typography>

          {pats.length === 0 ? (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              py: 4,
              backgroundColor: 'background.paper',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <Key sx={{ fontSize: 48, color: 'var(--text-secondary)', opacity: 0.5, mb: 1 }} />
              <Typography sx={{ color: 'var(--text-secondary)' }}>
                No personal access tokens yet
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{
              backgroundColor: 'background.paper',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'var(--background-light)' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Expires</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Last Used</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pats.map((pat) => (
                    <TableRow key={pat.id} sx={{ '&:hover': { backgroundColor: 'var(--background-light)' } }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Key sx={{ fontSize: 18, color: 'var(--text-secondary)' }} />
                          {pat.name}
                        </Box>
                      </TableCell>
                      <TableCell>{formatDate(pat.created_at)}</TableCell>
                      <TableCell>{formatDate(pat.expires_at)}</TableCell>
                      <TableCell>{formatDate(pat.last_used_at)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={pat.revoked ? 'Revoked' : 'Active'}
                          sx={{
                            backgroundColor: pat.revoked ? '#FCA5A5' : '#BBF7D0',
                            color: pat.revoked ? '#7F1D1D' : '#047857',
                            fontWeight: 600
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          {!pat.revoked && (
                            <Tooltip title="Revoke">
                              <IconButton
                                size="small"
                                onClick={() => handleRevokePat(pat.id)}
                                sx={{ color: 'var(--warning-color)' }}
                              >
                                <Block fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              onClick={() => handleDeletePat(pat.id)}
                              sx={{ color: 'var(--danger-color)' }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Box>

      {/* Create PAT Dialog */}
      <Dialog 
        open={patDialogOpen && !createdToken} 
        onClose={() => setPatDialogOpen(false)}
        PaperProps={{
          sx: { borderRadius: '12px', minWidth: 400 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Create Personal Access Token</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Token Name"
            placeholder="e.g., CI/CD Pipeline"
            value={newPatName}
            onChange={(e) => setNewPatName(e.target.value)}
            margin="normal"
            variant="outlined"
            inputProps={{ minLength: 3, maxLength: 20 }}
            helperText="3-20 characters"
          />
          <TextField
            fullWidth
            label="Expires in (days)"
            type="number"
            placeholder="Leave empty for no expiration"
            value={newPatExpiry}
            onChange={(e) => setNewPatExpiry(e.target.value)}
            margin="normal"
            variant="outlined"
            inputProps={{ min: 1, max: 3650 }}
            helperText="Optional: 1-3650 days"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPatDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreatePat}
            disabled={loading || newPatName.length < 3}
            sx={{
              backgroundColor: 'var(--primary-color)',
              '&:hover': { backgroundColor: 'var(--primary-dark)' },
              textTransform: 'none'
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Token Created Dialog */}
      <Dialog 
        open={!!createdToken} 
        onClose={handleCloseTokenDialog}
        PaperProps={{
          sx: { borderRadius: '12px', minWidth: 500 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, color: 'var(--success-color)' }}>
          Token Created Successfully
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Make sure to copy your token now. You won't be able to see it again!
          </Alert>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 2,
            backgroundColor: 'var(--background-light)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            wordBreak: 'break-all'
          }}>
            <Box sx={{ flex: 1 }}>{createdToken}</Box>
            <Tooltip title={tokenCopied ? 'Copied!' : 'Copy to clipboard'}>
              <IconButton onClick={handleCopyToken} size="small">
                <ContentCopy fontSize="small" sx={{ color: tokenCopied ? 'var(--success-color)' : 'inherit' }} />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            onClick={handleCloseTokenDialog}
            sx={{
              backgroundColor: 'var(--primary-color)',
              '&:hover': { backgroundColor: 'var(--primary-dark)' },
              textTransform: 'none'
            }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Profile; 
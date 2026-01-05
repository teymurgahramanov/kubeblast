import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, TextField, Button, FormControl, InputLabel, Select, MenuItem, Divider } from '@mui/material';
import { Login as LoginIcon } from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";
import ErrorMessage from './ErrorMessage';
import Footer from './Footer';

const Login = () => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [authMethod, setAuthMethod] = useState('local');
  const [error, setError] = useState('');
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Check OIDC configuration on mount
  useEffect(() => {
    const checkOIDCConfig = async () => {
      try {
        const response = await axiosInstance.get('/oidc/enabled');
        setOidcEnabled(response.data.enabled);
      } catch (error) {
        console.error('Failed to check OIDC config:', error);
      }
    };
    checkOIDCConfig();

    const checkLicense = async () => {
      try {
        const res = await axiosInstance.get('/stats/app');
        setIsPro(Boolean(res.data?.LICENSE_VALID));
      } catch {
        setIsPro(false);
      }
    };
    checkLicense();
  }, []);

  // Handle OIDC callback
  useEffect(() => {
    const handleOIDCCallback = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');

      if (error) {
        setError(`OIDC authentication failed: ${params.get('error_description') || error}`);
        // Clean up URL
        navigate('/login', { replace: true });
        return;
      }

      if (code && state) {
        try {
          const response = await axiosInstance.get(`/oidc/callback?code=${code}&state=${state}`);
          
          // Store the tokens
          sessionStorage.setItem('access_token', response.data.access_token);
          sessionStorage.setItem('refresh_token', response.data.refresh_token);
          sessionStorage.setItem('username', response.data.username);
          sessionStorage.setItem('user_role', response.data.role);

          navigate('/jobs');
        } catch (error) {
          setError(error.response?.data?.detail || 'OIDC authentication failed');
          navigate('/login', { replace: true });
        }
      }
    };

    handleOIDCCallback();
  }, [location, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAuthMethodChange = (e) => {
    setAuthMethod(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const form = new URLSearchParams();
      form.append('username', credentials.username);
      form.append('password', credentials.password);
      // Optional but harmless; OAuth2PasswordRequestForm recognizes these
      form.append('grant_type', 'password');
      form.append('scope', '');

      const response = await axiosInstance.post(
        `/token?method=${authMethod.toLowerCase()}`,
        form
      );
      
      // Store the tokens
      const token = response.data.access_token;
      sessionStorage.setItem('access_token', token);
      sessionStorage.setItem('refresh_token', response.data.refresh_token);
      sessionStorage.setItem('username', credentials.username);

      // Decode the JWT token to get the role
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join('')
        );
        const decoded = JSON.parse(jsonPayload);
        sessionStorage.setItem('user_role', decoded.role);
      } catch (error) {
        console.error('Error decoding token:', error);
      }

      navigate('/jobs');
    } catch (error) {
      setError(error.response?.data?.detail || 'Invalid username or password');
    }
  };

  const handleOIDCLogin = async () => {
    try {
      const response = await axiosInstance.get('/oidc/authorize');
      const { authorization_url, state } = response.data;
      
      // Store state in sessionStorage for verification
      sessionStorage.setItem('oidc_state', state);
      
      // Redirect to OIDC provider
      window.location.href = authorization_url;
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to initiate OIDC login');
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--background-light)'
    }}>
      <Box sx={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: 'background.paper',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        p: 4,
        mx: 2
      }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="KubeBlast"
            sx={{
              height: 72,
              width: 'auto',
              mb: 2
            }}
          />
        </Box>

        <ErrorMessage message={error} />

        <Box component="form" onSubmit={handleSubmit}>
          {isPro && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="auth-method-label">Authentication Method</InputLabel>
              <Select
                labelId="auth-method-label"
                id="auth-method"
                value={authMethod}
                label="Authentication Method"
                onChange={handleAuthMethodChange}
              >
                <MenuItem value="local">Local</MenuItem>
                <MenuItem value="ldap">LDAP</MenuItem>
              </Select>
            </FormControl>
          )}

          <TextField
            fullWidth
            label="Username"
            name="username"
            value={credentials.username}
            onChange={handleInputChange}
            required
            margin="normal"
            InputLabelProps={{
              required: false
            }}
          />
          <TextField
            fullWidth
            type="password"
            label="Password"
            name="password"
            value={credentials.password}
            onChange={handleInputChange}
            required
            margin="normal"
            InputLabelProps={{
              required: false
            }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            startIcon={<LoginIcon />}
            sx={{
              mt: 3,
              backgroundColor: 'var(--primary-color)',
              '&:hover': { backgroundColor: 'var(--primary-dark)' },
              textTransform: 'none'
            }}
          >
            Login
          </Button>

          {oidcEnabled && isPro && (
            <>
              <Divider sx={{ my: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  OR
                </Typography>
              </Divider>

              <Button
                fullWidth
                variant="outlined"
                onClick={handleOIDCLogin}
                sx={{
                  textTransform: 'none',
                  borderColor: 'var(--primary-color)',
                  color: 'var(--primary-color)',
                  '&:hover': {
                    borderColor: 'var(--primary-dark)',
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                Login with SSO
              </Button>
            </>
          )}
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};

export default Login;

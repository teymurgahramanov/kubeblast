import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, FormControl,
  InputLabel, Select, MenuItem, Divider, InputAdornment,
  IconButton, CircularProgress,
} from '@mui/material';
import {
  Login as LoginIcon,
  Person as PersonIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  SecurityRounded,
} from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';
import ErrorMessage from './ErrorMessage';
import Footer from './Footer';

/* ─── Floating pod card shown on the left brand panel ─── */
const FloatingPod = ({ name, status, sx, delay }) => (
  <Box
    sx={{
      position: 'absolute',
      background: 'rgba(255,255,255,0.07)',
      border: '1px solid rgba(255,255,255,0.13)',
      borderRadius: '12px',
      px: 1.5,
      py: 1,
      backdropFilter: 'blur(10px)',
      minWidth: 130,
      animationName: 'kbFloat',
      animationDuration: `${3.8 + delay}s`,
      animationTimingFunction: 'ease-in-out',
      animationIterationCount: 'infinite',
      animationDelay: `${delay}s`,
      ...sx,
    }}
  >
    <Typography
      sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.58rem', mb: 0.5, fontFamily: 'monospace' }}
    >
      {name}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: status === 'Running' ? '#4ade80' : '#fbbf24',
          boxShadow: status === 'Running' ? '0 0 7px #4ade80' : '0 0 7px #fbbf24',
          animationName: status === 'Running' ? 'kbPulse' : 'none',
          animationDuration: '2s',
          animationIterationCount: 'infinite',
        }}
      />
      <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.68rem', fontWeight: 500 }}>
        {status}
      </Typography>
    </Box>
  </Box>
);

/* ─── Feature pill shown on left panel ─── */
const FeaturePill = ({ label }) => (
  <Box
    sx={{
      px: 1.5, py: 0.5,
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.16)',
      borderRadius: '20px',
      backdropFilter: 'blur(6px)',
    }}
  >
    <Typography sx={{ color: 'rgba(255,255,255,0.88)', fontSize: '0.72rem', fontWeight: 500 }}>
      {label}
    </Typography>
  </Box>
);

/* ═══════════════════════════════════════════════════════ */
const Login = () => {
  const [credentials, setCredentials]   = useState({ username: '', password: '' });
  const [authMethod, setAuthMethod]     = useState('local');
  const [error, setError]               = useState('');
  const [oidcEnabled, setOidcEnabled]   = useState(false);
  const [isPro, setIsPro]               = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  /* ── Check OIDC config & license on mount ── */
  useEffect(() => {
    const checkOIDCConfig = async () => {
      try {
        const res = await axiosInstance.get('/oidc/enabled');
        setOidcEnabled(res.data.enabled);
      } catch { /* silent */ }
    };
    const checkLicense = async () => {
      try {
        const res = await axiosInstance.get('/stats/app');
        setIsPro(Boolean(res.data?.LICENSE_VALID));
      } catch { setIsPro(false); }
    };
    checkOIDCConfig();
    checkLicense();
  }, []);

  /* ── Handle OIDC callback params ── */
  useEffect(() => {
    const handleOIDCCallback = async () => {
      const params = new URLSearchParams(location.search);
      const code   = params.get('code');
      const state  = params.get('state');
      const err    = params.get('error');

      if (err) {
        setError(`OIDC authentication failed: ${params.get('error_description') || err}`);
        navigate('/login', { replace: true });
        return;
      }
      if (code && state) {
        try {
          const res = await axiosInstance.get(`/oidc/callback?code=${code}&state=${state}`);
          sessionStorage.setItem('access_token',  res.data.access_token);
          sessionStorage.setItem('refresh_token', res.data.refresh_token);
          sessionStorage.setItem('username',      res.data.username);
          sessionStorage.setItem('user_role',     res.data.role);
          navigate('/jobs');
        } catch (e) {
          setError(e.response?.data?.detail || 'OIDC authentication failed');
          navigate('/login', { replace: true });
        }
      }
    };
    handleOIDCCallback();
  }, [location, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const form = new URLSearchParams();
      form.append('username',   credentials.username);
      form.append('password',   credentials.password);
      form.append('grant_type', 'password');
      form.append('scope',      '');

      const res   = await axiosInstance.post(`/token?method=${authMethod.toLowerCase()}`, form);
      const token = res.data.access_token;

      sessionStorage.setItem('access_token',  token);
      sessionStorage.setItem('refresh_token', res.data.refresh_token);
      sessionStorage.setItem('username',      credentials.username);

      try {
        const b64     = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = decodeURIComponent(
          atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
        sessionStorage.setItem('user_role', JSON.parse(payload).role);
      } catch { /* token decode failed silently */ }

      navigate('/jobs');
    } catch (e) {
      setError(e.response?.data?.detail || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const handleOIDCLogin = async () => {
    try {
      const res = await axiosInstance.get('/oidc/authorize');
      sessionStorage.setItem('oidc_state', res.data.state);
      window.location.href = res.data.authorization_url;
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to initiate OIDC login');
    }
  };

  /* ════════════════════════════ RENDER ════════════════════════════ */
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>

      {/* ── LEFT: Brand panel (hidden on mobile) ── */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(145deg, #0c1740 0%, #0f2060 30%, #1a3080 60%, #1e40af 85%, #2553c7 100%)',
          p: 6,
        }}
      >
        {/* Ambient glow blobs */}
        <Box sx={{
          position: 'absolute', width: 560, height: 560, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(50,108,229,0.28) 0%, transparent 70%)',
          top: -160, left: -180, pointerEvents: 'none',
        }} />
        <Box sx={{
          position: 'absolute', width: 420, height: 420, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(30,64,175,0.22) 0%, transparent 70%)',
          bottom: -120, right: -120, pointerEvents: 'none',
        }} />
        <Box sx={{
          position: 'absolute', width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(50,108,229,0.15) 0%, transparent 70%)',
          top: '55%', left: '15%', pointerEvents: 'none',
        }} />

        {/* Dot grid */}
        <Box sx={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none',
        }} />

        {/* Floating JMeter pods */}
        <FloatingPod name="jmeter-master"      status="Running" delay={0}   sx={{ top: '13%',    left: '6%'  }} />
        <FloatingPod name="jmeter-slave-1"     status="Running" delay={1.3} sx={{ top: '28%',    right: '5%' }} />
        <FloatingPod name="jmeter-slave-2"     status="Running" delay={0.8} sx={{ bottom: '32%', left: '4%' }} />
        <FloatingPod name="loadtest-scenario"  status="Pending" delay={2.1} sx={{ bottom: '18%', right: '7%' }} />
        <FloatingPod name="jmeter-slave-3"     status="Running" delay={2.6} sx={{ top: '54%',    left: '10%' }} />

        {/* Main brand content */}
        <Box
          className="login-brand-animate"
          sx={{ textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: 400 }}
        >
          <Box
            component="img"
            src="/logo.svg"
            alt="KubeBlast"
            sx={{ height: 88, width: 'auto', mb: 3, filter: 'drop-shadow(0 4px 24px rgba(50,108,229,0.5))' }}
          />

          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255,255,255,0.45)', letterSpacing: '0.18em',
              fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', display: 'block', mb: 1,
            }}
          >
            Kubernetes Native
          </Typography>

          <Typography
            variant="h3"
            sx={{
              fontWeight: 800, color: '#fff', mb: 1, letterSpacing: '-0.5px',
              textShadow: '0 2px 24px rgba(0,0,0,0.35)',
            }}
          >
            KubeBlast
          </Typography>

          <Typography
            variant="body2"
            sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 500, mb: 2, fontSize: '0.82rem' }}
          >
            Load Testing Platform
          </Typography>

          <Typography
            variant="body1"
            sx={{ color: 'rgba(255,255,255,0.62)', lineHeight: 1.8, mb: 4, fontSize: '0.93rem' }}
          >
            Turn your Kubernetes cluster into a collaborative
            <br />load testing platform. Run JMeter tests at scale —
            <br />simple, efficient, and team-ready.
          </Typography>

          {/* Feature pills */}
          <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['Distributed JMeter', 'Moderation', 'CI/CD API', 'LDAP / SSO', 'JMeter Native'].map(f => (
              <FeaturePill key={f} label={f} />
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── RIGHT: Login form panel ── */}
      <Box
        sx={{
          flex: { xs: 1, md: '0 0 560px' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          px: { xs: 3, sm: 5 },
          py: 5,
          backgroundColor: 'background.default',
          minHeight: '100vh',
          position: 'relative',
        }}
      >
        <Box className="login-form-animate" sx={{ width: '100%', maxWidth: 380 }}>

          {/* Mobile-only logo */}
          <Box sx={{ display: { xs: 'block', md: 'none' }, textAlign: 'center', mb: 4 }}>
            <Box component="img" src="/logo.svg" alt="KubeBlast" sx={{ height: 60 }} />
          </Box>

          {/* Greeting */}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5, letterSpacing: '-0.3px' }}
            >
              Welcome back
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Sign in to start running load tests on your cluster
            </Typography>
          </Box>

          <ErrorMessage message={error} />

          <Box component="form" onSubmit={handleSubmit}>

            {/* Auth method selector — Pro only */}
            {isPro && (
              <FormControl fullWidth sx={{ mb: 2.5 }}>
                <InputLabel id="auth-method-label">Authentication Method</InputLabel>
                <Select
                  labelId="auth-method-label"
                  value={authMethod}
                  label="Authentication Method"
                  onChange={(e) => setAuthMethod(e.target.value)}
                >
                  <MenuItem value="local">Local</MenuItem>
                  <MenuItem value="ldap">LDAP</MenuItem>
                </Select>
              </FormControl>
            )}

            {/* Username */}
            <TextField
              fullWidth
              label="Username"
              name="username"
              value={credentials.username}
              onChange={handleInputChange}
              required
              autoComplete="username"
              sx={{ mb: 2 }}
              slotProps={{
                inputLabel: { required: false },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            {/* Password */}
            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              label="Password"
              name="password"
              value={credentials.password}
              onChange={handleInputChange}
              required
              autoComplete="current-password"
              sx={{ mb: 3 }}
              slotProps={{
                inputLabel: { required: false },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(v => !v)}
                        edge="end"
                        size="small"
                        tabIndex={-1}
                        sx={{ color: 'text.disabled' }}
                      >
                        {showPassword
                          ? <VisibilityOff fontSize="small" />
                          : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {/* Submit */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{
                py: 1.55,
                fontSize: '0.95rem',
                fontWeight: 600,
                letterSpacing: '0.01em',
                background: 'linear-gradient(135deg, #326CE5 0%, #1e40af 100%)',
                boxShadow: '0 4px 18px rgba(50,108,229,0.38)',
                borderRadius: '10px',
                textTransform: 'none',
                transition: 'all 0.22s ease',
                '&:hover': {
                  background: 'linear-gradient(135deg, #2558cc 0%, #1a37a0 100%)',
                  boxShadow: '0 6px 22px rgba(50,108,229,0.52)',
                  transform: 'translateY(-1px)',
                },
                '&:active': { transform: 'translateY(0)' },
                '&.Mui-disabled': { opacity: 0.7 },
              }}
            >
              {loading
                ? <CircularProgress size={22} sx={{ color: 'rgba(255,255,255,0.85)' }} />
                : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LoginIcon sx={{ fontSize: 20 }} />
                    Sign In
                  </Box>
                )
              }
            </Button>

            {/* OIDC / SSO */}
            {oidcEnabled && isPro && (
              <>
                <Divider sx={{ my: 3 }}>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.disabled', px: 1, fontSize: '0.72rem', letterSpacing: '0.08em' }}
                  >
                    OR CONTINUE WITH
                  </Typography>
                </Divider>

                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleOIDCLogin}
                  sx={{
                    py: 1.45,
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    borderRadius: '10px',
                    textTransform: 'none',
                    borderColor: 'divider',
                    color: 'text.primary',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#326CE5',
                      backgroundColor: 'rgba(50,108,229,0.05)',
                      transform: 'translateY(-1px)',
                    },
                  }}
                >
                  <SecurityRounded sx={{ mr: 1, fontSize: 20, color: '#326CE5' }} />
                  Continue with SSO
                </Button>
              </>
            )}
          </Box>
        </Box>

        <Footer />
      </Box>
    </Box>
  );
};

export default Login;

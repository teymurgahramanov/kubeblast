import { useState, useEffect, useRef } from 'react';
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

const LoginBackground = ({ children }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let w, h;
    const dpr = window.devicePixelRatio || 1;
    const NODE_COUNT = 45;
    const CONNECT_DIST = 170;
    let nodes = [];
    let packets = [];

    const resize = () => {
      const parent = canvas.parentElement;
      w = parent.offsetWidth;
      h = parent.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const initNodes = () => {
      nodes = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        const isHub = i < 5;
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * (isHub ? 0.15 : 0.35),
          vy: (Math.random() - 0.5) * (isHub ? 0.15 : 0.35),
          r: isHub ? 2.5 + Math.random() * 1.5 : 1 + Math.random() * 1.5,
          alpha: isHub ? 0.6 + Math.random() * 0.3 : 0.18 + Math.random() * 0.32,
          phase: Math.random() * Math.PI * 2,
          isHub,
        });
      }
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      const t = performance.now() * 0.001;

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -30) n.x = w + 30;
        if (n.x > w + 30) n.x = -30;
        if (n.y < -30) n.y = h + 30;
        if (n.y > h + 30) n.y = -30;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const strength = 1 - dist / CONNECT_DIST;
            const lineAlpha = strength * 0.16;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(66,165,245,${lineAlpha})`;
            ctx.lineWidth = strength * 0.8;
            ctx.stroke();

            if (Math.random() < 0.0015 * strength) {
              const forward = Math.random() > 0.5;
              packets.push({
                fi: forward ? i : j,
                ti: forward ? j : i,
                p: 0,
                speed: 0.006 + Math.random() * 0.014,
                size: 1 + Math.random() * 1.5,
              });
            }
          }
        }
      }

      const alive = [];
      for (const pk of packets) {
        pk.p += pk.speed;
        if (pk.p >= 1) continue;
        alive.push(pk);
        const a = nodes[pk.fi];
        const b = nodes[pk.ti];
        const px = a.x + (b.x - a.x) * pk.p;
        const py = a.y + (b.y - a.y) * pk.p;
        const fade = Math.sin(pk.p * Math.PI);

        const grd = ctx.createRadialGradient(px, py, 0, px, py, 8);
        grd.addColorStop(0, `rgba(0,229,255,${fade * 0.55})`);
        grd.addColorStop(1, 'rgba(0,229,255,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(px - 8, py - 8, 16, 16);

        ctx.beginPath();
        ctx.arc(px, py, pk.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${fade * 0.87})`;
        ctx.fill();
      }
      packets = alive;

      for (const n of nodes) {
        const pulse = Math.sin(t * 1.2 + n.phase) * 0.2 + 0.8;
        const a = n.alpha * pulse;

        if (n.isHub) {
          const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 6);
          grd.addColorStop(0, `rgba(171,71,188,${a * 0.35})`);
          grd.addColorStop(1, 'rgba(171,71,188,0)');
          ctx.fillStyle = grd;
          ctx.fillRect(n.x - n.r * 6, n.y - n.r * 6, n.r * 12, n.r * 12);
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.isHub
          ? `rgba(206,147,216,${a})`
          : `rgba(66,165,245,${a * 0.85})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(tick);
    };

    resize();
    initNodes();
    tick();
    const onResize = () => { resize(); initNodes(); packets = []; };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); };
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: `
          radial-gradient(circle 720px at 50% 16%, rgba(66, 165, 245, 0.32), transparent 68%),
          radial-gradient(circle 560px at 12% 68%, rgba(171, 71, 188, 0.24), transparent 70%),
          radial-gradient(circle 420px at 88% 72%, rgba(0, 188, 212, 0.16), transparent 72%),
          linear-gradient(180deg, #1E1E1E 0%, #141414 50%, #0D0D0D 100%)
        `,
      }}
    >
      <Box
        component="canvas"
        ref={canvasRef}
        sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />

      {children}
    </Box>
  );
};

const Login = () => {
  const [credentials, setCredentials]   = useState({ username: '', password: '' });
  const [authMethod, setAuthMethod]     = useState('local');
  const [authenticationMethods, setAuthenticationMethods] = useState(['local']);
  const [error, setError]               = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [appVersion, setAppVersion]     = useState('');
  const [edition, setEdition]           = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchAppStats = async () => {
      try {
        const res = await axiosInstance.get('/stats/app');
        const enabledMethods = Array.isArray(res.data?.AUTHENTICATION_METHODS)
          ? res.data.AUTHENTICATION_METHODS
          : ['local'];
        setAuthenticationMethods(enabledMethods);
        if (res.data?.APP_VERSION) setAppVersion(res.data.APP_VERSION);
        if (res.data?.EDITION) setEdition(res.data.EDITION);
      } catch { setAuthenticationMethods(['local']); }
    };
    fetchAppStats();
  }, []);

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
          localStorage.setItem('access_token',  res.data.access_token);
          localStorage.setItem('refresh_token', res.data.refresh_token);
          localStorage.setItem('username',      res.data.username);
          localStorage.setItem('user_role',     res.data.role);
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

      const res   = await axiosInstance.post(
        `/token?method=${authMethod.toLowerCase()}`,
        form,
        { skipAuthRefresh: true }
      );
      const token = res.data.access_token;

      localStorage.setItem('access_token',  token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
      localStorage.setItem('username',      credentials.username);

      try {
        const b64     = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = decodeURIComponent(
          atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
        localStorage.setItem('user_role', JSON.parse(payload).role);
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
      localStorage.setItem('oidc_state', res.data.state);
      window.location.href = res.data.authorization_url;
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to initiate OIDC login');
    }
  };

  const passwordAuthenticationMethods = authenticationMethods.filter(
    method => method === 'local' || method === 'ldap'
  );
  const oidcEnabled = authenticationMethods.includes('oidc');

  return (
    <LoginBackground>
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          px: { xs: 3, sm: 5 },
          py: 5,
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1,
          '& .MuiTextField-root': {
            '& .MuiOutlinedInput-root': {
              color: 'rgba(255,255,255,0.87)',
              backgroundColor: '#1E1E1E',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.23)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.40)' },
              '&.Mui-focused': { boxShadow: '0 0 0 2px rgba(66,165,245,0.30)' },
              '&.Mui-focused fieldset': { borderColor: '#90CAF9' },
            },
            '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.60)' },
            '& .MuiInputLabel-root.Mui-focused': { color: '#90CAF9' },
          },
          '& .MuiFormControl-root .MuiOutlinedInput-root': {
            color: 'rgba(255,255,255,0.87)',
            backgroundColor: '#1E1E1E',
            '& fieldset': { borderColor: 'rgba(255,255,255,0.23)' },
            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.40)' },
            '&.Mui-focused': { boxShadow: '0 0 0 2px rgba(66,165,245,0.30)' },
            '&.Mui-focused fieldset': { borderColor: '#90CAF9' },
          },
          '& .MuiFormControl-root .MuiInputLabel-root': { color: 'rgba(255,255,255,0.60)' },
          '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.60)' },
        }}
      >
        <Box className="login-form-animate" sx={{ width: '100%', maxWidth: 380 }}>
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Box component="img" src="/logo.svg" alt="KubeBlast" sx={{ height: 76, filter: 'drop-shadow(0 0 18px rgba(66,165,245,0.35))' }} />
          </Box>

          <ErrorMessage message={error} />

          <Box component="form" onSubmit={handleSubmit}>

            {/* Show a selector only when multiple password methods are configured. */}
            {passwordAuthenticationMethods.length > 1 && (
              <FormControl fullWidth sx={{ mb: 2.5 }}>
                <InputLabel id="auth-method-label">Authentication Method</InputLabel>
                <Select
                  labelId="auth-method-label"
                  value={authMethod}
                  label="Authentication Method"
                  onChange={(e) => setAuthMethod(e.target.value)}
                >
                  {passwordAuthenticationMethods.map(method => (
                    <MenuItem key={method} value={method}>
                      {method === 'ldap' ? 'LDAP' : 'Local'}
                    </MenuItem>
                  ))}
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
              autoComplete="username"
              sx={{ mb: 2 }}
              slotProps={{
                inputLabel: { required: false },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: 'rgba(255,255,255,0.60)', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

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
                      <LockIcon sx={{ color: 'rgba(255,255,255,0.60)', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(v => !v)}
                        edge="end"
                        size="small"
                        tabIndex={-1}
                        sx={{ color: 'rgba(255,255,255,0.60)' }}
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
                backgroundColor: '#90CAF9',
                color: 'rgba(0,0,0,0.87)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.45), 0 0 20px rgba(66,165,245,0.28)',
                borderRadius: '10px',
                textTransform: 'none',
                transition: 'all 0.22s ease',
                '&:hover': {
                  backgroundColor: '#42A5F5',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.45), 0 0 28px rgba(66,165,245,0.38)',
                },
                '&.Mui-disabled': { opacity: 0.7 },
              }}
            >
              {loading
                ? <CircularProgress size={22} sx={{ color: 'rgba(0,0,0,0.70)' }} />
                : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LoginIcon sx={{ fontSize: 20 }} />
                    Sign In
                  </Box>
                )
              }
            </Button>

            {oidcEnabled && (
              <>
                <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.12)' }}>
                  <Typography
                    variant="caption"
                    sx={{ color: 'rgba(255,255,255,0.60)', px: 1, fontSize: '0.72rem', letterSpacing: '0.08em' }}
                  >
                    OR
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
                    borderColor: 'rgba(255,255,255,0.23)',
                    color: 'rgba(255,255,255,0.87)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#90CAF9',
                      backgroundColor: 'rgba(66,165,245,0.14)',
                    },
                  }}
                >
                  <SecurityRounded sx={{ mr: 1, fontSize: 20, color: '#90CAF9' }} />
                  Continue with SSO
                </Button>
              </>
            )}
          </Box>
        </Box>

        {(appVersion || edition) && (
          <Typography
            aria-label="Application version and edition"
            sx={{
              position: 'fixed',
              left: '50%',
              bottom: { xs: 12, sm: 20 },
              transform: 'translateX(-50%)',
              zIndex: 2,
              color: 'rgba(255,255,255,0.74)',
              fontSize: '0.8rem',
              whiteSpace: 'nowrap',
            }}
          >
            {appVersion}{appVersion && edition ? ' ' : ''}{edition}
          </Typography>
        )}
      </Box>
    </LoginBackground>
  );
};

export default Login;

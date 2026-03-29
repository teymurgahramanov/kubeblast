import React, { useState, useEffect, useRef } from 'react';
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

/* ─── Animated network canvas for the brand panel ─── */
const BrandPanel = () => {
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
          alpha: isHub ? 0.5 + Math.random() * 0.3 : 0.12 + Math.random() * 0.28,
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
            const lineAlpha = strength * 0.09;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(110,140,255,${lineAlpha})`;
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
        grd.addColorStop(0, `rgba(100,170,255,${fade * 0.35})`);
        grd.addColorStop(1, 'rgba(100,170,255,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(px - 8, py - 8, 16, 16);

        ctx.beginPath();
        ctx.arc(px, py, pk.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${fade * 0.9})`;
        ctx.fill();
      }
      packets = alive;

      for (const n of nodes) {
        const pulse = Math.sin(t * 1.2 + n.phase) * 0.2 + 0.8;
        const a = n.alpha * pulse;

        if (n.isHub) {
          const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 6);
          grd.addColorStop(0, `rgba(50,108,229,${a * 0.25})`);
          grd.addColorStop(1, 'rgba(50,108,229,0)');
          ctx.fillStyle = grd;
          ctx.fillRect(n.x - n.r * 6, n.y - n.r * 6, n.r * 12, n.r * 12);
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.isHub
          ? `rgba(140,180,255,${a})`
          : `rgba(110,140,255,${a * 0.7})`;
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
        display: { xs: 'none', md: 'flex' },
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(160deg, #020617 0%, #060d24 30%, #0a1230 60%, #0c1636 100%)',
      }}
    >
      <Box
        component="canvas"
        ref={canvasRef}
        sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />

      {/* Brand content */}
      <Box className="login-brand-animate" sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <Box
          component="img"
          src="/logo.svg"
          alt="KubeBlast"
          sx={{ height: 120, width: 'auto', mb: 5 }}
        />
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.30)',
            fontWeight: 600,
            fontSize: '0.68rem',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            mb: 1.2,
          }}
        >
          Kubernetes Native
        </Typography>
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.65)',
            fontWeight: 300,
            fontSize: '1.35rem',
            letterSpacing: '0.12em',
          }}
        >
          Load Testing Platform
        </Typography>
      </Box>
    </Box>
  );
};

/* ═══════════════════════════════════════════════════════ */
const Login = () => {
  const [credentials, setCredentials]   = useState({ username: '', password: '' });
  const [authMethod, setAuthMethod]     = useState('local');
  const [error, setError]               = useState('');
  const [oidcEnabled, setOidcEnabled]   = useState(false);
  const [isPro, setIsPro]               = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [appVersion, setAppVersion]     = useState('');
  const [edition, setEdition]           = useState('');

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
    const fetchAppStats = async () => {
      try {
        const res = await axiosInstance.get('/stats/app');
        setIsPro(Boolean(res.data?.LICENSE_VALID));
        if (res.data?.APP_VERSION) setAppVersion(res.data.APP_VERSION);
        if (res.data?.EDITION) setEdition(res.data.EDITION);
      } catch { setIsPro(false); }
    };
    checkOIDCConfig();
    fetchAppStats();
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

      const res   = await axiosInstance.post(`/token?method=${authMethod.toLowerCase()}`, form);
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

  /* ════════════════════════════ RENDER ════════════════════════════ */
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>

      {/* ── LEFT: Brand panel (hidden on mobile) ── */}
      <BrandPanel />

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
          backgroundColor: '#0f172a',
          minHeight: '100vh',
          position: 'relative',
          '& .MuiTextField-root': {
            '& .MuiOutlinedInput-root': {
              color: '#e2e8f0',
              '& fieldset': { borderColor: 'rgba(148,163,184,0.25)' },
              '&:hover fieldset': { borderColor: 'rgba(148,163,184,0.45)' },
              '&.Mui-focused fieldset': { borderColor: '#326CE5' },
            },
            '& .MuiInputLabel-root': { color: 'rgba(148,163,184,0.7)' },
            '& .MuiInputLabel-root.Mui-focused': { color: '#326CE5' },
          },
          '& .MuiFormControl-root .MuiOutlinedInput-root': {
            color: '#e2e8f0',
            '& fieldset': { borderColor: 'rgba(148,163,184,0.25)' },
            '&:hover fieldset': { borderColor: 'rgba(148,163,184,0.45)' },
            '&.Mui-focused fieldset': { borderColor: '#326CE5' },
          },
          '& .MuiFormControl-root .MuiInputLabel-root': { color: 'rgba(148,163,184,0.7)' },
          '& .MuiSelect-icon': { color: 'rgba(148,163,184,0.7)' },
        }}
      >
        <Box className="login-form-animate" sx={{ width: '100%', maxWidth: 380 }}>

          {/* Mobile-only logo */}
          <Box sx={{ display: { xs: 'block', md: 'none' }, textAlign: 'center', mb: 4 }}>
            <Box component="img" src="/logo.svg" alt="KubeBlast" sx={{ height: 76 }} />
          </Box>

          {/* Greeting */}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, color: '#f1f5f9', mb: 0.5, letterSpacing: '-0.3px' }}
            >
              Welcome!
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
                      <PersonIcon sx={{ color: 'rgba(148,163,184,0.5)', fontSize: 20 }} />
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
                      <LockIcon sx={{ color: 'rgba(148,163,184,0.5)', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(v => !v)}
                        edge="end"
                        size="small"
                        tabIndex={-1}
                        sx={{ color: 'rgba(148,163,184,0.5)' }}
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
                boxShadow: 'none',
                borderRadius: '10px',
                textTransform: 'none',
                transition: 'all 0.22s ease',
                '&:hover': {
                  background: 'linear-gradient(135deg, #2558cc 0%, #1a37a0 100%)',
                },
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
                <Divider sx={{ my: 3, borderColor: 'rgba(148,163,184,0.15)' }}>
                  <Typography
                    variant="caption"
                    sx={{ color: 'rgba(148,163,184,0.5)', px: 1, fontSize: '0.72rem', letterSpacing: '0.08em' }}
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
                    borderColor: 'rgba(148,163,184,0.25)',
                    color: '#e2e8f0',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#326CE5',
                      backgroundColor: 'rgba(50,108,229,0.05)',
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

        {/* Version & Edition */}
        {(appVersion || edition) && (
          <Typography sx={{
            position: 'absolute', bottom: 20,
            color: 'rgba(148,163,184,0.5)', fontSize: '0.8rem',
          }}>
            {appVersion}{appVersion && edition ? ' · ' : ''}{edition}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default Login;

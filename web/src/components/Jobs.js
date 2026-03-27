import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, IconButton, Menu, MenuItem, Modal, Button, Tooltip,
  TextField, Select, FormControl, Pagination,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  LinearProgress, Skeleton, Divider, InputAdornment,
} from '@mui/material';
import {
  Delete, MoreVert, CheckCircle, Cancel, Visibility, Description,
  Autorenew, Download, Add, PlayArrow, ListAlt, Stop, Dashboard,
  Search, ViewModule, ViewList, Memory, DeveloperBoard, Dns,
  ContentCopy, Close, Speed, AccessTime, FiberManualRecord, Person,
} from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";
import { getUserRole } from "../utils/auth";
import AppHeader from './AppHeader';
import AddJob from "./AddJob";
import ErrorMessage from './ErrorMessage';
import config from '../config.json';

/* ─── Status chip definitions ────────────────────────────────── */
const STATUS_CHIPS = [
  { value: 'all',       label: 'All',       color: '#4f46e5', activeColor: '#4f46e5', inactiveBg: '#ede9fe' },
  { value: 'pending',   label: 'Pending',   color: '#374151', activeColor: '#4b5563', inactiveBg: '#f3f4f6' },
  // { value: 'ready',     label: 'Ready',     color: '#92400e', activeColor: '#b45309', inactiveBg: '#fde68a' },
  { value: 'running',   label: 'Running',   color: '#1e40af', activeColor: '#2563eb', inactiveBg: '#dbeafe' },
  { value: 'completed', label: 'Completed', color: '#065f46', activeColor: '#059669', inactiveBg: '#d1fae5' },
  { value: 'failed',    label: 'Failed',    color: '#7f1d1d', activeColor: '#dc2626', inactiveBg: '#fee2e2' },
  // { value: 'declined',  label: 'Declined',  color: '#7f1d1d', activeColor: '#dc2626', inactiveBg: '#fee2e2' },
];

/* ─── Capacity card ───────────────────────────────────────────── */
const CapacityCard = ({ icon, iconBg, label, value, sub, progress, progressColor }) => (
  <Box sx={{
    p: 2,
    border: '1px solid var(--border-color)',
    borderRadius: '14px',
    backgroundColor: 'background.paper',
    transition: 'transform 0.22s ease, box-shadow 0.22s ease',
    '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 14px 32px rgba(0,0,0,0.10)' },
    cursor: 'default',
    overflow: 'hidden',
    position: 'relative',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 110,
  }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: (sub || progress !== undefined) ? 1.5 : 0 }}>
      <Box sx={{ width: 44, height: 44, borderRadius: '12px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.62rem', display: 'block', mb: 0.3 }}>
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 700, lineHeight: 1.2, color: 'text.primary', fontSize: '1.05rem', fontVariantNumeric: 'tabular-nums', wordBreak: 'break-all' }}>
          {value}
        </Typography>
      </Box>
    </Box>
    {sub && (
      <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', mb: progress !== undefined ? 0.8 : 0 }}>
        {sub}
      </Typography>
    )}
    {progress !== undefined && (
      <LinearProgress
        variant="determinate"
        value={Math.min(100, Math.max(0, progress))}
        sx={{
          height: 6, borderRadius: '3px',
          bgcolor: 'var(--border-color)',
          '& .MuiLinearProgress-bar': { borderRadius: '3px', bgcolor: progressColor || 'var(--primary-color)' },
        }}
      />
    )}
  </Box>
);

/* ─── Terminal modal shell ────────────────────────────────────── */
const TerminalModal = ({ open, onClose, title, dotColor, content }) => (
  <Modal open={open} onClose={onClose}>
    <Box sx={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '88%', maxWidth: 920, maxHeight: '85vh',
      bgcolor: '#0d1117', borderRadius: '16px',
      boxShadow: '0 30px 70px rgba(0,0,0,0.55)',
      outline: 'none', display: 'flex', flexDirection: 'column',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1.8, borderBottom: '1px solid #30363d', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: dotColor, boxShadow: `0 0 8px ${dotColor}` }} />
          <Typography sx={{ color: '#e6edf3', fontWeight: 600, fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: '0.88rem' }}>
            {title}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Copy to clipboard">
            <IconButton size="small" onClick={() => navigator.clipboard.writeText(content || '')} sx={{ color: '#8b949e', '&:hover': { color: '#e6edf3', bgcolor: 'rgba(255,255,255,0.06)' } }}>
              <ContentCopy sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={onClose} sx={{ color: '#8b949e', '&:hover': { color: '#e6edf3', bgcolor: 'rgba(255,255,255,0.06)' } }}>
            <Close sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>
      <Box sx={{
        flex: 1, overflow: 'auto', p: 3,
        fontFamily: '"JetBrains Mono","Fira Code",monospace',
        fontSize: '0.81rem', lineHeight: 1.75,
        color: dotColor, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
      }}>
        {content || <Typography sx={{ color: '#8b949e', fontFamily: 'inherit', fontSize: '0.81rem' }}>Waiting for data…</Typography>}
      </Box>
    </Box>
  </Modal>
);

/* ══════════════════════════════════════════════════════════════ */
const Jobs = () => {
  const navigate = useNavigate();

  /* ── State ─────────────────────────────────────────────────── */
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [logs, setLogs] = useState(null);
  const [events, setEvents] = useState(null);
  const [openAddJob, setOpenAddJob] = useState(false);
  const [resources, setResources] = useState(null);
  const [resourcesError, setResourcesError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_desc');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [goToPage, setGoToPage] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const logsAbortRef   = useRef(null);
  const eventsAbortRef = useRef(null);
  const userRole = getUserRole();
  const [isPro, setIsPro] = useState(false);
  const [timezone, setTimezone] = useState('UTC');
  const proRedirectUrl = config.proRedirectUrl;

  /* ── App stats ─────────────────────────────────────────────── */
  useEffect(() => {
    const fetchAppStats = async () => {
      try {
        const res = await axiosInstance.get('/stats/app');
        setIsPro(Boolean(res.data?.LICENSE_VALID));
        if (res.data?.TIMEZONE) setTimezone(res.data.TIMEZONE);
      } catch {
        setIsPro(false);
      }
    };
    fetchAppStats();
  }, []);

  const handleProFeature = () => { window.location.href = proRedirectUrl; };

  /* ── Report viewer ─────────────────────────────────────────── */
  const openReport = async (job_id) => {
    try {
      if (!job_id) { setError("No job available."); return; }
      const response = await axiosInstance.get(`/files/${job_id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}`, 'Accept': 'text/html' },
        params: { type: "report" },
        responseType: 'text',
      });
      const rawHtml = typeof response.data === 'string' ? response.data : String(response.data || '');

      const inlineAssets = async (html, currentDir = '') => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const toArray = (list) => Array.prototype.slice.call(list || []);
        const normalizePath = (baseDir, relPath) => {
          const dummy = 'http://x/';
          const base = new URL(baseDir ? (dummy + baseDir) : dummy);
          const resolved = new URL(relPath, base);
          return resolved.pathname.replace(/^\//, '');
        };
        const fetchText = async (relPath) => {
          const path = normalizePath(currentDir, relPath);
          const res = await axiosInstance.get(`/files/${job_id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
            params: { type: "report", path }, responseType: 'text',
          });
          return typeof res.data === 'string' ? res.data : String(res.data || '');
        };
        const fetchBinary = async (relPath) => {
          const path = normalizePath(currentDir, relPath);
          const res = await axiosInstance.get(`/files/${job_id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
            params: { type: "report", path }, responseType: 'arraybuffer',
          });
          return res.data;
        };
        const guessMime = (p) => {
          const lower = String(p || '').toLowerCase();
          if (lower.endsWith('.png')) return 'image/png';
          if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
          if (lower.endsWith('.gif')) return 'image/gif';
          if (lower.endsWith('.svg')) return 'image/svg+xml';
          if (lower.endsWith('.webp')) return 'image/webp';
          if (lower.endsWith('.ico')) return 'image/x-icon';
          if (lower.endsWith('.css')) return 'text/css';
          if (lower.endsWith('.js')) return 'text/javascript';
          return 'application/octet-stream';
        };
        const toDataUrl = (arrayBuffer, mime) => {
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          return `data:${mime};base64,${btoa(binary)}`;
        };
        const linkEls = toArray(doc.querySelectorAll('link[rel="stylesheet"][href]'));
        await Promise.all(linkEls.map(async (link) => {
          const href = link.getAttribute('href');
          try {
            const cssText = await fetchText(href);
            const styleEl = doc.createElement('style');
            styleEl.textContent = cssText;
            link.parentNode.replaceChild(styleEl, link);
          } catch { /* keep as-is */ }
        }));
        const scriptEls = toArray(doc.querySelectorAll('script[src]'));
        await Promise.all(scriptEls.map(async (script) => {
          const src = script.getAttribute('src');
          try {
            const jsText = await fetchText(src);
            const inlineScript = doc.createElement('script');
            inlineScript.textContent = jsText;
            const typeAttr = script.getAttribute('type');
            if (typeAttr) inlineScript.setAttribute('type', typeAttr);
            script.parentNode.replaceChild(inlineScript, script);
          } catch { /* keep as-is */ }
        }));
        const imgEls = toArray(doc.querySelectorAll('img[src]'));
        await Promise.all(imgEls.map(async (img) => {
          const src = img.getAttribute('src');
          try {
            const data = await fetchBinary(src);
            img.setAttribute('src', toDataUrl(data, guessMime(src)));
          } catch { /* keep as-is */ }
        }));
        const iconLinks = toArray(doc.querySelectorAll('link[rel="icon"][href],link[rel="shortcut icon"][href]'));
        await Promise.all(iconLinks.map(async (link) => {
          const href = link.getAttribute('href');
          try {
            const data = await fetchBinary(href);
            link.setAttribute('href', toDataUrl(data, guessMime(href)));
          } catch { /* keep as-is */ }
        }));
        return '<!doctype html>\n' + doc.documentElement.outerHTML;
      };

      const getDir = (p) => { if (!p) return ''; const idx = p.lastIndexOf('/'); return idx === -1 ? '' : p.slice(0, idx + 1); };

      const navigateTo = async (win, path) => {
        const res = await axiosInstance.get(`/files/${job_id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}`, 'Accept': 'text/html' },
          params: { type: "report", path }, responseType: 'text',
        });
        const html = typeof res.data === 'string' ? res.data : String(res.data || '');
        const inlined = await inlineAssets(html, getDir(path));
        win.document.open(); win.document.write(inlined); win.document.close();
        bindLinkHandlers(win, getDir(path));
      };

      const bindLinkHandlers = (win, currentDir) => {
        win.document.addEventListener('click', async (e) => {
          const anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
          if (!anchor) return;
          const href = anchor.getAttribute('href') || '';
          const lower = href.toLowerCase();
          if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mailto:') || lower.startsWith('javascript:') || lower.startsWith('#')) return;
          e.preventDefault();
          const dummy = 'http://x/';
          const base = new URL(currentDir ? (dummy + currentDir) : dummy);
          const resolved = new URL(href, base);
          const relPath = resolved.pathname.replace(/^\//, '');
          try { await navigateTo(win, relPath); }
          catch (err) { setError((err && (err.response?.data?.detail || err.message)) || 'Failed to load report page'); }
        }, { capture: true });
      };

      const inlinedHtml = await inlineAssets(rawHtml, '');
      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        reportWindow.document.open(); reportWindow.document.write(inlinedHtml); reportWindow.document.close();
        bindLinkHandlers(reportWindow, '');
      } else {
        setError('Popup blocked. Please allow popups for this site.');
      }
      handleMenuClose();
    } catch (error) {
      const errorDetail = error.response?.data instanceof Blob ? await error.response.data.text() : error.response?.data?.detail || error.message;
      setError(errorDetail);
    }
  };

  /* ── Fetch jobs ────────────────────────────────────────────── */
  const fetchJobs = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) { setError('Unauthorized: Please log in'); return; }
    try {
      const params = { page, page_size: pageSize, sort_by: sortBy === 'created_asc' ? 'created_asc' : 'created_desc' };
      if (statusFilter !== 'all') params.status = statusFilter;
      const response = await axiosInstance.get("/jobs", { headers: { Authorization: `Bearer ${token}` }, params });
      setJobs(Array.isArray(response.data) ? response.data : []);
      const totalHeader = response.headers['x-total-count'] ?? response.headers['X-Total-Count'];
      const total = Number(totalHeader ?? 0);
      setTotalJobs(Number.isNaN(total) ? 0 : total);
      setError('');
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
    }
  }, [page, pageSize, sortBy, statusFilter]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    const id = setInterval(() => { fetchJobs(); }, 5000);
    return () => clearInterval(id);
  }, [fetchJobs]);

  /* ── Cluster capacity ──────────────────────────────────────── */
  useEffect(() => {
    let intervalId = null;
    const fetchResources = async () => {
      try {
        const response = await axiosInstance.get('/stats/capacity');
        setResources(response.data); setResourcesError('');
      } catch (err) {
        setResourcesError(err?.response?.data?.detail || err?.message || 'Failed to load cluster resources');
      }
    };
    const startInterval = () => { if (intervalId) return; intervalId = setInterval(fetchResources, 30000); };
    const stopInterval = () => { if (intervalId) { clearInterval(intervalId); intervalId = null; } };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') { stopInterval(); }
      else { fetchResources(); startInterval(); }
    };
    fetchResources(); startInterval();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { document.removeEventListener('visibilitychange', handleVisibility); stopInterval(); };
  }, []);

  /* ── Action handlers ───────────────────────────────────────── */
  const handleMenuOpen = (event, job_id) => { setAnchorEl(event.currentTarget); setSelectedJobId(job_id); };
  const handleMenuClose = () => { setAnchorEl(null); setSelectedJobId(null); };
  const handleAddJob = () => setOpenAddJob(true);
  const handleAddJobSuccess = () => { fetchJobs(); setOpenAddJob(false); };
  const handleModalClose = () => setOpenAddJob(false);

  const approveJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/approve/${job_id}?approved=true`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      setJobs(jobs.map(j => j.id === job_id ? { ...j, status: 'ready' } : j));
      handleMenuClose();
    } catch (error) { setError(error.response?.data?.detail || error.message); }
  };

  const declineJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/approve/${job_id}?approved=false`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      setJobs(jobs.map(j => j.id === job_id ? { ...j, status: 'declined' } : j));
      handleMenuClose();
    } catch (error) { setError(error.response?.data?.detail || error.message); }
  };

  const stopLogsStream = () => {
    try { if (logsAbortRef.current) logsAbortRef.current.abort(); } catch {}
    logsAbortRef.current = null;
  };

  const stopEventsStream = () => {
    try { if (eventsAbortRef.current) eventsAbortRef.current.abort(); } catch {}
    eventsAbortRef.current = null;
  };

  // Stop streams on unmount
  useEffect(() => () => { stopLogsStream(); stopEventsStream(); }, []); // eslint-disable-line

  const viewLogs = async (job_id, job_status) => {
    if (job_status !== 'running' && job_status !== 'completed' && job_status !== 'failed') {
      setError('Logs are only available for running, completed, or failed jobs.'); return;
    }
    try {
      const token = localStorage.getItem('access_token');
      if (!token) { setError('Unauthorized: Please log in'); return; }
      stopLogsStream();
      const controller = new AbortController();
      logsAbortRef.current = controller;
      const response = await fetch(`${axiosInstance.defaults.baseURL}/logs/${job_id}`, {
        headers: { Authorization: `Bearer ${token}`, 'Accept': 'text/event-stream', 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      });
      if (!response.ok) { const d = await response.json(); throw new Error(d.detail || `HTTP ${response.status}`); }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let logContent = '';
      const readStream = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            for (const line of decoder.decode(value).split('\n')) {
              if (line.startsWith('data: ')) logContent += line.slice(6) + '\n';
            }
            setLogs(logContent);
          }
        } catch (err) { if (err?.name !== 'AbortError' && !logContent) setError(err.message || 'Error reading logs.'); }
        finally { reader.releaseLock(); }
      };
      readStream(); handleMenuClose();
    } catch (error) { setError(error.message || 'Error fetching logs'); }
  };

  const viewEvents = async (job_id) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) { setError('Unauthorized: Please log in'); return; }
      stopEventsStream();
      const controller = new AbortController();
      eventsAbortRef.current = controller;
      const response = await fetch(`${axiosInstance.defaults.baseURL}/events/${job_id}`, {
        headers: { Authorization: `Bearer ${token}`, 'Accept': 'text/event-stream', 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      });
      if (!response.ok) { const d = await response.json(); throw new Error(d.detail || `HTTP ${response.status}`); }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let eventsContent = '';
      const readStream = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            for (const line of decoder.decode(value).split('\n')) {
              if (!line || line.startsWith(':')) continue;
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                try {
                  const obj = JSON.parse(data);
                  const ts = obj.ts ? formatDate(String(obj.ts)) : '';
                  eventsContent += `${ts ? `[${ts}] ` : ''}${obj.msg ? String(obj.msg) : String(data)}\n`;
                } catch { eventsContent += data + '\n'; }
              } else if (line.startsWith('event: ')) {
                eventsContent += `\n[${line.slice(7)}]\n`;
              }
            }
            setEvents(eventsContent);
          }
        } catch (err) { if (err?.name !== 'AbortError' && !eventsContent) setError(err.message || 'Error reading events.'); }
        finally { reader.releaseLock(); }
      };
      readStream(); handleMenuClose();
    } catch (error) { setError(error.message || 'Error fetching events'); }
  };

  const openPlanFile = async (job_id) => {
    try {
      if (!job_id) { setError("No job available."); return; }
      const response = await axiosInstance.get(`/files/${job_id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}`, 'Accept': 'application/xml' },
        params: { type: "plan" }, responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/xml' });
      window.open(window.URL.createObjectURL(blob), "_blank");
    } catch (error) {
      const d = error.response?.data instanceof Blob ? await error.response.data.text() : error.response?.data?.detail || error.message;
      setError(d);
    }
  };

  const downloadResult = async (job_id) => {
    try {
      if (!job_id) { setError("No job available."); return; }
      const response = await axiosInstance.get(`/files/${job_id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        params: { type: "result" }, responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/plain' });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `kubeblast_${jobs.find(j => j.id === job_id)?.name}.jtl`;
      link.click(); handleMenuClose();
    } catch (error) {
      const d = error.response?.data instanceof Blob ? await error.response.data.text() : error.response?.data?.detail || error.message;
      setError(d);
    }
  };

  const deleteJob = async (job_id) => {
    try {
      await axiosInstance.delete(`/jobs/${job_id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      setJobs(jobs.filter(j => j.id !== job_id)); handleMenuClose();
    } catch (error) { setError(error.response?.data?.detail || error.message); }
  };

  const rescheduleJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/retry/${job_id}`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      setJobs(jobs.map(j => j.id === job_id ? { ...j, status: 'retrying' } : j)); handleMenuClose();
    } catch (error) { setError(error.response?.data?.detail || error.message); }
  };

  const startJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/start/${job_id}`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      setJobs(jobs.map(j => j.id === job_id ? { ...j, status: 'running' } : j)); handleMenuClose();
    } catch (error) { setError(error.response?.data?.detail || error.message); }
  };

  const stopJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/stop/${job_id}`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      setJobs(jobs.map(j => j.id === job_id ? { ...j, status: 'stopping' } : j)); handleMenuClose();
    } catch (error) { setError(error.response?.data?.detail || error.message); }
  };

  /* ── Helpers ───────────────────────────────────────────────── */
  const getStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'pending': case 'starting': case 'stopping': case 'retrying':
        return { bg: '#E5E7EB', text: '#111827', border: '#9CA3AF' };
      case 'completed': return { bg: '#BBF7D0', text: '#047857', border: '#86EFAC' };
      case 'running':   return { bg: '#BFDBFE', text: '#1E40AF', border: '#93C5FD' };
      case 'ready':     return { bg: '#FDE68A', text: '#92400E', border: '#F59E0B' };
      case 'failed': case 'declined':
        return { bg: '#FCA5A5', text: '#7F1D1D', border: '#EF4444' };
      default:          return { bg: '#E5E7EB', text: '#111827', border: '#9CA3AF' };
    }
  };

  const formatDate = useCallback((dateString) => {
    if (!dateString) return '';
    const hasTimezone = /Z$/i.test(dateString) || /[+-]\d\d:?\d\d$/.test(dateString);
    const normalized = hasTimezone ? dateString : `${dateString}Z`;
    try {
      const date = new Date(normalized);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZone: timezone || 'UTC',
      });
    } catch { return dateString; }
  }, [timezone]);

  const formatCores = (millicores) => {
    if (!millicores && millicores !== 0) return '';
    return (millicores / 1000).toFixed(1);
  };

  const formatGiB = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    const gib = bytes / (1024 ** 3);
    return gib >= 10 ? gib.toFixed(0) : gib.toFixed(1);
  };

  /* ── Derived data ──────────────────────────────────────────── */
  const rows = useMemo(() => jobs.map((job) => ({
    id: job.id, job_name: job.name, owner: job.owner,
    description: job.description || '', status: job.status, created_at: job.created_at,
  })), [jobs]);

  const visibleRows = useMemo(() => {
    const text = (searchText || '').toLowerCase().trim();
    if (!text) return rows;
    return rows.filter((row) =>
      [row.job_name || '', row.owner || '', String(row.id || '')].some((v) => String(v).toLowerCase().includes(text))
    );
  }, [rows, searchText]);

  /* ── Selected job (for single context menu) ────────────────── */
  const selectedJob = jobs.find(j => j.id === selectedJobId) || null;

  /* ── Empty state ───────────────────────────────────────────── */
  const EmptyState = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 12, gap: 2 }}>
      <Box sx={{
        width: 90, height: 90, borderRadius: '22px',
        background: 'linear-gradient(135deg, #ede9fe 0%, #dbeafe 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ListAlt sx={{ fontSize: 44, color: '#6366f1', opacity: 0.75 }} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>No jobs yet</Typography>
      <Typography variant="body2" sx={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 380 }}>
        Create a load test job to get started. Status, logs, and results will appear here.
      </Typography>
    </Box>
  );

  /* ════════════════════════════════════════════════════════════ */
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader title="Jobs" />

      <Box className="page-container fade-in">

        {/* ── Cluster capacity dashboard ─────────────────────── */}
        <Box sx={{
          mb: 3, backgroundColor: 'background.paper', borderRadius: '16px',
          border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', p: 2.5,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
              Capacity
            </Typography>
            {resourcesError && (
              <Typography variant="caption" sx={{ color: 'var(--danger-color)', ml: 'auto' }}>
                {resourcesError}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 2, alignItems: 'stretch' }}>
            {!resources ? (
              [0, 1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} variant="rounded" height={96} sx={{ borderRadius: '14px', transform: 'none' }} />
              ))
            ) : (
              <>
                {/* 1. Platform Jobs */}
                {typeof resources.jobsTotal === 'number' && (
                  <Tooltip title="Total jobs running across the platform" arrow>
                    <span style={{ display: 'block', height: '100%' }}>
                      <CapacityCard
                        icon={<Speed sx={{ fontSize: 20, color: '#fff' }} />}
                        iconBg="linear-gradient(135deg, #6366f1, #818cf8)"
                        label="Platform Jobs"
                        value={resources.jobsTotal}
                        sub="Currently running"
                      />
                    </span>
                  </Tooltip>
                )}

                {/* 2. Your Jobs */}
                {(typeof resources.userJobsTotal === 'number' && typeof resources.perUserCurrentJobsLimit === 'number') && (
                  <Tooltip title="Your active jobs vs. allowed concurrent limit" arrow>
                    <span style={{ display: 'block', height: '100%' }}>
                      <CapacityCard
                        icon={<Person sx={{ fontSize: 20, color: '#fff' }} />}
                        iconBg="linear-gradient(135deg, #f59e0b, #fbbf24)"
                        label="Your Jobs"
                        value={`${resources.userJobsTotal} / ${resources.perUserCurrentJobsLimit === 0 ? '∞' : resources.perUserCurrentJobsLimit}`}
                        sub="Active / Limit"
                        progress={resources.perUserCurrentJobsLimit > 0 ? (resources.userJobsTotal / resources.perUserCurrentJobsLimit) * 100 : null}
                        progressColor="#f59e0b"
                      />
                    </span>
                  </Tooltip>
                )}

                {/* 3. Nodes */}
                <Tooltip title="Usable nodes (matching selector) vs total cluster nodes" arrow>
                  <span style={{ display: 'block', height: '100%' }}>
                    <CapacityCard
                      icon={<Dns sx={{ fontSize: 20, color: '#fff' }} />}
                      iconBg="linear-gradient(135deg, #10b981, #34d399)"
                      label="Nodes"
                      value={`${resources.nodesMatching ?? resources.nodesTotal ?? 0} / ${resources.nodesTotal ?? 0}`}
                      sub="Available / Total"
                    />
                  </span>
                </Tooltip>

                {/* 4a. CPU Quota */}
                {resources.jobResources && (() => {
                  const jr = resources.jobResources || {};
                  const cpuReq = jr.requests?.cpu !== undefined ? String(jr.requests.cpu) : (jr.requests?.cpu_m !== undefined ? `${formatCores(jr.requests.cpu_m)}c` : '-/');
                  const cpuLim = jr.limits?.cpu   !== undefined ? String(jr.limits.cpu)   : (jr.limits?.cpu_m   !== undefined ? `${formatCores(jr.limits.cpu_m)}c`   : '-/');
                  return (
                    <Tooltip title="Default CPU requests/limits per job" arrow>
                      <span style={{ display: 'block', height: '100%' }}>
                        <CapacityCard
                          icon={<DeveloperBoard sx={{ fontSize: 20, color: '#fff' }} />}
                          iconBg="linear-gradient(135deg, #8b5cf6, #a78bfa)"
                          label="CPU Quota"
                          value={`${cpuReq} / ${cpuLim}`}
                          sub="Min / Max"
                        />
                      </span>
                    </Tooltip>
                  );
                })()}

                {/* 4b. RAM Quota */}
                {resources.jobResources && (() => {
                  const jr = resources.jobResources || {};
                  const memReq = jr.requests?.memory !== undefined ? String(jr.requests.memory) : (jr.requests?.memory_bytes !== undefined ? `${formatGiB(jr.requests.memory_bytes)}G` : '-/');
                  const memLim = jr.limits?.memory   !== undefined ? String(jr.limits.memory)   : (jr.limits?.memory_bytes   !== undefined ? `${formatGiB(jr.limits.memory_bytes)}G`   : '-/');
                  return (
                    <Tooltip title="Default RAM requests/limits per job" arrow>
                      <span style={{ display: 'block', height: '100%' }}>
                        <CapacityCard
                          icon={<Memory sx={{ fontSize: 20, color: '#fff' }} />}
                          iconBg="linear-gradient(135deg, #ec4899, #f472b6)"
                          label="RAM Quota"
                          value={`${memReq} / ${memLim}`}
                          sub="Min / Max"
                        />
                      </span>
                    </Tooltip>
                  );
                })()}

                {/* 5. CPU */}
                {(() => {
                  const avail = formatCores(resources.remaining?.cpu_m || 0);
                  const total = formatCores(resources.capacity?.cpu_m || 0);
                  const pct = resources.capacity?.cpu_m
                    ? ((resources.capacity.cpu_m - (resources.remaining?.cpu_m || 0)) / resources.capacity.cpu_m) * 100
                    : 0;
                  const color = pct > 85 ? '#ef4444' : pct > 65 ? '#f59e0b' : '#326CE5';
                  return (
                    <Tooltip title="Available vs total CPU across selected nodes" arrow>
                      <span style={{ display: 'block', height: '100%' }}>
                        <CapacityCard
                          icon={<DeveloperBoard sx={{ fontSize: 20, color: '#fff' }} />}
                          iconBg={`linear-gradient(135deg, ${pct > 85 ? '#ef4444,#f87171' : pct > 65 ? '#f59e0b,#fbbf24' : '#326CE5,#7aa2f7'})`}
                          label="Cluster CPU"
                          value={`${avail} / ${total} cores`}
                          sub="Available / Total"
                          progress={pct}
                          progressColor={color}
                        />
                      </span>
                    </Tooltip>
                  );
                })()}

                {/* 6. Memory */}
                {(() => {
                  const avail = formatGiB(resources.remaining?.memory_bytes || 0);
                  const total = formatGiB(resources.capacity?.memory_bytes || 0);
                  const pct = resources.capacity?.memory_bytes
                    ? ((resources.capacity.memory_bytes - (resources.remaining?.memory_bytes || 0)) / resources.capacity.memory_bytes) * 100
                    : 0;
                  const color = pct > 85 ? '#ef4444' : pct > 65 ? '#f59e0b' : '#10b981';
                  return (
                    <Tooltip title="Available vs total memory across selected nodes" arrow>
                      <span style={{ display: 'block', height: '100%' }}>
                        <CapacityCard
                          icon={<Memory sx={{ fontSize: 20, color: '#fff' }} />}
                          iconBg={`linear-gradient(135deg, ${pct > 85 ? '#ef4444,#f87171' : pct > 65 ? '#f59e0b,#fbbf24' : '#10b981,#34d399'})`}
                          label="Cluster Memory"
                          value={`${avail} / ${total} GiB`}
                          sub="Available / Total"
                          progress={pct}
                          progressColor={color}
                        />
                      </span>
                    </Tooltip>
                  );
                })()}
              </>
            )}
          </Box>
        </Box>

        {/* ══ Unified Jobs Control Panel ════════════════════════ */}
        <Box sx={{
          mb: 2,
          backgroundColor: 'background.paper',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          px: 2.5, pt: 2, pb: 1.5,
        }}>

          {/* Row 1: Search · Sort · View Toggle · New Job */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>

            {/* Search */}
            <TextField
              size="small"
              placeholder="Search by name, owner…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ fontSize: 17, color: 'var(--text-secondary)' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                flex: '1 1 200px', maxWidth: 320,
                '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.875rem' },
              }}
            />

            {/* Sort */}
            <FormControl size="small" sx={{ minWidth: 155, flexShrink: 0 }}>
              <Select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                sx={{ fontSize: '0.875rem', borderRadius: '10px' }}
              >
                <MenuItem value="created_desc">Newest first</MenuItem>
                <MenuItem value="created_asc">Oldest first</MenuItem>
              </Select>
            </FormControl>

            {/* Divider */}
            {/* <Box sx={{ width: 1, height: 28, bgcolor: 'var(--border-color)', flexShrink: 0, display: { xs: 'none', sm: 'block' } }} /> */}


            {/* Spacer */}
            <Box sx={{ flex: 1 }} />

            {/* Total count */}
            {totalJobs > 0 && (
              <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {totalJobs > pageSize
                  ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalJobs)} of `
                  : ''}
                {totalJobs} job{totalJobs !== 1 ? 's' : ''}
              </Typography>
            )}

            {/* New Job */}
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddJob}
              sx={{
                background: 'linear-gradient(135deg, #326CE5 0%, #1e40af 100%)',
                boxShadow: 'none',
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                px: 2.2,
                flexShrink: 0,
                '&:hover': {
                  background: 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)',
                },
              }}
            >
              New Job
            </Button>
          </Box>

          {/* Divider between rows */}
          <Box sx={{ height: 1, bgcolor: 'var(--border-color)', mx: -0.5, mb: 1.5 }} />

          {/* Row 2: Status chips · Spacer · Page size · Go to page · Pagination */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>

            {/* Status filter chips */}
            {STATUS_CHIPS.map((chip) => {
              const active = statusFilter === chip.value;
              return (
                <Box
                  key={chip.value}
                  onClick={() => { setStatusFilter(chip.value); setPage(1); }}
                  sx={{
                    px: 1.5, py: 0.4,
                    borderRadius: '20px',
                    fontSize: '0.76rem', fontWeight: 600,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s',
                    border: '1.5px solid',
                    borderColor: active ? chip.activeColor : 'var(--border-color)',
                    bgcolor: active ? chip.activeColor : chip.inactiveBg,
                    color: active ? '#fff' : chip.color,
                    '&:hover': { borderColor: chip.activeColor, opacity: 0.88 },
                  }}
                >
                  {chip.label}
                </Box>
              );
            })}

            {/* Spacer */}
            <Box sx={{ flex: 1, minWidth: 8 }} />

            {/* View Toggle */}
            <Box sx={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
              {[
                { mode: 'grid',  Icon: ViewModule, label: 'Grid'  },
                { mode: 'table', Icon: ViewList,   label: 'Table' },
              ].map(({ mode, Icon, label }) => (
                <Tooltip title={`${label} view`} key={mode}>
                  <IconButton
                    onClick={() => setViewMode(mode)}
                    size="small"
                    sx={{
                      borderRadius: 0, px: 1.4, py: 0.75,
                      bgcolor: viewMode === mode ? 'var(--primary-color)' : 'transparent',
                      color:   viewMode === mode ? '#fff' : 'var(--text-secondary)',
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: viewMode === mode ? 'var(--primary-color)' : 'var(--background-light)' },
                    }}
                  >
                    <Icon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              ))}
            </Box>

            {/* Page size */}
            <FormControl size="small" sx={{ minWidth: 100, flexShrink: 0 }}>
              <Select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value) || 1); setPage(1); }}
                sx={{ fontSize: '0.82rem', borderRadius: '8px' }}
              >
                {[5, 10, 20, 50].map(n => <MenuItem key={n} value={n}>{n} / page</MenuItem>)}
              </Select>
            </FormControl>

            {/* Go to page */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, flexShrink: 0 }}>
              <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                Go to:
              </Typography>
              <TextField
                size="small"
                type="number"
                value={goToPage}
                onChange={(e) => setGoToPage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const num = parseInt(goToPage);
                    const maxPage = Math.max(1, Math.ceil(totalJobs / pageSize));
                    if (num >= 1 && num <= maxPage) setPage(num);
                    setGoToPage('');
                  }
                }}
                placeholder={String(page)}
                sx={{ width: 58 }}
                slotProps={{
                  htmlInput: {
                    min: 1,
                    max: Math.max(1, Math.ceil(totalJobs / pageSize)),
                    style: { textAlign: 'center', fontSize: '0.82rem', padding: '5px 6px' },
                  },
                }}
              />
              <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                / {Math.max(1, Math.ceil(totalJobs / pageSize))}
              </Typography>
            </Box>

            {/* Pagination */}
            {totalJobs > pageSize && (
              <Pagination
                count={Math.max(1, Math.ceil(totalJobs / pageSize))}
                page={page}
                onChange={(_e, v) => setPage(v)}
                color="primary"
                shape="rounded"
                size="small"
                sx={{ flexShrink: 0, '& .MuiPaginationItem-root': { fontWeight: 500 } }}
              />
            )}
          </Box>

        </Box>

        <ErrorMessage message={error} />

        {/* ── Jobs content ───────────────────────────────────── */}
        {jobs.length === 0 ? (
          <EmptyState />
        ) : viewMode === 'table' ? (

          /* ── TABLE VIEW ──────────────────────────────────── */
          <Box sx={{
            backgroundColor: 'background.paper', borderRadius: '16px',
            border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {['#', 'Job Name', 'Status', 'Created At', ''].map((h, i) => (
                      <TableCell
                        key={i}
                        align={i === 5 ? 'right' : 'left'}
                        sx={{
                          bgcolor: 'var(--background-light)',
                          fontWeight: 700, fontSize: '0.7rem',
                          textTransform: 'uppercase', letterSpacing: '0.07em',
                          color: 'var(--text-secondary)',
                          borderBottom: '2px solid var(--border-color)',
                          py: 1.5, px: 2, whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleRows.map((job, idx) => {
                    const sc = getStatusColor(job.status);
                    return (
                      <TableRow
                        key={job.id}
                        onClick={() => navigate(`/jobs/${job.id}`)}
                        sx={{
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                          '&:hover': { bgcolor: 'var(--background-light)' },
                          '&:last-child td': { border: 0 },
                        }}
                      >
                        <TableCell sx={{ color: 'var(--text-secondary)', fontSize: '0.82rem', width: 52, py: 1.5, px: 2 }}>
                          {(page - 1) * pageSize + idx + 1}
                        </TableCell>
                        <TableCell sx={{ py: 1.5, px: 2, maxWidth: 240 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{job.job_name}</Typography>
                          {job.description && (
                            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', mt: 0.2 }}>
                              {job.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ py: 1.5, px: 2 }}>
                          <Box sx={{
                            display: 'inline-flex', alignItems: 'center', gap: 0.5,
                            px: 1.4, py: 0.35,
                            bgcolor: sc.bg, color: sc.text,
                            borderRadius: '20px', fontSize: '0.74rem', fontWeight: 600, whiteSpace: 'nowrap',
                          }}>
                            <FiberManualRecord sx={{ fontSize: '0.5rem' }} />
                            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                          </Box>
                        </TableCell>
                        {/* <TableCell sx={{ color: 'var(--text-secondary)', fontSize: '0.84rem', py: 1.5, px: 2 }}>
                          {(userRole === 'admin' || userRole === 'moderator') && isPro && job.owner ? job.owner : '—'}
                        </TableCell> */}
                        <TableCell sx={{ color: 'var(--text-secondary)', fontSize: '0.82rem', py: 1.5, px: 2, whiteSpace: 'nowrap' }}>
                          {formatDate(job.created_at)}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.5, px: 2 }} onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, job.id); }}
                            sx={{ '&:hover': { color: 'var(--primary-color)' } }}
                          >
                            <MoreVert fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

        ) : (

          /* ── GRID VIEW ───────────────────────────────────── */
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))', gap: 2 }}>
            {visibleRows.map((job) => {
              const sc = getStatusColor(job.status);
              return (
                <Box
                  key={job.id}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  sx={{
                    position: 'relative', overflow: 'hidden',
                    backgroundColor: 'background.paper',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                    cursor: 'pointer',
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                    '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 28px rgba(0,0,0,0.1)' },
                  }}
                >
                  {/* Status accent bar */}
                  <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, bgcolor: sc.border }} />

                  <Box sx={{ p: 2.5, pl: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.3, wordBreak: 'break-word' }}>
                        {job.job_name}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, job.id); }}
                        sx={{ mt: -0.5, flexShrink: 0, '&:hover': { color: 'var(--primary-color)' } }}
                      >
                        <MoreVert fontSize="small" />
                      </IconButton>
                    </Box>

                    {job.description && (
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 1.5, fontSize: '0.82rem', lineHeight: 1.5 }}>
                        {job.description}
                      </Typography>
                    )}

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Box sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 0.5,
                        px: 1.4, py: 0.35,
                        bgcolor: sc.bg, color: sc.text,
                        borderRadius: '20px', fontSize: '0.74rem', fontWeight: 600,
                      }}>
                        <FiberManualRecord sx={{ fontSize: '0.5rem' }} />
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </Box>
                      {(userRole === 'admin' || userRole === 'moderator') && isPro && job.owner && (
                        <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>· {job.owner}</Typography>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 1.5 }}>
                      <AccessTime sx={{ fontSize: 13, color: 'var(--text-secondary)' }} />
                      <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                        {formatDate(job.created_at)}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        {/* ── Single context menu ────────────────────────────── */}
        {selectedJob && (
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            slotProps={{
              paper: {
                sx: {
                  minWidth: 195,
                  borderRadius: '12px',
                  boxShadow: '0 10px 36px rgba(0,0,0,0.16)',
                  border: '1px solid var(--border-color)',
                  '& .MuiMenuItem-root': {
                    px: 2, py: 0.9, gap: 1.5, fontSize: '0.875rem',
                    borderRadius: '6px', mx: 0.5,
                    transition: 'background 0.12s',
                  },
                },
              },
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            {selectedJob.status === 'pending' && (userRole === 'admin' || userRole === 'moderator') && isPro && (
              <>
                <MenuItem onClick={(e) => { e.stopPropagation(); approveJob(selectedJob.id); }}>
                  <CheckCircle sx={{ fontSize: 17, color: '#10b981' }} /> Approve
                </MenuItem>
                <MenuItem onClick={(e) => { e.stopPropagation(); declineJob(selectedJob.id); }}>
                  <Cancel sx={{ fontSize: 17, color: '#ef4444' }} /> Decline
                </MenuItem>
                <Divider sx={{ my: 0.5 }} />
              </>
            )}
            {selectedJob.status === 'ready' && (
              <MenuItem onClick={(e) => { e.stopPropagation(); startJob(selectedJob.id); }}>
                <PlayArrow sx={{ fontSize: 17, color: '#10b981' }} /> Start
              </MenuItem>
            )}
            {selectedJob.status === 'running' && (
              <MenuItem onClick={(e) => { e.stopPropagation(); stopJob(selectedJob.id); }}>
                <Stop sx={{ fontSize: 17, color: '#ef4444' }} /> Stop
              </MenuItem>
            )}
            {(selectedJob.status === 'failed' || selectedJob.status === 'completed') && (
              <MenuItem onClick={(e) => { e.stopPropagation(); rescheduleJob(selectedJob.id); }}>
                <Autorenew sx={{ fontSize: 17, color: '#f59e0b' }} /> Retry
              </MenuItem>
            )}
            <Divider sx={{ my: 0.5 }} />
            <MenuItem
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(selectedJob.id); handleMenuClose(); }}
              sx={{ color: '#ef4444 !important', '&:hover': { bgcolor: '#fee2e2 !important' } }}
            >
              <Delete sx={{ fontSize: 17, color: '#ef4444' }} /> Delete
            </MenuItem>
          </Menu>
        )}

        {/* ── Modals ─────────────────────────────────────────── */}
        <TerminalModal
          open={Boolean(logs)}
          onClose={() => { stopLogsStream(); setLogs(null); }}
          title="Job Logs"
          dotColor="#7ee787"
          content={logs}
        />

        <TerminalModal
          open={Boolean(events)}
          onClose={() => { stopEventsStream(); setEvents(null); }}
          title="K8s Events"
          dotColor="#79c0ff"
          content={events}
        />

        {/* ── Delete confirmation modal ──────────────────────── */}
        <Modal open={Boolean(confirmDeleteId)} onClose={() => setConfirmDeleteId(null)}>
          <Box sx={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%', maxWidth: 420,
            bgcolor: 'background.paper',
            borderRadius: '20px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
            outline: 'none', p: 4,
            border: '1px solid var(--border-color)',
          }}>
            {/* Icon */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2.5 }}>
              <Box sx={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '3px solid #fca5a5',
              }}>
                <Delete sx={{ fontSize: 30, color: '#ef4444' }} />
              </Box>
            </Box>
            {/* Title */}
            <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center', mb: 1, color: 'text.primary' }}>
              Delete Job?
            </Typography>
            {/* Job name */}
            {confirmDeleteId && (
              <Typography variant="body2" sx={{ textAlign: 'center', mb: 1, color: 'var(--text-secondary)' }}>
                <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {jobs.find(j => j.id === confirmDeleteId)?.name || confirmDeleteId}
                </Box>
              </Typography>
            )}
            {/* Warning text */}
            <Typography variant="body2" sx={{ textAlign: 'center', color: 'var(--text-secondary)', mb: 3.5, lineHeight: 1.6 }}>
              This action cannot be undone. The job and all associated data will be permanently removed.
            </Typography>
            {/* Buttons */}
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                fullWidth variant="outlined"
                onClick={() => setConfirmDeleteId(null)}
                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, py: 1.2 }}
              >
                Cancel
              </Button>
              <Button
                fullWidth variant="contained"
                onClick={() => { deleteJob(confirmDeleteId); setConfirmDeleteId(null); }}
                sx={{
                  borderRadius: '10px', textTransform: 'none', fontWeight: 600, py: 1.2,
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  boxShadow: 'none',
                  '&:hover': { background: 'linear-gradient(135deg, #dc2626, #b91c1c)' },
                }}
              >
                Delete
              </Button>
            </Box>
          </Box>
        </Modal>

        <Modal open={openAddJob} onClose={handleModalClose}>
          <Box sx={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%', maxWidth: 600,
            bgcolor: 'background.paper',
            boxShadow: '0 25px 60px rgba(0,0,0,0.22)',
            p: 4, borderRadius: '16px', outline: 'none',
          }}>
            <AddJob onClose={handleAddJobSuccess} />
          </Box>
        </Modal>

      </Box>
    </Box>
  );
};

export default Jobs;

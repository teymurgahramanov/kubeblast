import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Skeleton,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack,
  CheckCircle,
  Cancel,
  Visibility,
  Description,
  Autorenew,
  Download,
  PlayArrow,
  ListAlt,
  Stop,
  Dashboard,
  Delete,
} from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';
import { getUserRole } from '../utils/auth';
import Menuselect from './Menuselect';
import ErrorMessage from './ErrorMessage';

const JobDetail = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const userRole = getUserRole();

  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0 logs | 1 events | 2 plan
  const [logs, setLogs] = useState('');
  const [events, setEvents] = useState('');
  const [planText, setPlanText] = useState('');
  const [logsStreaming, setLogsStreaming] = useState(false);
  const [eventsStreaming, setEventsStreaming] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [timezone, setTimezone] = useState('UTC');
  const logsAbortRef = useRef(null);
  const eventsAbortRef = useRef(null);

  useEffect(() => {
    const fetchAppStats = async () => {
      try {
        const res = await axiosInstance.get('/stats/app');
        setIsPro(Boolean(res.data?.LICENSE_VALID));
        if (res.data?.TIMEZONE) {
          setTimezone(res.data.TIMEZONE);
        }
      } catch (err) {
        console.error('Error fetching app stats:', err);
        setIsPro(false);
      }
    };
    fetchAppStats();
  }, []);

  const fetchJob = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await axiosInstance.get(`/jobs/${jobId}`);
      setJob(res.data || null);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load job');
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Poll for updates (status changes)
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchJob();
    }, 5000);
    return () => clearInterval(intervalId);
  }, [fetchJob]);

  const getStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      // Neutral/gray
      case 'pending':
        return { bg: '#E5E7EB', text: '#111827', border: '#9CA3AF' };
      case 'starting':
        return { bg: '#E5E7EB', text: '#111827', border: '#9CA3AF' };
      case 'stopping':
        return { bg: '#E5E7EB', text: '#111827', border: '#9CA3AF' };
      case 'retrying':
        return { bg: '#E5E7EB', text: '#111827', border: '#9CA3AF' };

      // Positive
      case 'completed':
        return { bg: '#BBF7D0', text: '#047857', border: '#86EFAC' };

      // Progress
      case 'running':
        return { bg: '#BFDBFE', text: '#1E40AF', border: '#93C5FD' };

      // Attention
      case 'ready':
        return { bg: '#FDE68A', text: '#92400E', border: '#F59E0B' };

      // Negative
      case 'failed':
        return { bg: '#FCA5A5', text: '#7F1D1D', border: '#EF4444' };
      case 'declined':
        return { bg: '#FCA5A5', text: '#7F1D1D', border: '#EF4444' };

      default:
        return { bg: '#E5E7EB', text: '#111827', border: '#9CA3AF' };
    }
  };

  const formatDate = useCallback((dateString) => {
    if (!dateString) return '';
    const hasTimezone = /Z$/i.test(dateString) || /[+-]\d\d:?\d\d$/.test(dateString);
    const normalized = hasTimezone ? dateString : `${dateString}Z`;
    try {
      const date = new Date(normalized);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      const tz = timezone || 'UTC';
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: tz,
      });
    } catch {
      return dateString;
    }
  }, [timezone]);

  const approveJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/approve/${job_id}?approved=true`, {});
      setJob((prev) => (prev && prev.id === job_id ? { ...prev, status: 'ready' } : prev));
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message);
    }
  };

  const declineJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/approve/${job_id}?approved=false`, {});
      setJob((prev) => (prev && prev.id === job_id ? { ...prev, status: 'declined' } : prev));
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message);
    }
  };

  const startJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/start/${job_id}`, {});
      setJob((prev) => (prev && prev.id === job_id ? { ...prev, status: 'running' } : prev));
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message);
    }
  };

  const stopJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/stop/${job_id}`, {});
      setJob((prev) => (prev && prev.id === job_id ? { ...prev, status: 'stopping' } : prev));
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message);
    }
  };

  const rescheduleJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/retry/${job_id}`, {});
      setJob((prev) => (prev && prev.id === job_id ? { ...prev, status: 'retrying' } : prev));
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message);
    }
  };

  const deleteJob = async (job_id) => {
    try {
      await axiosInstance.delete(`/jobs/${job_id}`);
      navigate('/jobs');
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message);
    }
  };

  const stopLogsStream = () => {
    try {
      if (logsAbortRef.current) logsAbortRef.current.abort();
    } catch {}
    logsAbortRef.current = null;
    setLogsStreaming(false);
  };

  const stopEventsStream = () => {
    try {
      if (eventsAbortRef.current) eventsAbortRef.current.abort();
    } catch {}
    eventsAbortRef.current = null;
    setEventsStreaming(false);
  };

  useEffect(() => {
    // Stop streaming when leaving the page
    return () => {
      stopLogsStream();
      stopEventsStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewLogs = async (job_id, job_status) => {
    if (job_status !== 'running' && job_status !== 'completed' && job_status !== 'failed') {
      setError('Logs are only available for running, completed, or failed jobs.');
      return;
    }
    try {
      const token = sessionStorage.getItem('access_token');
      if (!token) {
        setError('Unauthorized: Please log in');
        return;
      }
      stopLogsStream();
      const controller = new AbortController();
      logsAbortRef.current = controller;
      setLogsStreaming(true);
      const response = await fetch(`${axiosInstance.defaults.baseURL}/logs/${job_id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let logContent = '';
      const readStream = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                logContent += line.slice(6) + '\n';
              }
            }
            setLogs(logContent);
          }
        } catch (err) {
          // Ignore abort errors
          if (err?.name !== 'AbortError') {
            console.error('Stream reading error:', err);
            if (!logContent) {
              setError(err?.message || 'Error reading logs. Please try again.');
            }
          }
        } finally {
          reader.releaseLock();
          setLogsStreaming(false);
        }
      };
      readStream();
    } catch (err) {
      setLogsStreaming(false);
      setError(err?.message || 'Error fetching logs');
    }
  };

  const viewEvents = async (job_id) => {
    try {
      const token = sessionStorage.getItem('access_token');
      if (!token) {
        setError('Unauthorized: Please log in');
        return;
      }
      stopEventsStream();
      const controller = new AbortController();
      eventsAbortRef.current = controller;
      setEventsStreaming(true);
      const response = await fetch(`${axiosInstance.defaults.baseURL}/events/${job_id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let eventsContent = '';
      const readStream = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const text = decoder.decode(value);
            const lines = text.split('\n');
            for (const line of lines) {
              if (!line || line.startsWith(':')) continue;
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                try {
                  const obj = JSON.parse(data);
                  const tsRaw = obj.ts ? String(obj.ts) : '';
                  const ts = tsRaw ? formatDate(tsRaw) : '';
                  const msg = obj.msg ? String(obj.msg) : String(data);
                  eventsContent += `${ts ? `[${ts}] ` : ''}${msg}\n`;
                } catch {
                  eventsContent += data + '\n';
                }
              } else if (line.startsWith('event: ')) {
                const evt = line.slice(7);
                eventsContent += `\n[${evt}]\n`;
              }
            }
            setEvents(eventsContent);
          }
        } catch (err) {
          if (err?.name !== 'AbortError') {
            console.error('Stream reading error:', err);
            if (!eventsContent) {
              setError(err?.message || 'Error reading events. Please try again.');
            }
          }
        } finally {
          reader.releaseLock();
          setEventsStreaming(false);
        }
      };
      readStream();
    } catch (err) {
      setEventsStreaming(false);
      setError(err?.message || 'Error fetching events');
    }
  };

  const fetchPlanText = async (job_id) => {
    try {
      if (!job_id) {
        setError('No job available.');
        return;
      }
      setPlanLoading(true);
      const response = await axiosInstance.get(`/files/${job_id}`, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('access_token')}`,
          Accept: 'application/xml',
        },
        params: { type: 'plan' },
        responseType: 'text',
      });
      const text = typeof response.data === 'string' ? response.data : String(response.data || '');
      setPlanText(text);
    } catch (err) {
      const errorDetail =
        err.response?.data instanceof Blob
          ? await err.response.data.text()
          : err.response?.data?.detail || err.message;
      setError(errorDetail);
    } finally {
      setPlanLoading(false);
    }
  };

  const downloadResult = async (job_id) => {
    try {
      if (!job_id) {
        setError('No job available.');
        return;
      }
      const response = await axiosInstance.get(`/files/${job_id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
        params: { type: 'result' },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/plain' });
      const fileURL = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileURL;
      link.download = `kubeblast_${job?.name || job_id}.jtl`;
      link.click();
    } catch (err) {
      const errorDetail =
        err.response?.data instanceof Blob
          ? await err.response.data.text()
          : err.response?.data?.detail || err.message;
      setError(errorDetail);
    }
  };

  const openReport = async (job_id) => {
    try {
      if (!job_id) {
        setError('No job available.');
        return;
      }
      const response = await axiosInstance.get(`/files/${job_id}`, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('access_token')}`,
          Accept: 'text/html',
        },
        params: { type: 'report' },
        responseType: 'text',
      });
      const rawHtml = typeof response.data === 'string' ? response.data : String(response.data || '');

      const inlineAssets = async (html, currentDir = '') => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const toArray = (list) => Array.prototype.slice.call(list || []);
        const normalizePath = (baseDir, relPath) => {
          const dummy = 'http://x/';
          const base = new URL(baseDir ? dummy + baseDir : dummy);
          const resolved = new URL(relPath, base);
          return resolved.pathname.replace(/^\//, '');
        };
        const fetchText = async (relPath) => {
          const path = normalizePath(currentDir, relPath);
          const res = await axiosInstance.get(`/files/${job_id}`, {
            headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
            params: { type: 'report', path },
            responseType: 'text',
          });
          return typeof res.data === 'string' ? res.data : String(res.data || '');
        };
        const fetchBinary = async (relPath) => {
          const path = normalizePath(currentDir, relPath);
          const res = await axiosInstance.get(`/files/${job_id}`, {
            headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
            params: { type: 'report', path },
            responseType: 'arraybuffer',
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
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          return `data:${mime};base64,${base64}`;
        };

        const linkEls = toArray(doc.querySelectorAll('link[rel="stylesheet"][href]'));
        await Promise.all(
          linkEls.map(async (link) => {
            const href = link.getAttribute('href');
            try {
              const cssText = await fetchText(href);
              const styleEl = doc.createElement('style');
              styleEl.textContent = cssText;
              link.parentNode.replaceChild(styleEl, link);
            } catch {}
          })
        );

        const scriptEls = toArray(doc.querySelectorAll('script[src]'));
        await Promise.all(
          scriptEls.map(async (script) => {
            const src = script.getAttribute('src');
            try {
              const jsText = await fetchText(src);
              const inlineScript = doc.createElement('script');
              inlineScript.textContent = jsText;
              const typeAttr = script.getAttribute('type');
              if (typeAttr) inlineScript.setAttribute('type', typeAttr);
              script.parentNode.replaceChild(inlineScript, script);
            } catch {}
          })
        );

        const imgEls = toArray(doc.querySelectorAll('img[src]'));
        await Promise.all(
          imgEls.map(async (img) => {
            const src = img.getAttribute('src');
            try {
              const data = await fetchBinary(src);
              const mime = guessMime(src);
              const url = toDataUrl(data, mime);
              img.setAttribute('src', url);
            } catch {}
          })
        );

        const iconLinks = toArray(
          doc.querySelectorAll('link[rel="icon"][href], link[rel="shortcut icon"][href]')
        );
        await Promise.all(
          iconLinks.map(async (link) => {
            const href = link.getAttribute('href');
            try {
              const data = await fetchBinary(href);
              const mime = guessMime(href);
              const url = toDataUrl(data, mime);
              link.setAttribute('href', url);
            } catch {}
          })
        );

        return '<!doctype html>\n' + doc.documentElement.outerHTML;
      };

      const getDir = (p) => {
        if (!p) return '';
        const idx = p.lastIndexOf('/');
        return idx === -1 ? '' : p.slice(0, idx + 1);
      };

      const navigateTo = async (win, path) => {
        const res = await axiosInstance.get(`/files/${job_id}`, {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('access_token')}`,
            Accept: 'text/html',
          },
          params: { type: 'report', path },
          responseType: 'text',
        });
        const html = typeof res.data === 'string' ? res.data : String(res.data || '');
        const inlined = await inlineAssets(html, getDir(path));
        win.document.open();
        win.document.write(inlined);
        win.document.close();
        bindLinkHandlers(win, getDir(path));
      };

      const bindLinkHandlers = (win, currentDir) => {
        win.document.addEventListener(
          'click',
          async (e) => {
            const anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
            if (!anchor) return;
            const href = anchor.getAttribute('href') || '';
            const lower = href.toLowerCase();
            if (
              lower.startsWith('http://') ||
              lower.startsWith('https://') ||
              lower.startsWith('mailto:') ||
              lower.startsWith('javascript:') ||
              lower.startsWith('#')
            ) {
              return;
            }
            e.preventDefault();
            const dummy = 'http://x/';
            const base = new URL(currentDir ? dummy + currentDir : dummy);
            const resolved = new URL(href, base);
            const relPath = resolved.pathname.replace(/^\//, '');
            try {
              await navigateTo(win, relPath);
            } catch (err) {
              const msg =
                (err && (err.response?.data?.detail || err.message)) || 'Failed to load report page';
              setError(msg);
            }
          },
          { capture: true }
        );
      };

      const inlinedHtml = await inlineAssets(rawHtml, '');
      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        reportWindow.document.open();
        reportWindow.document.write(inlinedHtml);
        reportWindow.document.close();
        bindLinkHandlers(reportWindow, '');
      } else {
        setError('Popup blocked. Please allow popups for this site.');
      }
    } catch (err) {
      const errorDetail =
        err.response?.data instanceof Blob
          ? await err.response.data.text()
          : err.response?.data?.detail || err.message;
      setError(errorDetail);
    }
  };

  const statusColors = useMemo(() => getStatusColor(job?.status), [job?.status]);
  const ownerVisible = (userRole === 'admin' || userRole === 'moderator') && isPro;
  const canModerate = (userRole === 'admin' || userRole === 'moderator') && isPro;

  const showLogsTab = Boolean(job);
  const showEventsTab = Boolean(job);
  const showPlanTab = Boolean(job);

  const handleTabChange = (_event, newValue) => {
    setActiveTab(newValue);
    if (!job) return;
    if (newValue === 0) {
      viewLogs(job.id, job.status);
    } else if (newValue === 1) {
      viewEvents(job.id);
    } else if (newValue === 2) {
      // Fetch plan on demand if not loaded yet
      if (!planText) {
        fetchPlanText(job.id);
      }
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          px: 3,
          py: 1,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
        }}
      >
        <Link to="/jobs" style={{ textDecoration: 'none', justifySelf: 'start' }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="KubeBlast"
            sx={{
              height: 36,
              width: 'auto',
              '&:hover': { opacity: 0.8 },
            }}
          />
        </Link>
        <Typography variant="h6" sx={{ fontWeight: 600, textAlign: 'center' }}>
          Job
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifySelf: 'end' }}>
          <Menuselect />
        </Box>
      </Box>

      <Box className="page-container fade-in">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Button
            variant="text"
            startIcon={<ArrowBack />}
            onClick={() => navigate('/jobs')}
            sx={{ color: 'var(--text-secondary)' }}
          >
            Back to Jobs
          </Button>
        </Box>

        <ErrorMessage message={error} />

        <Box
          sx={{
            backgroundColor: 'background.paper',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)',
            p: 2,
            mb: 2,
          }}
        >
          {!job ? (
            <Box sx={{ display: 'grid', gap: 1 }}>
              <Skeleton variant="text" width="40%" height={36} />
              <Skeleton variant="text" width="70%" />
              <Skeleton variant="rounded" height={44} />
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {job.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Box
                      sx={{
                        backgroundColor: statusColors.bg,
                        color: statusColors.text,
                        borderRadius: '6px',
                        px: 1.5,
                        py: 0.5,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        width: 'fit-content',
                        border: `1px solid ${statusColors.border}`,
                      }}
                    >
                      {String(job.status || '').charAt(0).toUpperCase() + String(job.status || '').slice(1)}
                    </Box>
                    {ownerVisible && job.owner && (
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                        • {job.owner}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>

              {job.description && (
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 1 }}>
                  {job.description}
                </Typography>
              )}

              <Typography variant="caption" sx={{ color: 'var(--text-secondary)', mt: 1, display: 'block' }}>
                Created at {formatDate(job.created_at)}
              </Typography>
            </>
          )}
        </Box>

        {/* Quick actions */}
        {job && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              mb: 2,
              alignItems: 'center',
            }}
          >
            {job.status === 'pending' && canModerate && (
              <>
                <Button variant="contained" startIcon={<CheckCircle />} onClick={() => approveJob(job.id)}>
                  Approve
                </Button>
                <Button variant="outlined" startIcon={<Cancel />} onClick={() => declineJob(job.id)}>
                  Decline
                </Button>
              </>
            )}
            {job.status === 'ready' && (
              <Button variant="contained" startIcon={<PlayArrow />} onClick={() => startJob(job.id)}>
                Start
              </Button>
            )}
            {job.status === 'running' && (
              <Button variant="outlined" startIcon={<Stop />} onClick={() => stopJob(job.id)}>
                Stop
              </Button>
            )}
            {(job.status === 'failed' || job.status === 'completed') && (
              <Button variant="outlined" startIcon={<Autorenew />} onClick={() => rescheduleJob(job.id)}>
                Retry
              </Button>
            )}
            {job.status === 'completed' && (
              <>
                <Button variant="outlined" startIcon={<Download />} onClick={() => downloadResult(job.id)}>
                  Result
                </Button>
                <Button variant="outlined" startIcon={<Dashboard />} onClick={() => openReport(job.id)}>
                  Report
                </Button>
              </>
            )}
            <Button
              variant="outlined"
              startIcon={<Delete />}
              onClick={() => deleteJob(job.id)}
              sx={{ color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
            >
              Delete
            </Button>
          </Box>
        )}

        {/* Tabs: Logs / Events / Plan */}
        {job && (
          <Box
            sx={{
              backgroundColor: 'background.paper',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)',
              overflow: 'hidden',
            }}
          >
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="fullWidth"
              sx={{ borderBottom: '1px solid var(--border-color)' }}
            >
              {showLogsTab && <Tab icon={<Visibility />} iconPosition="start" label="Logs" />}
              {showEventsTab && <Tab icon={<ListAlt />} iconPosition="start" label="Events" />}
              {showPlanTab && <Tab icon={<Description />} iconPosition="start" label="Plan" />}
            </Tabs>

            <Box sx={{ p: 2 }}>
              {activeTab === 0 && (
                <>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Autorenew />}
                      onClick={() => {
                        setLogs('');
                        viewLogs(job.id, job.status);
                      }}
                    >
                      Refresh
                    </Button>
                  </Box>
                  <Box
                    sx={{
                      whiteSpace: 'pre-wrap',
                      backgroundColor: 'var(--background-light)',
                      padding: '1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      minHeight: 240,
                      maxHeight: '60vh',
                      overflow: 'auto',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      lineHeight: 1.5,
                    }}
                  >
                    {logs || 'No logs yet.'}
                  </Box>
                </>
              )}

              {activeTab === 1 && (
                <>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Autorenew />}
                      onClick={() => {
                        setEvents('');
                        viewEvents(job.id);
                      }}
                    >
                      Refresh
                    </Button>
                  </Box>
                  <Box
                    sx={{
                      whiteSpace: 'pre-wrap',
                      backgroundColor: 'var(--background-light)',
                      padding: '1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      minHeight: 240,
                      maxHeight: '60vh',
                      overflow: 'auto',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      lineHeight: 1.5,
                    }}
                  >
                    {events || 'No events yet.'}
                  </Box>
                </>
              )}

              {activeTab === 2 && (
                <>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Description />}
                      onClick={() => fetchPlanText(job.id)}
                      disabled={planLoading}
                    >
                      {planLoading ? 'Loading…' : 'Refresh'}
                    </Button>
                  </Box>
                  <Box
                    sx={{
                      whiteSpace: 'pre-wrap',
                      backgroundColor: 'var(--background-light)',
                      padding: '1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      minHeight: 240,
                      maxHeight: '60vh',
                      overflow: 'auto',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      lineHeight: 1.5,
                    }}
                  >
                    {planText || (planLoading ? 'Loading plan…' : 'No plan loaded yet.')}
                  </Box>
                </>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default JobDetail;



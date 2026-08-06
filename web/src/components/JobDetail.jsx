import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, Button, Skeleton, Modal, CircularProgress,
} from '@mui/material';
import {
  ArrowBack, CheckCircle, Cancel, Visibility, Description,
  Autorenew, Download, PlayArrow, ListAlt, Stop,
  Delete, AccessTime, Person, ShowChart, Save, Edit,
} from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';
import { getUserRole } from '../utils/auth';
import { readSSEStream } from '../utils/sse';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import AppHeader from './AppHeader';
import ErrorMessage from './ErrorMessage';
import LiveMetrics from './LiveMetrics';
import './planEditorPrism.css';

/* ─── Tab definitions ─────────────────────────────────────────── */
const BASE_TABS = [
  { label: 'Logs',   Icon: Visibility,  dotColor: '#7ee787' },
  { label: 'Events', Icon: ListAlt,     dotColor: '#79c0ff' },
];
const METRICS_TAB = { label: 'Metrics', Icon: ShowChart, dotColor: '#a371f7' };
const PLAN_TAB = { label: 'Plan', Icon: Description, dotColor: '#e3b341' };
/** Logs, Events, Metrics, Plan — InfluxDB only affects Metrics charts. */
const JOB_DETAIL_TABS = [...BASE_TABS, METRICS_TAB, PLAN_TAB];

/** Match API: plan PUT only when job is in one of these statuses. */
const PLAN_EDIT_STATUSES = new Set(['ready', 'completed', 'failed']);

const APP_STATS_CACHE_KEY = 'kubeblast_app_stats';

/** Default XML text color (PCDATA / non-token spans); tag colors use inline styles on child spans. */
const XML_BASE_COLOR = '#e6edf3';

/** HTML string for XML syntax colors (shared by read-only view and edit backdrop). */
function highlightXmlToHtml(xml) {
  if (!xml) return '';
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inner = esc(xml).replace(
    /(&lt;!--[\s\S]*?--&gt;)|(&lt;\?[\s\S]*?\?&gt;)|(&lt;\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*&quot;[^&]*?&quot;|\s+[\w:.-]+\s*=\s*'[^']*?')*)(\/?\s*&gt;)/g,
    (match, comment, pi, open, tag, attrs, close) => {
      if (comment) return `<span style="color:#6a9955;font-style:italic">${comment}</span>`;
      if (pi) return `<span style="color:#c586c0">${pi}</span>`;
      const coloredAttrs = (attrs || '').replace(
        /([\w:.-]+)(\s*=\s*)(&quot;[^&]*?&quot;|'[^']*?')/g,
        '<span style="color:#9cdcfe">$1</span>$2<span style="color:#ce9178">$3</span>'
      );
      return `<span style="color:#808080">${open}</span><span style="color:#569cd6">${tag}</span>${coloredAttrs}<span style="color:#808080">${close}</span>`;
    }
  );
  return `<span style="color:${XML_BASE_COLOR}">${inner}</span>`;
}

function highlightPlanXml(code) {
  const src = code ?? '';
  try {
    return Prism.highlight(src, Prism.languages.markup, 'markup');
  } catch {
    return src
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

function readCachedAppStats() {
  try {
    const raw = sessionStorage.getItem(APP_STATS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCachedAppStats(data) {
  try {
    sessionStorage.setItem(
      APP_STATS_CACHE_KEY,
      JSON.stringify({
        INFLUXDB_ENABLED: Boolean(data?.INFLUXDB_ENABLED),
        LICENSE_VALID: Boolean(data?.LICENSE_VALID),
        TIMEZONE: data?.TIMEZONE || 'UTC',
      }),
    );
  } catch {
    /* ignore */
  }
}

/* ══════════════════════════════════════════════════════════════ */
const JobDetail = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const userRole = getUserRole();

  /* ── State ─────────────────────────────────────────────────── */
  const [job, setJob]                       = useState(null);
  const [error, setError]                   = useState('');
  const [activeTab, setActiveTab]           = useState(0);
  const [logs, setLogs]                     = useState('');
  const [events, setEvents]                 = useState('');
  const [planText, setPlanText]             = useState('');
  const [logsStreaming, setLogsStreaming]   = useState(false);
  const [eventsStreaming, setEventsStreaming] = useState(false);
  const [isPro, setIsPro]                   = useState(() => Boolean(readCachedAppStats()?.LICENSE_VALID));
  const [influxdbEnabled, setInfluxdbEnabled] = useState(() => Boolean(readCachedAppStats()?.INFLUXDB_ENABLED));
  const [timezone, setTimezone]             = useState(() => readCachedAppStats()?.TIMEZONE || 'UTC');
  const [confirmDelete, setConfirmDelete]   = useState(false);
  const [planSaving, setPlanSaving]         = useState(false);
  const [planEditingMode, setPlanEditingMode] = useState(false);
  const [planBaseline, setPlanBaseline]     = useState('');
  const logsAbortRef   = useRef(null);
  const eventsAbortRef = useRef(null);
  /** Set after a successful plan GET for `job_id`; cleared when route `jobId` changes. */
  const planLoadedForJobIdRef = useRef(null);

  /* ── App stats ─────────────────────────────────────────────── */
  useEffect(() => {
    const fetchAppStats = async () => {
      try {
        const res = await axiosInstance.get('/stats/app');
        writeCachedAppStats(res.data);
        setIsPro(Boolean(res.data?.LICENSE_VALID));
        setInfluxdbEnabled(Boolean(res.data?.INFLUXDB_ENABLED));
        if (res.data?.TIMEZONE) setTimezone(res.data.TIMEZONE);
      } catch {
        const c = readCachedAppStats();
        if (c) {
          setIsPro(Boolean(c.LICENSE_VALID));
          setInfluxdbEnabled(Boolean(c.INFLUXDB_ENABLED));
          if (c.TIMEZONE) setTimezone(c.TIMEZONE);
        }
      }
    };
    fetchAppStats();
  }, []);

  /* ── Fetch job ─────────────────────────────────────────────── */
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

  useEffect(() => { fetchJob(); }, [fetchJob]);
  useEffect(() => {
    const id = setInterval(fetchJob, 5000);
    return () => clearInterval(id);
  }, [fetchJob]);

  useEffect(() => {
    planLoadedForJobIdRef.current = null;
    setPlanText('');
    setPlanEditingMode(false);
  }, [jobId]);

  const isPlanEditable = Boolean(job && PLAN_EDIT_STATUSES.has(job.status));

  useEffect(() => {
    if (!isPlanEditable) {
      setPlanEditingMode(false);
    }
  }, [isPlanEditable]);

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
      default: return { bg: '#E5E7EB', text: '#111827', border: '#9CA3AF' };
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

  /* ── Job actions ───────────────────────────────────────────── */
  const approveJob = async (id) => {
    try {
      await axiosInstance.put(`/jobs/${id}/approve?approved=true`, {});
      setJob((p) => p?.id === id ? { ...p, status: 'ready' } : p);
    } catch (err) { setError(err?.response?.data?.detail || err?.message); }
  };

  const declineJob = async (id) => {
    try {
      await axiosInstance.put(`/jobs/${id}/approve?approved=false`, {});
      setJob((p) => p?.id === id ? { ...p, status: 'declined' } : p);
    } catch (err) { setError(err?.response?.data?.detail || err?.message); }
  };

  const startJob = async (id) => {
    try {
      await axiosInstance.put(`/jobs/${id}/start`, {});
      setJob((p) => p?.id === id ? { ...p, status: 'running' } : p);
    } catch (err) { setError(err?.response?.data?.detail || err?.message); }
  };

  const stopJob = async (id) => {
    try {
      await axiosInstance.put(`/jobs/${id}/stop`, {});
      setJob((p) => p?.id === id ? { ...p, status: 'stopping' } : p);
    } catch (err) { setError(err?.response?.data?.detail || err?.message); }
  };

  const rescheduleJob = async (id) => {
    try {
      await axiosInstance.put(`/jobs/${id}/retry`, {});
      setJob((p) => p?.id === id ? { ...p, status: 'retrying' } : p);
    } catch (err) { setError(err?.response?.data?.detail || err?.message); }
  };

  const deleteJob = async (id) => {
    try {
      await axiosInstance.delete(`/jobs/${id}`);
      navigate('/jobs');
    } catch (err) { setError(err?.response?.data?.detail || err?.message); }
  };

  const savePlan = async (id) => {
    if (!id || !PLAN_EDIT_STATUSES.has(job?.status)) return;
    setPlanSaving(true);
    setError('');
    try {
      const res = await axiosInstance.put(`/jobs/${id}/plan`, planText, {
        headers: { 'Content-Type': 'application/xml' },
      });
      setJob(res.data);
      planLoadedForJobIdRef.current = id;
      setPlanEditingMode(false);
    } catch (err) {
      const d = err.response?.data?.detail || err.message;
      setError(d);
    } finally {
      setPlanSaving(false);
    }
  };

  /* ── Stream helpers ────────────────────────────────────────── */
  const stopLogsStream = () => {
    try { if (logsAbortRef.current) logsAbortRef.current.abort(); } catch {}
    logsAbortRef.current = null;
    setLogsStreaming(false);
  };

  const stopEventsStream = () => {
    try { if (eventsAbortRef.current) eventsAbortRef.current.abort(); } catch {}
    eventsAbortRef.current = null;
    setEventsStreaming(false);
  };

  useEffect(() => () => { stopLogsStream(); stopEventsStream(); }, []);

  /* ── View logs ─────────────────────────────────────────────── */
  const viewLogs = async (job_id, job_status) => {
    if (!['running', 'completed', 'failed'].includes(job_status)) {
      setError('Logs are only available for running, completed, or failed jobs.'); return;
    }
    try {
      const token = localStorage.getItem('access_token');
      if (!token) { setError('Unauthorized: Please log in'); return; }
      stopLogsStream();
      const controller = new AbortController();
      logsAbortRef.current = controller;
      setLogsStreaming(true);
      const response = await fetch(`${axiosInstance.defaults.baseURL}/jobs/${job_id}/logs`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      });
      if (!response.ok) { const d = await response.json(); throw new Error(d.detail || `HTTP ${response.status}`); }
      let content = '';
      const readStream = async () => {
        try {
          await readSSEStream(response.body, ({ event, data }) => {
            if (event !== 'message') content += `\n[${event}]\n`;
            try {
              const obj = JSON.parse(data);
              content += `${obj.msg != null ? String(obj.msg) : data}\n`;
            } catch { content += data + '\n'; }
            setLogs(content);
          });
        } catch (err) {
          if (err?.name !== 'AbortError' && !content) setError(err?.message || 'Error reading logs.');
        } finally { setLogsStreaming(false); }
      };
      readStream();
    } catch (err) { setLogsStreaming(false); setError(err?.message || 'Error fetching logs'); }
  };

  /* ── View events ───────────────────────────────────────────── */
  const viewEvents = async (job_id) => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) { setError('Unauthorized: Please log in'); return; }
      stopEventsStream();
      const controller = new AbortController();
      eventsAbortRef.current = controller;
      setEventsStreaming(true);
      const response = await fetch(`${axiosInstance.defaults.baseURL}/jobs/${job_id}/events`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
        signal: controller.signal,
      });
      if (!response.ok) { const d = await response.json(); throw new Error(d.detail || `HTTP ${response.status}`); }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = '';
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
                  content += `${ts ? `[${ts}] ` : ''}${obj.msg ? String(obj.msg) : data}\n`;
                } catch { content += data + '\n'; }
              } else if (line.startsWith('event: ')) {
                content += `\n[${line.slice(7)}]\n`;
              }
            }
            setEvents(content);
          }
        } catch (err) {
          if (err?.name !== 'AbortError' && !content) setError(err?.message || 'Error reading events.');
        } finally { reader.releaseLock(); setEventsStreaming(false); }
      };
      readStream();
    } catch (err) { setEventsStreaming(false); setError(err?.message || 'Error fetching events'); }
  };

  /* ── Fetch plan (one HTTP GET; full XML in one response — not streamed). Uses cache per job until refresh or route change. ─ */
  const fetchPlanText = async (job_id, opts = {}) => {
    const force = opts.force === true;
    try {
      if (!job_id) { setError('No job available.'); return; }
      if (!force && planLoadedForJobIdRef.current === job_id) return;

      const response = await axiosInstance.get(`/jobs/${job_id}/files`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}`, Accept: 'application/xml' },
        params: { type: 'plan' }, responseType: 'text',
      });
      const text = typeof response.data === 'string' ? response.data : String(response.data || '');
      setPlanText(text);
      planLoadedForJobIdRef.current = job_id;
    } catch (err) {
      const d = err.response?.data instanceof Blob ? await err.response.data.text() : err.response?.data?.detail || err.message;
      setError(d);
    }
  };

  /* ── When job loads: stream logs & events, fetch plan; metrics poll via mounted LiveMetrics (see below). ─ */
  useEffect(() => {
    if (!job?.id) return undefined;
    const jid = job.id;
    const st = job.status;

    viewEvents(jid);
    fetchPlanText(jid);
    if (['running', 'completed', 'failed'].includes(st)) {
      viewLogs(jid, st);
    }

    return () => {
      stopLogsStream();
      stopEventsStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: (re)start when job identity/status changes
  }, [job?.id, job?.status]);

  /* ── Download result ───────────────────────────────────────── */
  const downloadResult = async (job_id) => {
    try {
      if (!job_id) { setError('No job available.'); return; }
      const response = await axiosInstance.get(`/jobs/${job_id}/files`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        params: { type: 'result' }, responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/plain' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `kb-${job?.name || job_id}-result.jtl`;
      link.click();
    } catch (err) {
      const d = err.response?.data instanceof Blob ? await err.response.data.text() : err.response?.data?.detail || err.message;
      setError(d);
    }
  };

  /* ── Download report ──────────────────────────────────────── */
  const downloadReport = async (job_id) => {
    try {
      if (!job_id) { setError('No job available.'); return; }
      const response = await axiosInstance.get(`/jobs/${job_id}/files`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        params: { type: 'report' }, responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/zip' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `kb-${job?.name || job_id}-report.zip`;
      link.click();
    } catch (err) {
      const d = err.response?.data instanceof Blob ? await err.response.data.text() : err.response?.data?.detail || err.message;
      setError(d);
    }
  };

  /* ── XML syntax highlighting ──────────────────────────────── */
  const highlightXml = useCallback((xml) => {
    if (!xml) return null;
    return <span dangerouslySetInnerHTML={{ __html: highlightXmlToHtml(xml) }} />;
  }, []);

  /* ── Derived ───────────────────────────────────────────────── */
  const statusColors  = useMemo(() => getStatusColor(job?.status), [job?.status]);
  const ownerVisible  = (userRole === 'admin' || userRole === 'moderator') && isPro;
  const canModerate   = (userRole === 'admin' || userRole === 'moderator') && isPro;
  const isMetricsTab  = activeTab === 2;
  const canEditPlan   = isPlanEditable;
  const currentContent = activeTab === 0 ? logs : activeTab === 1 ? events : activeTab === 3 ? planText : '';
  const showTerminalPlaceholder = (() => {
    if (activeTab === 3) return false;
    if (!currentContent && activeTab === 0 && logsStreaming) return false;
    if (!currentContent && activeTab === 1 && eventsStreaming) return false;
    return !currentContent;
  })();

  const handleTabChange = (_, newValue) => {
    if (activeTab === 3 && newValue !== 3) setPlanEditingMode(false);
    setActiveTab(newValue);
  };

  const enterPlanEditMode = () => {
    setPlanBaseline(planText);
    setPlanEditingMode(true);
  };

  const cancelPlanEdit = () => {
    setPlanText(planBaseline);
    setPlanEditingMode(false);
  };

  /* Recharts measures on mount; nudge layout when Metrics tab becomes visible again. */
  useEffect(() => {
    if (!isMetricsTab) return;
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return () => cancelAnimationFrame(id);
  }, [isMetricsTab]);

  /* ── Action button styles ──────────────────────────────────── */
  const btnBase = { borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.875rem', px: 2.2, boxShadow: 'none' };
  const dangerBtn = { ...btnBase, color: '#ef4444', borderColor: '#ef4444', '&:hover': { bgcolor: '#fee2e2', borderColor: '#dc2626' } };
  const amberBtn  = { ...btnBase, color: '#d97706', borderColor: '#f59e0b', '&:hover': { bgcolor: '#fef3c7', borderColor: '#d97706' } };

  /* ════════════════════════════════════════════════════════════ */
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader title="Job Detail" />

      <Box className="page-container fade-in">
        {/* ── Back button ───────────────────────────────────── */}
        <Box sx={{ mb: 2 }}>
          <Button
            startIcon={<ArrowBack sx={{ fontSize: 16 }} />}
            onClick={() => navigate('/jobs')}
            sx={{
              color: 'var(--text-secondary)', textTransform: 'none', fontWeight: 500,
              fontSize: '0.85rem', borderRadius: '9px', px: 1.5, py: 0.6,
              '&:hover': { color: 'var(--text-primary)', bgcolor: 'var(--background-light)' },
            }}
          >
            Back to Jobs
          </Button>
        </Box>

        <ErrorMessage message={error} />

        {/* ── Hero Card ─────────────────────────────────────── */}
        <Box sx={{
          position: 'relative', overflow: 'hidden',
          backgroundColor: 'background.paper',
          borderRadius: '20px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
          mb: 2.5,
        }}>
          {/* Status accent bar */}
          {job && (
            <Box sx={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 5,
              bgcolor: statusColors.border,
              borderTopLeftRadius: '20px', borderBottomLeftRadius: '20px',
              transition: 'background-color 0.4s',
            }} />
          )}


          <Box sx={{ p: 3.5, pl: 4.5 }}>
            {!job ? (
              <Box sx={{ display: 'grid', gap: 2 }}>
                <Skeleton variant="text" width="42%" height={44} sx={{ borderRadius: '8px' }} />
                <Skeleton variant="text" width="60%" height={22} />
                <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
                  <Skeleton variant="text" width={140} height={20} />
                  <Skeleton variant="text" width={100} height={20} />
                </Box>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  {[80, 70, 90, 80].map((w, i) => (
                    <Skeleton key={i} variant="rounded" width={w} height={36} sx={{ borderRadius: '10px' }} />
                  ))}
                </Box>
              </Box>
            ) : (
              <>
                {/* Name + Status badge */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2, letterSpacing: '-0.4px' }}>
                    {job.name}
                  </Typography>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 0.8,
                    px: 1.8, py: 0.6,
                    bgcolor: statusColors.bg, color: statusColors.text,
                    borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700,
                    border: `1.5px solid ${statusColors.border}`,
                    whiteSpace: 'nowrap', flexShrink: 0,
                    transition: 'all 0.3s',
                  }}>
                    <Box sx={{
                      width: 7, height: 7, borderRadius: '50%', bgcolor: statusColors.border,
                      ...(job.status === 'running' && {
                        animation: 'jdPulse 1.5s ease-in-out infinite',
                        '@keyframes jdPulse': {
                          '0%,100%': { opacity: 1, transform: 'scale(1)' },
                          '50%': { opacity: 0.3, transform: 'scale(1.8)' },
                        },
                      }),
                    }} />
                    {String(job.status || '').charAt(0).toUpperCase() + String(job.status || '').slice(1)}
                  </Box>
                </Box>

                {/* Description */}
                {job.description && (
                  <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 1.8, lineHeight: 1.65, maxWidth: 680 }}>
                    {job.description}
                  </Typography>
                )}

                {/* Metadata row */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap', mb: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, color: 'var(--text-secondary)' }}>
                    <AccessTime sx={{ fontSize: 13 }} />
                    <Typography variant="caption" sx={{ fontSize: '0.8rem' }}>{formatDate(job.created_at)}</Typography>
                  </Box>
                  {ownerVisible && job.owner && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, color: 'var(--text-secondary)' }}>
                      <Person sx={{ fontSize: 13 }} />
                      <Typography variant="caption" sx={{ fontSize: '0.8rem' }}>{job.owner}</Typography>
                    </Box>
                  )}
                  {/* <Box sx={{
                    display: 'flex', alignItems: 'center',
                    bgcolor: 'var(--background-light)', px: 1, py: 0.3,
                    borderRadius: '6px', border: '1px solid var(--border-color)',
                  }}>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      ID: {job.id}
                    </Typography>
                  </Box> */}
                </Box>

                {/* Action buttons */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                  {job.status === 'pending' && canModerate && (
                    <>
                      <Button variant="contained" startIcon={<CheckCircle sx={{ fontSize: 16 }} />}
                        onClick={() => approveJob(job.id)}
                        sx={{ ...btnBase, background: 'linear-gradient(135deg,#059669,#10b981)', boxShadow: 'none', '&:hover': { background: 'linear-gradient(135deg,#047857,#059669)' } }}
                      >Approve</Button>
                      <Button variant="outlined" startIcon={<Cancel sx={{ fontSize: 16 }} />}
                        onClick={() => declineJob(job.id)} sx={dangerBtn}
                      >Decline</Button>
                    </>
                  )}
                  {job.status === 'ready' && (
                    <Button variant="contained" startIcon={<PlayArrow sx={{ fontSize: 16 }} />}
                      onClick={() => startJob(job.id)}
                      sx={{ ...btnBase, background: 'linear-gradient(135deg,#326CE5,#1e40af)', boxShadow: 'none', '&:hover': { background: 'linear-gradient(135deg,#2563eb,#1e3a8a)' } }}
                    >Start</Button>
                  )}
                  {job.status === 'running' && (
                    <Button variant="outlined" startIcon={<Stop sx={{ fontSize: 16 }} />}
                      onClick={() => stopJob(job.id)} sx={dangerBtn}
                    >Stop</Button>
                  )}
                  {(job.status === 'failed' || job.status === 'completed') && (
                    <Button variant="outlined" startIcon={<Autorenew sx={{ fontSize: 16 }} />}
                      onClick={() => rescheduleJob(job.id)} sx={amberBtn}
                    >Retry</Button>
                  )}
                  {job.status === 'completed' && (
                    <>
                      <Button variant="outlined" startIcon={<Download sx={{ fontSize: 16 }} />}
                        onClick={() => downloadResult(job.id)} sx={btnBase}
                      >Result</Button>
                      <Button variant="outlined" startIcon={<Download sx={{ fontSize: 16 }} />}
                        onClick={() => downloadReport(job.id)} sx={btnBase}
                      >Report</Button>
                    </>
                  )}
                  <Box sx={{ flex: 1 }} />
                  <Button variant="outlined" startIcon={<Delete sx={{ fontSize: 16 }} />}
                    onClick={() => setConfirmDelete(true)} sx={dangerBtn}
                  >Delete</Button>
                </Box>
              </>
            )}
          </Box>
        </Box>

        {/* ── Terminal Panel ────────────────────────────────── */}
        {job && (
          <Box sx={{
            bgcolor: '#0d1117',
            borderRadius: '18px',
            border: '1px solid #30363d',
            boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}>

            {/* Terminal title bar */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 2.5, py: 1.3,
              borderBottom: '1px solid #21262d',
              bgcolor: '#161b22',
            }}>
              {/* Tabs */}
              {JOB_DETAIL_TABS.map(({ label, Icon, dotColor }, idx) => (
                <Box
                  key={idx}
                  onClick={() => handleTabChange(null, idx)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.7,
                    px: 1.6, py: 0.55,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: activeTab === idx ? 600 : 400,
                    color: activeTab === idx ? dotColor : '#8b949e',
                    bgcolor: activeTab === idx ? 'rgba(255,255,255,0.07)' : 'transparent',
                    border: activeTab === idx ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                    transition: 'all 0.15s',
                    userSelect: 'none',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.05)',
                      color: activeTab === idx ? dotColor : '#c9d1d9',
                    },
                  }}
                >
                  <Icon sx={{ fontSize: 14 }} />
                  {label}
                </Box>
              ))}
              {activeTab === 3 && canEditPlan && (
                <Box sx={{ flex: 1 }} />
              )}
              {activeTab === 3 && canEditPlan && !planEditingMode && (
                <Button
                  type="button"
                  size="small"
                  variant="outlined"
                  startIcon={<Edit sx={{ fontSize: 16 }} />}
                  onClick={enterPlanEditMode}
                  sx={{
                    ml: 'auto',
                    flexShrink: 0,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    color: '#e3b341',
                    borderColor: 'rgba(227,179,65,0.55)',
                    '&:hover': { borderColor: '#e3b341', bgcolor: 'rgba(227,179,65,0.08)' },
                  }}
                >
                  Edit
                </Button>
              )}
              {activeTab === 3 && canEditPlan && planEditingMode && (
                <>
                  <Button
                    type="button"
                    size="small"
                    variant="outlined"
                    disabled={planSaving}
                    onClick={cancelPlanEdit}
                    sx={{
                      flexShrink: 0,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      borderRadius: '8px',
                      color: '#8b949e',
                      borderColor: '#30363d',
                      '&:hover': { borderColor: '#484f58', bgcolor: 'rgba(255,255,255,0.04)' },
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="small"
                    variant="contained"
                    disabled={planSaving}
                    startIcon={planSaving ? <CircularProgress size={14} color="inherit" /> : <Save sx={{ fontSize: 16 }} />}
                    onClick={() => savePlan(job.id)}
                    sx={{
                      flexShrink: 0,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      borderRadius: '8px',
                      bgcolor: '#e3b341',
                      color: '#1c1917',
                      boxShadow: 'none',
                      '&:hover': { bgcolor: '#f5d565', boxShadow: 'none' },
                      '&.Mui-disabled': { bgcolor: 'rgba(227,179,65,0.35)', color: '#1c1917' },
                    }}
                  >
                    Save plan
                  </Button>
                </>
              )}
            </Box>

            {/* Metrics: mount when Influx is on so polling runs even on other tabs; show only on Metrics tab */}
            {influxdbEnabled && (
              <Box sx={{ display: isMetricsTab ? 'block' : 'none', minHeight: isMetricsTab ? 320 : 0 }}>
                <LiveMetrics
                  key={job.id}
                  jobId={job.id}
                  jobStatus={job.status}
                  displayTimeZone={timezone || 'UTC'}
                />
              </Box>
            )}
            {isMetricsTab && !influxdbEnabled && (
              <Box sx={{
                px: 3, py: 4, minHeight: 320,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Typography sx={{
                  color: '#8b949e',
                  fontSize: '0.9rem',
                  textAlign: 'center',
                  maxWidth: 420,
                  lineHeight: 1.7,
                }}>
                  Metrics are not enabled for this deployment. Live charts require InfluxDB to be configured on the server.
                </Typography>
              </Box>
            )}
            {!isMetricsTab && (
            <Box sx={{
              px: 3, py: 2.5,
              fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",monospace',
              fontSize: '0.8rem',
              lineHeight: 1.9,
              color: '#e6edf3',
              minHeight: 320,
              maxHeight: '65vh',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {!showTerminalPlaceholder
                ? (activeTab === 3 && canEditPlan && planEditingMode
                  ? (
                    <Box
                      className="plan-code-editor"
                      sx={{
                        width: '100%',
                        minHeight: 280,
                        '& pre, & textarea': {
                          margin: 0,
                          whiteSpace: 'pre-wrap !important',
                          wordBreak: 'break-all',
                        },
                      }}
                    >
                      <Editor
                        value={planText}
                        onValueChange={setPlanText}
                        highlight={highlightPlanXml}
                        padding={0}
                        disabled={planSaving}
                        style={{
                          fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",monospace',
                          fontSize: '0.8rem',
                          lineHeight: 1.9,
                          minHeight: 280,
                          color: XML_BASE_COLOR,
                          backgroundColor: 'transparent',
                        }}
                        textareaProps={{
                          spellCheck: false,
                          'aria-label': 'JMeter plan XML',
                        }}
                      />
                    </Box>
                  )
                  : activeTab === 3
                    ? highlightXml(currentContent)
                    : (currentContent || ''))
                : (
                <Typography sx={{ color: '#484f58', fontFamily: 'inherit', fontSize: '0.8rem', fontStyle: 'italic' }}>
                  {activeTab === 0
                    ? (['running', 'completed', 'failed'].includes(job?.status || '')
                      ? '# Waiting for logs…'
                      : '# Logs are available when the job is running, completed, or failed.')
                    : activeTab === 3
                      ? '# No plan content loaded.'
                      : '# Waiting for events…'}
                </Typography>
              )}
            </Box>
            )}
          </Box>
        )}

        {/* ── Delete confirmation modal ──────────────────────── */}
        <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)}>
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
            {job && (
              <Typography variant="body2" sx={{ textAlign: 'center', mb: 1, color: 'var(--text-secondary)' }}>
                <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {job.name}
                </Box>
              </Typography>
            )}
            {/* Warning */}
            <Typography variant="body2" sx={{ textAlign: 'center', color: 'var(--text-secondary)', mb: 3.5, lineHeight: 1.6 }}>
              This action cannot be undone. The job and all associated data will be permanently removed.
            </Typography>
            {/* Buttons */}
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                fullWidth variant="outlined"
                onClick={() => setConfirmDelete(false)}
                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, py: 1.2 }}
              >
                Cancel
              </Button>
              <Button
                fullWidth variant="contained"
                onClick={() => { setConfirmDelete(false); deleteJob(job.id); }}
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

      </Box>
    </Box>
  );
};

export default JobDetail;

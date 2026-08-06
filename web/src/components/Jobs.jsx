import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, IconButton, Menu, MenuItem, Modal, Button, Tooltip,
  TextField, Select, FormControl, Pagination,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  LinearProgress, Skeleton, Divider, InputAdornment,
} from '@mui/material';
import {
  Delete, MoreVert, CheckCircle, Cancel,
  Autorenew, Add, PlayArrow, ListAlt, Stop,
  Search, ViewModule, ViewList, Memory, DeveloperBoard, Dns,
  AccessTime, FiberManualRecord,
} from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";
import { getUserRole } from "../utils/auth";
import AppHeader from './AppHeader';
import AddJob from "./AddJob";
import ErrorMessage from './ErrorMessage';

const STATUS_CHIPS = [
  { value: 'all',       label: 'All',       color: '#4f46e5', activeColor: '#4f46e5', inactiveBg: '#ede9fe' },
  { value: 'pending',   label: 'Pending',   color: '#374151', activeColor: '#4b5563', inactiveBg: '#f3f4f6' },
  { value: 'running',   label: 'Running',   color: '#1e40af', activeColor: '#2563eb', inactiveBg: '#dbeafe' },
  { value: 'completed', label: 'Completed', color: '#065f46', activeColor: '#059669', inactiveBg: '#d1fae5' },
  { value: 'failed',    label: 'Failed',    color: '#7f1d1d', activeColor: '#dc2626', inactiveBg: '#fee2e2' },
];

const CapacityCard = ({ icon, iconBg, label, value, sub, progress, progressColor }) => (
  <Box sx={{
    p: 1.5,
    border: '1px solid var(--border-color)',
    borderRadius: '18px',
    backgroundColor: 'background.paper',
    transition: 'transform 0.22s ease, box-shadow 0.22s ease',
    '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 14px 32px rgba(0,0,0,0.10)' },
    cursor: 'default',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 1',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  }}>
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, mb: (sub || progress !== undefined) ? 1 : 0, minWidth: 0 }}>
      <Box sx={{ width: 38, height: 38, borderRadius: '12px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, width: '100%' }}>
        <Typography sx={{ color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.58rem', display: 'block', mb: 0.3, whiteSpace: 'nowrap' }}>
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 700, lineHeight: 1.15, color: 'text.primary', fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}
        </Typography>
      </Box>
    </Box>
    {sub && (
      <Typography variant="caption" sx={{ color: 'var(--text-secondary)', display: 'block', mb: progress !== undefined ? 0.8 : 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

const Jobs = () => {
  const navigate = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [openAddJob, setOpenAddJob] = useState(false);
  const [resources, setResources] = useState(null);
  const [resourcesError, setResourcesError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_desc');
  const [viewMode, setViewMode] = useState('grid');
  const [goToPage, setGoToPage] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const userRole = getUserRole();
  const [isPro, setIsPro] = useState(false);
  const [timezone, setTimezone] = useState('UTC');

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

  const handleMenuOpen = (event, job_id) => { setAnchorEl(event.currentTarget); setSelectedJobId(job_id); };
  const handleMenuClose = () => { setAnchorEl(null); setSelectedJobId(null); };
  const handleAddJob = () => setOpenAddJob(true);
  const handleAddJobSuccess = () => { fetchJobs(); setOpenAddJob(false); };
  const handleModalClose = () => setOpenAddJob(false);

  const approveJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/${job_id}/approve?approved=true`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      setJobs(jobs.map(j => j.id === job_id ? { ...j, status: 'ready' } : j));
      handleMenuClose();
    } catch (error) { setError(error.response?.data?.detail || error.message); }
  };

  const declineJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/${job_id}/approve?approved=false`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      setJobs(jobs.map(j => j.id === job_id ? { ...j, status: 'declined' } : j));
      handleMenuClose();
    } catch (error) { setError(error.response?.data?.detail || error.message); }
  };

  const deleteJob = async (job_id) => {
    try {
      await axiosInstance.delete(`/jobs/${job_id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      setJobs(jobs.filter(j => j.id !== job_id)); handleMenuClose();
    } catch (error) { setError(error.response?.data?.detail || error.message); }
  };

  const rescheduleJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/${job_id}/retry`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      setJobs(jobs.map(j => j.id === job_id ? { ...j, status: 'retrying' } : j)); handleMenuClose();
    } catch (error) { setError(error.response?.data?.detail || error.message); }
  };

  const startJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/${job_id}/start`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      setJobs(jobs.map(j => j.id === job_id ? { ...j, status: 'running' } : j)); handleMenuClose();
    } catch (error) { setError(error.response?.data?.detail || error.message); }
  };

  const stopJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/${job_id}/stop`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } });
      setJobs(jobs.map(j => j.id === job_id ? { ...j, status: 'stopping' } : j)); handleMenuClose();
    } catch (error) { setError(error.response?.data?.detail || error.message); }
  };

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

  const formatCpuQuota = (quota = {}) => {
    if (quota.cpu !== undefined) return String(quota.cpu);
    if (quota.cpu_m !== undefined) return `${formatCores(quota.cpu_m)}c`;
    return '-';
  };

  const formatMemoryQuota = (quota = {}) => {
    if (quota.memory !== undefined) return String(quota.memory);
    if (quota.memory_bytes !== undefined) return `${formatGiB(quota.memory_bytes)}Gi`;
    return '-';
  };

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

  const selectedJob = jobs.find(j => j.id === selectedJobId) || null;

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

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader title="Jobs" />

      <Box className="page-container fade-in">

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

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))', gap: 2, alignItems: 'stretch', overflowX: 'auto', pb: 0.5 }}>
            {!resources ? (
              [0, 1, 2, 3, 4].map(i => (
                <Skeleton key={i} variant="rounded" height={96} sx={{ borderRadius: '14px', transform: 'none' }} />
              ))
            ) : (
              <>
                <Tooltip title="Available nodes matching selector/tolerations" arrow>
                  <span style={{ display: 'block', height: '100%' }}>
                    <CapacityCard
                      icon={<Dns sx={{ fontSize: 20, color: '#fff' }} />}
                      iconBg="linear-gradient(135deg, #10b981, #34d399)"
                      label="Nodes"
                      value={resources.nodesMatching ?? resources.nodesTotal ?? 0}
                      sub="Matching available"
                    />
                  </span>
                </Tooltip>

                {(() => {
                  const avail = formatCores(resources.remaining?.cpu_m || 0);
                  const total = formatCores(resources.capacity?.cpu_m || 0);
                  const pct = resources.capacity?.cpu_m
                    ? ((resources.capacity.cpu_m - (resources.remaining?.cpu_m || 0)) / resources.capacity.cpu_m) * 100
                    : 0;
                  const color = pct > 85 ? '#ef4444' : pct > 65 ? '#f59e0b' : '#326CE5';
                  return (
                    <Tooltip title="Available vs total CPU across matching available nodes" arrow>
                      <span style={{ display: 'block', height: '100%' }}>
                        <CapacityCard
                          icon={<DeveloperBoard sx={{ fontSize: 20, color: '#fff' }} />}
                          iconBg={`linear-gradient(135deg, ${pct > 85 ? '#ef4444,#f87171' : pct > 65 ? '#f59e0b,#fbbf24' : '#326CE5,#7aa2f7'})`}
                          label="CPU"
                          value={`${avail} / ${total} cores`}
                          sub="Available / Total"
                          progress={pct}
                          progressColor={color}
                        />
                      </span>
                    </Tooltip>
                  );
                })()}

                {resources.jobResources && (() => {
                  const jr = resources.jobResources || {};
                  const cpuReq = formatCpuQuota(jr.requests);
                  const cpuLim = formatCpuQuota(jr.limits);
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

                {resources.jobResources && (() => {
                  const jr = resources.jobResources || {};
                  const memReq = formatMemoryQuota(jr.requests);
                  const memLim = formatMemoryQuota(jr.limits);
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

                {(() => {
                  const avail = formatGiB(resources.remaining?.memory_bytes || 0);
                  const total = formatGiB(resources.capacity?.memory_bytes || 0);
                  const pct = resources.capacity?.memory_bytes
                    ? ((resources.capacity.memory_bytes - (resources.remaining?.memory_bytes || 0)) / resources.capacity.memory_bytes) * 100
                    : 0;
                  const color = pct > 85 ? '#ef4444' : pct > 65 ? '#f59e0b' : '#10b981';
                  return (
                    <Tooltip title="Available vs total RAM across matching available nodes" arrow>
                      <span style={{ display: 'block', height: '100%' }}>
                        <CapacityCard
                          icon={<Memory sx={{ fontSize: 20, color: '#fff' }} />}
                          iconBg={`linear-gradient(135deg, ${pct > 85 ? '#ef4444,#f87171' : pct > 65 ? '#f59e0b,#fbbf24' : '#10b981,#34d399'})`}
                          label="RAM"
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

        <Box sx={{
          mb: 2,
          backgroundColor: 'background.paper',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          px: 2.5, pt: 2, pb: 1.5,
        }}>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>

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



            <Box sx={{ flex: 1 }} />

            {totalJobs > 0 && (
              <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {totalJobs > pageSize
                  ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalJobs)} of `
                  : ''}
                {totalJobs} job{totalJobs !== 1 ? 's' : ''}
              </Typography>
            )}

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

          <Box sx={{ height: 1, bgcolor: 'var(--border-color)', mx: -0.5, mb: 1.5 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>

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

            <Box sx={{ flex: 1, minWidth: 8 }} />

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

            <FormControl size="small" sx={{ minWidth: 100, flexShrink: 0 }}>
              <Select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value) || 1); setPage(1); }}
                sx={{ fontSize: '0.82rem', borderRadius: '8px' }}
              >
                {[5, 10, 20, 50].map(n => <MenuItem key={n} value={n}>{n} / page</MenuItem>)}
              </Select>
            </FormControl>

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

        {jobs.length === 0 ? (
          <EmptyState />
        ) : viewMode === 'table' ? (

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
            <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center', mb: 1, color: 'text.primary' }}>
              Delete Job?
            </Typography>
            {confirmDeleteId && (
              <Typography variant="body2" sx={{ textAlign: 'center', mb: 1, color: 'var(--text-secondary)' }}>
                <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {jobs.find(j => j.id === confirmDeleteId)?.name || confirmDeleteId}
                </Box>
              </Typography>
            )}
            <Typography variant="body2" sx={{ textAlign: 'center', color: 'var(--text-secondary)', mb: 3.5, lineHeight: 1.6 }}>
              This action cannot be undone. The job and all associated data will be permanently removed.
            </Typography>
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

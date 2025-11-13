import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, IconButton, Menu, MenuItem, Modal, Button, Tooltip, TextField, Select, FormControl, InputLabel } from '@mui/material';
import { Delete, MoreVert, CheckCircle, Cancel, Visibility, Description, Autorenew, Download, Add, Star, PlayArrow, ListAlt, Stop, Dashboard, Search } from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";
import Menuselect from "./Menuselect";
import AddJob from "./AddJob";
import ErrorMessage from './ErrorMessage';

const Jobs = () => {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState(5);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [logs, setLogs] = useState(null);
  const [openAddJob, setOpenAddJob] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedJobDetails, setSelectedJobDetails] = useState(null);
  const [resources, setResources] = useState(null);
  const [resourcesError, setResourcesError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_desc'); // created_desc | created_asc | name_asc | name_desc | status_asc | status_desc
  const userRole = sessionStorage.getItem('user_role');
  const isPro = process.env.REACT_APP_IS_PRO === 'true';
  const proRedirectUrl = process.env.REACT_APP_PRO_REDIRECT_URL || 'https://kubeblast.teymur.pro';

  const handleProFeature = () => {
    window.location.href = proRedirectUrl;
  };

  const openReport = async (job_id) => {
    try {
      if (!job_id) {
        setError("No job available.");
        return;
      }
      // Fetch index.html via API
      const response = await axiosInstance.get(`/files/${job_id}`, {
        headers: { 
          Authorization: `Bearer ${sessionStorage.getItem('access_token')}`,
          'Accept': 'text/html'
        },
        params: { type: "report" },
        responseType: 'text',
      });

      const rawHtml = typeof response.data === 'string' ? response.data : String(response.data || '');

      // Parse and inline assets so no nginx/static serving is needed
      const inlineAssets = async (html, currentDir = '') => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const toArray = (list) => Array.prototype.slice.call(list || []);

        const normalizePath = (baseDir, relPath) => {
          // Build a URL using a dummy origin to resolve relative paths
          const dummy = 'http://x/';
          const base = new URL(baseDir ? (dummy + baseDir) : dummy);
          const resolved = new URL(relPath, base);
          // Remove dummy origin and leading slash to keep path relative to report root
          return resolved.pathname.replace(/^\//, '');
        };

        const fetchText = async (relPath) => {
          const path = normalizePath(currentDir, relPath);
          const res = await axiosInstance.get(`/files/${job_id}`, {
            headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
            params: { type: "report", path },
            responseType: 'text'
          });
          return typeof res.data === 'string' ? res.data : String(res.data || '');
        };

        const fetchBinary = async (relPath) => {
          const path = normalizePath(currentDir, relPath);
          const res = await axiosInstance.get(`/files/${job_id}`, {
            headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
            params: { type: "report", path },
            responseType: 'arraybuffer'
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

        // Inline stylesheets
        const linkEls = toArray(doc.querySelectorAll('link[rel="stylesheet"][href]'));
        await Promise.all(linkEls.map(async (link) => {
          const href = link.getAttribute('href');
          try {
            const cssText = await fetchText(href);
            const styleEl = doc.createElement('style');
            styleEl.textContent = cssText;
            link.parentNode.replaceChild(styleEl, link);
          } catch (e) {
            // leave link as-is on failure
          }
        }));

        // Inline scripts
        const scriptEls = toArray(doc.querySelectorAll('script[src]'));
        await Promise.all(scriptEls.map(async (script) => {
          const src = script.getAttribute('src');
          try {
            const jsText = await fetchText(src);
            const inlineScript = doc.createElement('script');
            inlineScript.textContent = jsText;
            // Preserve attributes like type if present
            const typeAttr = script.getAttribute('type');
            if (typeAttr) inlineScript.setAttribute('type', typeAttr);
            script.parentNode.replaceChild(inlineScript, script);
          } catch (e) {
            // leave script as-is on failure
          }
        }));

        // Inline images and icons
        const imgEls = toArray(doc.querySelectorAll('img[src]'));
        await Promise.all(imgEls.map(async (img) => {
          const src = img.getAttribute('src');
          try {
            const data = await fetchBinary(src);
            const mime = guessMime(src);
            const url = toDataUrl(data, mime);
            img.setAttribute('src', url);
          } catch (e) {
            // leave src as-is on failure
          }
        }));

        const iconLinks = toArray(doc.querySelectorAll('link[rel="icon"][href], link[rel="shortcut icon"][href]'));
        await Promise.all(iconLinks.map(async (link) => {
          const href = link.getAttribute('href');
          try {
            const data = await fetchBinary(href);
            const mime = guessMime(href);
            const url = toDataUrl(data, mime);
            link.setAttribute('href', url);
          } catch (e) {
            // leave href as-is on failure
          }
        }));

        // Return full HTML
        return '<!doctype html>\n' + doc.documentElement.outerHTML;
      };

      const getDir = (p) => {
        if (!p) return '';
        const idx = p.lastIndexOf('/');
        return idx === -1 ? '' : p.slice(0, idx + 1);
      };

      const navigateTo = async (win, path) => {
        // Fetch and inline the requested page, then render and re-bind
        const res = await axiosInstance.get(`/files/${job_id}`, {
          headers: { 
            Authorization: `Bearer ${sessionStorage.getItem('access_token')}`,
            'Accept': 'text/html'
          },
          params: { type: "report", path },
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
        // Avoid multiple bindings by resetting handler on each render
        win.document.addEventListener('click', async (e) => {
          const anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
          if (!anchor) return;
          const href = anchor.getAttribute('href') || '';
          // Ignore external links, hashes, javascript, mailto
          const lower = href.toLowerCase();
          if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mailto:') || lower.startsWith('javascript:') || lower.startsWith('#')) {
            return;
          }
          e.preventDefault();
          // Resolve relative path against currentDir
          const dummy = 'http://x/';
          const base = new URL(currentDir ? (dummy + currentDir) : dummy);
          const resolved = new URL(href, base);
          const relPath = resolved.pathname.replace(/^\//, '');
          try {
            await navigateTo(win, relPath);
          } catch (err) {
            // Surface error back in app UI
            const msg = (err && (err.response?.data?.detail || err.message)) || 'Failed to load report page';
            setError(msg);
          }
        }, { capture: true });
      };

      const inlinedHtml = await inlineAssets(rawHtml, '');

      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        reportWindow.document.open();
        reportWindow.document.write(inlinedHtml);
        reportWindow.document.close();
        // Intercept internal navigation to load via API and re-inline assets
        bindLinkHandlers(reportWindow, '');
      } else {
        setError('Popup blocked. Please allow popups for this site.');
      }
      handleMenuClose();
    } catch (error) {
      const errorDetail = error.response?.data instanceof Blob ? 
        await error.response.data.text() : 
        error.response?.data?.detail || error.message;
      setError(errorDetail);
    }
  };

  const renderProFeature = (text) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>{text}</Typography>
      <Star fontSize="small" sx={{ color: 'var(--warning-color)', fontSize: '0.8rem' }} />
    </Box>
  );

  const fetchJobs = async () => {
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      setError('Unauthorized: Please log in');
      return;
    }
    try {
      const response = await axiosInstance.get("/jobs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobs(response.data);
      setError(''); // Clear any existing errors on successful fetch
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchJobs();
  }, []);

  // Set up polling for auto-updates
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchJobs();
    }, 5000); // Poll every 5 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  // Fetch cluster resources (capacity dashboard)
  useEffect(() => {
    const fetchResources = async () => {
      try {
        const response = await axiosInstance.get('/stats/capacity');
        setResources(response.data);
        setResourcesError('');
      } catch (err) {
        setResources(null);
        setResourcesError(err.response?.data?.detail || err.message || 'Failed to load cluster resources');
      }
    };

    fetchResources();
    const interval = setInterval(fetchResources, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleMenuOpen = (event, job_id) => {
    setAnchorEl(event.currentTarget);
    setSelectedJobId(job_id);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedJobId(null);
  };

  const handleAddJob = () => {
    setOpenAddJob(true);
  };

  const handleAddJobSuccess = () => {
    fetchJobs();
    setOpenAddJob(false);
  };

  const handleModalClose = () => {
    setOpenAddJob(false);
  };

  const approveJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/approve/${job_id}?approved=true`, {}, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
      });
      setJobs(jobs.map(job => job.id === job_id ? { ...job, status: 'ready' } : job));
      handleMenuClose();
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
    }
  };

  const declineJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/approve/${job_id}?approved=false`, {}, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
      });
      setJobs(jobs.map(job => job.id === job_id ? { ...job, status: 'declined' } : job));
      handleMenuClose();
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
    }
  };

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

      // Use fetch for streaming with authorization
      const response = await fetch(`${axiosInstance.defaults.baseURL}/logs/${job_id}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let logContent = '';

      // Start reading the stream
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
        } catch (error) {
          console.error('Stream reading error:', error);
          if (!logContent) {
            setError(error.message || 'Error reading logs. Please try again.');
          }
        } finally {
          reader.releaseLock();
        }
      };

      readStream();
      handleMenuClose();
    } catch (error) {
      setError(error.message || 'Error fetching logs');
    }
  };

  const openPlanFile = async (job_id) => {
    try {
      if (!job_id) {
        setError("No job available.");
        return;
      }
      const response = await axiosInstance.get(`/files/${job_id}`, {
        headers: { 
          Authorization: `Bearer ${sessionStorage.getItem('access_token')}`,
          'Accept': 'application/xml'
        },
        params: { type: "plan" },
        responseType: 'blob',
      });
      
      const blob = new Blob([response.data], { type: 'application/xml' });
      const fileURL = window.URL.createObjectURL(blob);
      window.open(fileURL, "_blank");
    } catch (error) {
      const errorDetail = error.response?.data instanceof Blob ? 
        await error.response.data.text() : 
        error.response?.data?.detail || error.message;
      setError(errorDetail);
    }
  };

  const downloadResult = async (job_id) => {
    try {
      if (!job_id) {
        setError("No job available.");
        return;
      }
      const response = await axiosInstance.get(`/files/${job_id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
        params: { type: "result" },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/plain' });
      const fileURL = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = fileURL;
      link.download = `kubeblast_${jobs.find(job => job.id === job_id)?.name}.jtl`;
      link.click();
      handleMenuClose();
    } catch (error) {
      const errorDetail = error.response?.data instanceof Blob ? 
        await error.response.data.text() : 
        error.response?.data?.detail || error.message;
      setError(errorDetail);
    }
  };

  const deleteJob = async (job_id) => {
    try {
      await axiosInstance.delete(`/jobs/${job_id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
      });
      setJobs(jobs.filter(job => job.id !== job_id));
      handleMenuClose();
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
    }
  };

  const rescheduleJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/retry/${job_id}`, {}, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
      });
      setJobs(jobs.map(job => job.id === job_id ? { ...job, status: 'retrying' } : job));
      handleMenuClose();
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
    }
  };

  const startJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/start/${job_id}`, {}, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
      });
      setJobs(jobs.map(job => job.id === job_id ? { ...job, status: 'running' } : job));
      handleMenuClose();
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
    }
  };

  const stopJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/stop/${job_id}`, {}, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
      });
      setJobs(jobs.map(job => job.id === job_id ? { ...job, status: 'stopping' } : job));
      handleMenuClose();
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
    }
  };

  const handleDetailsClick = (job) => {
    setSelectedJobDetails(job);
    setOpenDetails(true);
    handleMenuClose();
  };

  const getStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      // Neutral/gray
      case 'pending':
        return { bg: '#E5E7EB', text: '#111827', border: '#9CA3AF' }; // gray-200 bg, gray-900 text
      case 'starting':
        return { bg: '#E5E7EB', text: '#111827', border: '#9CA3AF' };
      case 'stopping':
        return { bg: '#E5E7EB', text: '#111827', border: '#9CA3AF' };
      case 'retrying':
        return { bg: '#E5E7EB', text: '#111827', border: '#9CA3AF' };

      // Positive
      case 'completed':
        return { bg: '#BBF7D0', text: '#047857', border: '#86EFAC' }; // lighter green

      // Progress
      case 'running':
        return { bg: '#BFDBFE', text: '#1E40AF', border: '#93C5FD' }; // lighter blue

      // Attention
      case 'ready':
        return { bg: '#FDE68A', text: '#92400E', border: '#F59E0B' }; // amber-300 bg, amber-800 text

      // Negative
      case 'failed':
        return { bg: '#FCA5A5', text: '#7F1D1D', border: '#EF4444' }; // red-300 bg, red-800 text
      case 'declined':
        return { bg: '#FCA5A5', text: '#7F1D1D', border: '#EF4444' };

      default:
        return { bg: '#E5E7EB', text: '#111827', border: '#9CA3AF' };
    }
  };

  const rows = useMemo(() => jobs.map((job) => {
    return {
      id: job.id,
      job_name: job.name,
      owner: job.owner,
      description: job.description || '',
      status: job.status,
      created_at: job.created_at
    };
  }), [jobs]);

  // Ensure unsupported sort values fall back to newest
  useEffect(() => {
    if (sortBy !== 'created_desc' && sortBy !== 'created_asc') {
      setSortBy('created_desc');
    }
  }, [sortBy]);

  const visibleRows = useMemo(() => {
    const text = (searchText || '').toLowerCase().trim();
    let result = rows.filter((row) => {
      const matchesText = !text || [
        row.job_name || '',
        row.description || '',
        row.owner || '',
        String(row.id || '')
      ].some((v) => String(v).toLowerCase().includes(text));
      const matchesStatus = statusFilter === 'all' || (row.status || '').toLowerCase() === statusFilter;
      return matchesText && matchesStatus;
    });
    const by = sortBy;
    result.sort((a, b) => {
      switch (by) {
        case 'created_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'created_desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'name_asc':
          return String(a.job_name || '').localeCompare(String(b.job_name || ''));
        case 'name_desc':
          return String(b.job_name || '').localeCompare(String(a.job_name || ''));
        case 'status_asc':
          return String(a.status || '').localeCompare(String(b.status || ''));
        case 'status_desc':
          return String(b.status || '').localeCompare(String(a.status || ''));
        default:
          return 0;
      }
    });
    return result;
  }, [rows, searchText, statusFilter, sortBy]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatCores = (millicores) => {
    if (!millicores && millicores !== 0) return '';
    return (millicores / 1000).toFixed(1);
  };

  const formatGiB = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    const gib = bytes / (1024 ** 3);
    return gib >= 10 ? gib.toFixed(0) : gib.toFixed(1);
  };


  const EmptyState = () => (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      py: 10,
      px: 3,
      textAlign: 'center',
      gap: 1.5,
    }}>
      <ListAlt sx={{ 
        fontSize: 72,
        color: 'var(--text-secondary)',
        opacity: 0.4
      }} />
      <Typography variant="h6" sx={{ 
        color: 'var(--text-primary)',
        fontWeight: 700
      }}>
        No jobs yet
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--text-secondary)', maxWidth: 520 }}>
        Create a job to start a test run. Once a job is created, you'll see its status, logs, and results here.
      </Typography>
    </Box>
  );

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
          Jobs
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifySelf: 'end' }}>
          <Menuselect />
        </Box>
      </Box>

      <Box className="page-container fade-in">
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
          {(userRole === 'admin' || userRole === 'user') && (
            <Button
              variant="contained"
              onClick={handleAddJob}
              startIcon={<Add />}
              sx={{
                backgroundColor: 'var(--primary-color)',
                '&:hover': { backgroundColor: 'var(--primary-dark)' },
                borderRadius: '8px',
                textTransform: 'none',
                px: 3
              }}
            >
              Add
            </Button>
          )}
        </Box>

        {/* Filters & sorting */}
        <Box
          sx={{
            mb: 2,
            backgroundColor: 'background.paper',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)',
            p: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 2,
            alignItems: 'center'
          }}
        >
          <TextField
            size="small"
            label="Search"
            placeholder="Name, description, owner"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            variant="outlined"
          />
          <FormControl size="small">
            <InputLabel id="jobs-status-label">Status</InputLabel>
            <Select
              labelId="jobs-status-label"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="running">Running</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel id="jobs-sort-label">Sort by</InputLabel>
            <Select
              labelId="jobs-sort-label"
              label="Sort by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <MenuItem value="created_desc">Newest</MenuItem>
              <MenuItem value="created_asc">Oldest</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Cluster capacity dashboard */}
        <Box
          sx={{
            mb: 3,
            backgroundColor: 'background.paper',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)',
            p: 2,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'var(--text-primary)', mb: 1 }}>
            Capacity
          </Typography>

          {!resources && !resourcesError && (
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
              Loading capacity stats...
            </Typography>
          )}

          {resourcesError && (
            <Typography variant="body2" sx={{ color: 'var(--danger-color)' }}>
              {resourcesError}
            </Typography>
          )}

          {resources && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2 }}>
              {(typeof resources.userJobsTotal === 'number' && typeof resources.perUserCurrentJobsLimit === 'number') && (
                <Tooltip title="Your jobs vs allowed concurrent limit" arrow>
                  <Box sx={{ p: 1.5, border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>Jobs</Typography>
                    <Typography variant="h6" sx={{ m: 0 }}>
                      {resources.userJobsTotal}/{resources.perUserCurrentJobsLimit}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                      {resources.perUserCurrentJobsLimit === 0 ? 'No limit' : 'Current / Limit'}
                    </Typography>
                  </Box>
                </Tooltip>
              )}

              <Tooltip title="Usable nodes (matching selector/tolerations) vs total cluster nodes" arrow>
                <Box sx={{ p: 1.5, border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>Nodes</Typography>
                  <Typography variant="h6" sx={{ m: 0 }}>
                    {(resources.nodesMatching ?? resources.nodesTotal ?? 0)}/{resources.nodesTotal ?? 0}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>Selected / Total</Typography>
                </Box>
              </Tooltip>

              {resources.jobResources && (
                <Tooltip title="Default resource requests/limits applied to each job" arrow>
                  <Box sx={{ p: 1.5, border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                    <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>Per-job resources</Typography>
                    <Box sx={{ mt: 0.5 }}>
                      {(() => {
                        const jr = resources.jobResources || {};
                        const cpuReq = jr.requests?.cpu !== undefined
                          ? String(jr.requests.cpu)
                          : (jr.requests?.cpu_m !== undefined ? `${formatCores(jr.requests.cpu_m)} cores` : undefined);
                        const cpuLim = jr.limits?.cpu !== undefined
                          ? String(jr.limits.cpu)
                          : (jr.limits?.cpu_m !== undefined ? `${formatCores(jr.limits.cpu_m)} cores` : undefined);
                        const memReq = jr.requests?.memory !== undefined
                          ? String(jr.requests.memory)
                          : (jr.requests?.memory_bytes !== undefined ? `${formatGiB(jr.requests.memory_bytes)} GiB` : undefined);
                        const memLim = jr.limits?.memory !== undefined
                          ? String(jr.limits.memory)
                          : (jr.limits?.memory_bytes !== undefined ? `${formatGiB(jr.limits.memory_bytes)} GiB` : undefined);

                        const cpuLine = `${cpuReq ?? '-'} / ${cpuLim ?? '-'}`;
                        const memLine = `${memReq ?? '-'} / ${memLim ?? '-'}`;

                        return (
                          <>
                            <Typography variant="body2" sx={{ m: 0, color: 'var(--text-primary)' }}>
                              <span style={{ fontWeight: 700 }}>CPU</span> {cpuLine}
                            </Typography>
                            <Typography variant="body2" sx={{ m: 0, color: 'var(--text-primary)' }}>
                              <span style={{ fontWeight: 700 }}>Memory</span> {memLine}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                              Requests / Limit
                            </Typography>
                          </>
                        );
                      })()}
                    </Box>
                  </Box>
                </Tooltip>
              )}

              <Tooltip title="Available vs total CPU across selected nodes" arrow>
                <Box sx={{ p: 1.5, border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>CPU</Typography>
                  <Typography variant="h6" sx={{ m: 0 }}>
                    {`${formatCores(resources.allocatable?.cpu_m || 0)}/${formatCores(resources.capacity?.cpu_m || 0)} cores`}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>Available / Total</Typography>
                </Box>
              </Tooltip>

              <Tooltip title="Available vs total memory across selected nodes" arrow>
                <Box sx={{ p: 1.5, border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>Memory</Typography>
                  <Typography variant="h6" sx={{ m: 0 }}>
                    {`${formatGiB(resources.allocatable?.memory_bytes || 0)}/${formatGiB(resources.capacity?.memory_bytes || 0)} GiB`}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>Available / Total</Typography>
                </Box>
              </Tooltip>
            </Box>
          )}
        </Box>

        <ErrorMessage message={error} />

        {jobs.length === 0 ? (
          <EmptyState />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 2,
            }}
          >
            {visibleRows.map((job) => {
              const statusColors = getStatusColor(job.status);
              return (
                <Box
                  key={job.id}
                  sx={{
                    backgroundColor: 'background.paper',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06)',
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {job.job_name}
                    </Typography>
                    <IconButton onClick={(e) => handleMenuOpen(e, job.id)} size="small">
                      <MoreVert />
                    </IconButton>
                    <Menu
                      anchorEl={anchorEl}
                      open={Boolean(anchorEl) && selectedJobId === job.id}
                      onClose={handleMenuClose}
                    >
                      {job.status === 'pending' && (userRole === 'admin' || userRole === 'moderator') && isPro && (
                        <>
                          <MenuItem onClick={() => approveJob(job.id)}>
                            <CheckCircle sx={{ mr: 1 }} /> Approve
                          </MenuItem>
                          <MenuItem onClick={() => declineJob(job.id)}>
                            <Cancel sx={{ mr: 1 }} /> Decline
                          </MenuItem>
                        </>
                      )}
                      {job.status === 'ready' && (
                        <MenuItem onClick={() => startJob(job.id)}>
                          <PlayArrow sx={{ mr: 1 }} /> Start
                        </MenuItem>
                      )}
                      {job.status === 'running' && (userRole === 'admin' || userRole === 'user') && (
                        <MenuItem onClick={() => stopJob(job.id)}>
                          <Stop sx={{ mr: 1 }} /> Stop
                        </MenuItem>
                      )}
                      <MenuItem onClick={() => handleDetailsClick(job)}>
                        <ListAlt sx={{ mr: 1 }} /> Details
                      </MenuItem>
                      {(job.status === 'running' || job.status === 'completed' || job.status === 'failed') && (
                        <MenuItem onClick={() => viewLogs(job.id, job.status)}>
                          <Visibility sx={{ mr: 1 }} /> Logs
                        </MenuItem>
                      )}
                      <MenuItem onClick={() => openPlanFile(job.id)}>
                        <Description sx={{ mr: 1 }} /> Plan
                      </MenuItem>
                      {(job.status === 'failed' || job.status === 'completed') && (userRole === 'admin' || userRole === 'user') && (
                        <MenuItem onClick={() => rescheduleJob(job.id)}>
                          <Autorenew sx={{ mr: 1 }} /> Retry
                        </MenuItem>
                      )}
                      {job.status === 'completed' && (
                        <>
                          <MenuItem onClick={() => downloadResult(job.id)}>
                            <Download sx={{ mr: 1 }} /> Result
                          </MenuItem>
                          <MenuItem onClick={() => openReport(job.id)}>
                            <Dashboard sx={{ mr: 1 }} /> Report
                          </MenuItem>
                        </>
                      )}
                      <MenuItem onClick={() => deleteJob(job.id)}>
                        <Delete sx={{ mr: 1 }} /> Delete
                      </MenuItem>
                    </Menu>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{
                      backgroundColor: statusColors.bg,
                      color: statusColors.text,
                      borderRadius: '6px',
                      px: 1.5,
                      py: 0.5,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      width: 'fit-content',
                    }}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </Box>
                    {(userRole === 'admin' || userRole === 'moderator') && isPro && job.owner && (
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                        • {job.owner}
                      </Typography>
                    )}
                  </Box>

                  {job.description && (
                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                      {job.description}
                    </Typography>
                  )}

                  <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                    Created: {formatDate(job.created_at)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}

        <Modal
          open={Boolean(logs)}
          onClose={() => setLogs(null)}
          aria-labelledby="logs-modal"
        >
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '80%',
            maxWidth: 800,
            maxHeight: '80vh',
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 2,
            overflow: 'auto'
          }}>
            <Typography variant="h6" component="h2" sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Logs</span>
              <Button 
                onClick={() => setLogs(null)}
                variant="outlined"
                size="small"
              >
                Close
              </Button>
            </Typography>
            <Box sx={{ 
              whiteSpace: 'pre-wrap',
              backgroundColor: 'var(--background-light)',
              padding: '1rem',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              maxHeight: 'calc(80vh - 120px)',
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              lineHeight: 1.5
            }}>
              {logs}
            </Box>
          </Box>
        </Modal>

        <Modal
          open={openDetails}
          onClose={() => setOpenDetails(false)}
          aria-labelledby="job-details-modal"
        >
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '80%',
            maxWidth: 800,
            maxHeight: '80vh',
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 2,
            overflow: 'auto'
          }}>
            <Typography variant="h6" component="h2" sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Details</span>
              <Button 
                onClick={() => setOpenDetails(false)}
                variant="outlined"
                size="small"
              >
                Close
              </Button>
            </Typography>
            {selectedJobDetails && (
              <Box sx={{ 
                whiteSpace: 'pre-wrap',
                backgroundColor: 'var(--background-light)',
                padding: '1rem',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                maxHeight: 'calc(80vh - 120px)',
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                lineHeight: 1.5
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600, padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Job Name</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{selectedJobDetails.job_name}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Status</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{selectedJobDetails.status.charAt(0).toUpperCase() + selectedJobDetails.status.slice(1)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Owner</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{selectedJobDetails.owner}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Description</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{selectedJobDetails.description || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Created At</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{formatDate(selectedJobDetails.created_at)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, padding: '8px', borderBottom: '1px solid var(--border-color)' }}>ID</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', fontFamily: 'monospace' }}>{selectedJobDetails.id}</td>
                    </tr>
                  </tbody>
                </table>
              </Box>
            )}
          </Box>
        </Modal>

        <Modal
          open={openAddJob}
          onClose={handleModalClose}
          aria-labelledby="add-job-modal"
        >
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: 600,
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 2
          }}>
            <AddJob onClose={handleAddJobSuccess} />
          </Box>
        </Modal>
      </Box>
    </Box>
  );
};

export default Jobs;
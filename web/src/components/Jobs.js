import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, IconButton, Menu, MenuItem, Modal, Button } from '@mui/material';
import { Delete, MoreVert, CheckCircle, Cancel, Visibility, Description, Autorenew, Download, Add, Star, PlayArrow, ListAlt } from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";
import { DataGrid } from '@mui/x-data-grid';
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
  const userRole = sessionStorage.getItem('user_role');
  const isPro = process.env.REACT_APP_IS_PRO === 'true';
  const proRedirectUrl = process.env.REACT_APP_PRO_REDIRECT_URL || 'https://kubeblast.teymur.pro';

  const handleProFeature = () => {
    window.location.href = proRedirectUrl;
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

  const downloadReport = async (job_id) => {
    try {
      if (!job_id) {
        setError("No job available.");
        return;
      }
      const response = await axiosInstance.get(`/files/${job_id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
        params: { type: "report" },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/zip' });
      const fileURL = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = fileURL;
      link.download = `kubeblast_${jobs.find(job => job.id === job_id)?.name}.zip`;
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

  const columns = useMemo(() => {
    console.log('Current user role:', userRole); // Debug log
    return [
      { 
        field: "status", 
        headerName: "Status",
        headerAlign: 'center',
        width: 100,
        flex: 0.6,
        renderCell: (params) => {
          const getStatusColor = (status) => {
            switch (status.toLowerCase()) {
              case 'pending':
                return { bg: '#FFF7ED', text: '#9A3412', border: '#FDBA74' };
              case 'running':
                return { bg: '#EFF6FF', text: '#1E40AF', border: '#93C5FD' };
              case 'completed':
                return { bg: '#F0FDF4', text: '#166534', border: '#86EFAC' };
              case 'failed':
                return { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' };
              case 'declined':
                return { bg: '#F9FAFB', text: '#374151', border: '#D1D5DB' };
              case 'retrying':
                return { bg: '#FFFBEB', text: '#B45309', border: '#FCD34D' };
              default:
                return { bg: '#F9FAFB', text: '#374151', border: '#D1D5DB' };
            }
          };

          const statusColors = getStatusColor(params.value);
          return (
            <Box sx={{
              backgroundColor: statusColors.bg,
              color: statusColors.text,
              border: `1px solid ${statusColors.border}`,
              borderRadius: '6px',
              px: 2,
              py: 1,
              fontSize: '0.875rem',
              fontWeight: 500,
              width: 'fit-content',
              minWidth: '90px',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
            }}>
              {params.value.charAt(0).toUpperCase() + params.value.slice(1)}
            </Box>
          );
        }
      },
      ...(userRole === 'admin' || userRole === 'moderator' ? [
        { field: "id", headerName: "ID", width: 200, flex: 1 }
      ] : []),
      { field: "job_name", headerName: "Job Name", width: 120, flex: 0.8 },
      ...( isPro && (userRole === 'admin' || userRole === 'moderator') ? [
        { field: "owner", headerName: "Owner", width: 150, flex: 1 }
      ] : []),
      { field: "description", headerName: "Description", width: 200, flex: 1.5 },
      {
        field: 'actions',
        headerName: '',
        sortable: false,
        width: 80,
        flex: 0.3,
        renderCell: (params) => {
          const job = params.row;
          return (
            <Box>
              <IconButton
                onClick={(e) => handleMenuOpen(e, job.id)}
                size="small"
              >
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
                  <MenuItem onClick={() => downloadReport(job.id)}>
                    <Download sx={{ mr: 1 }} /> Report
                  </MenuItem>
                )}
                <MenuItem onClick={() => deleteJob(job.id)}>
                  <Delete sx={{ mr: 1 }} /> Delete
                </MenuItem>
              </Menu>
            </Box>
          );
        },
      }
    ];
  }, [anchorEl, selectedJobId, userRole, isPro]);

  const rows = useMemo(() => jobs.map((job) => {
    console.log('Mapping job:', job); // Debug log
    return {
      id: job.id,
      job_name: job.name,
      owner: job.owner,
      description: job.description || '',
      status: job.status,
    };
  }), [jobs]);

  const EmptyState = () => (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      py: 8,
      px: 2,
      textAlign: 'center',
    }}>
      <ListAlt sx={{ 
        fontSize: 64,
        color: 'var(--text-secondary)',
        mb: 2,
        opacity: 0.5
      }} />
      <Typography variant="h6" sx={{ 
        color: 'var(--text-secondary)',
        fontWeight: 600
      }}>
        There's nothing here yet
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'white',
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        px: 3,
        py: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Link to="/jobs" style={{ textDecoration: 'none' }}>
          <Box
            component="img"
            src="/logo.svg"
            alt="KubeBlast"
            sx={{
              height: 48,
              width: 'auto',
              '&:hover': { opacity: 0.8 }
            }}
          />
        </Link>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Menuselect />
        </Box>
      </Box>

      <Box className="page-container fade-in">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            Jobs
          </Typography>
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

        <ErrorMessage message={error} />

        <Box sx={{ 
          height: 'calc(100vh - 280px)',
          width: '100%',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
          overflow: 'hidden',
          '& .MuiDataGrid-root': {
            border: 'none',
            '& .MuiDataGrid-cell': {
              borderBottom: '1px solid var(--border-color)',
              '&:focus': {
                outline: 'none',
              },
            },
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#F8FAFC',
              borderBottom: '2px solid var(--border-color)',
              '& .MuiDataGrid-columnHeader': {
                '&:focus': {
                  outline: 'none',
                },
                '&:focus-within': {
                  outline: 'none',
                },
                '&:not(:last-child)': {
                  borderRight: 'none',
                },
                '& .MuiDataGrid-columnSeparator': {
                  display: 'none',
                },
              },
            },
            '& .MuiDataGrid-row': {
              '&:hover': {
                backgroundColor: '#F8FAFC',
              },
              '&:nth-of-type(even)': {
                backgroundColor: '#FAFAFA',
              },
            },
            '& .MuiDataGrid-overlay': {
              background: 'transparent',
            },
          },
        }}>
          {jobs.length === 0 ? (
            <EmptyState />
          ) : (
            <DataGrid
              rows={rows}
              columns={columns}
              hideFooter
              disableSelectionOnClick
              disableColumnMenu
              autoHeight
              getRowHeight={() => 'auto'}
              sx={{
                '& .MuiDataGrid-cell': {
                  py: 2,
                },
                '& .MuiDataGrid-columnHeader': {
                  py: 2,
                  fontWeight: 600,
                },
              }}
            />
          )}
        </Box>

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
              <span>Job Logs</span>
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
              backgroundColor: '#f8f9fa',
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
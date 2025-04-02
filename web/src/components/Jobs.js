import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, IconButton, Menu, MenuItem, Modal, Button } from '@mui/material';
import { Delete, MoreVert, CheckCircle, Cancel, Visibility, Description, Autorenew, Download, Add, Star } from '@mui/icons-material';
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
      setJobs(jobs.map(job => job.id === job_id ? { ...job, status: 'approved' } : job));
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
      link.download = `${job_id}_report.zip`;
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
      const token = sessionStorage.getItem('access_token');
      if (!token) {
        setError('Unauthorized: Please log in');
        return;
      }
  
      const response = await axiosInstance.put(`/jobs/retry/${job_id}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      setJobs(jobs.map(job => job.id === job_id ? response.data : job));
      handleMenuClose();
      setError('');
      fetchJobs();
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
    }
  };

  const columns = useMemo(() => {
    console.log('Current user role:', userRole); // Debug log
    return [
      { field: "id", headerName: "ID", width: 100, flex: 0.5 },
      { field: "job_name", headerName: "Job Name", width: 180, flex: 1 },
      ...(userRole === 'admin' || userRole === 'moderator' ? [
        { field: "owner", headerName: "Owner", width: 150, flex: 1 }
      ] : []),
      { field: "description", headerName: "Description", width: 250, flex: 2 },
      { 
        field: "status", 
        headerName: "Status", 
        width: 130,
        flex: 0.8,
        renderCell: (params) => {
          const getStatusColor = (status) => {
            switch (status.toLowerCase()) {
              case 'pending':
                return { bg: '#FEF3C7', text: '#92400E' };
              case 'running':
                return { bg: '#DBEAFE', text: '#1E40AF' };
              case 'completed':
                return { bg: '#D1FAE5', text: '#065F46' };
              case 'failed':
                return { bg: '#FEE2E2', text: '#991B1B' };
              case 'declined':
                return { bg: '#F3F4F6', text: '#1F2937' };
              case 'retrying':
                return { bg: '#FEF3C7', text: '#92400E' };
              default:
                return { bg: '#F3F4F6', text: '#1F2937' };
            }
          };

          const statusColors = getStatusColor(params.value);
          return (
            <Box sx={{
              backgroundColor: statusColors.bg,
              color: statusColors.text,
              height: '100%',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              fontWeight: 500,
              '&:hover': {
                backgroundColor: statusColors.bg,
              }
            }}>
              {params.value.charAt(0).toUpperCase() + params.value.slice(1)}
            </Box>
          );
        }
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 120,
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
                {job.status === 'pending' && userRole === 'admin' && isPro && (
                  <>
                    <MenuItem onClick={() => approveJob(job.id)}>
                      <CheckCircle sx={{ mr: 1 }} /> Approve
                    </MenuItem>
                    <MenuItem onClick={() => declineJob(job.id)}>
                      <Cancel sx={{ mr: 1 }} /> Decline
                    </MenuItem>
                  </>
                )}
                {(job.status === 'running' || job.status === 'completed' || job.status === 'failed') && (
                  <MenuItem onClick={() => viewLogs(job.id, job.status)}>
                    <Visibility sx={{ mr: 1 }} /> Logs
                  </MenuItem>
                )}
                <MenuItem onClick={() => openPlanFile(job.id)}>
                  <Description sx={{ mr: 1 }} /> Plan
                </MenuItem>
                {(job.status === 'failed' || job.status === 'completed') && (userRole === 'admin' || userRole === 'moderator') && (
                  <MenuItem onClick={isPro ? () => rescheduleJob(job.id) : handleProFeature}>
                    <Autorenew sx={{ mr: 1 }} />
                    {isPro ? 'Retry' : renderProFeature('Retry')}
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
          height: 'calc(100vh - 280px)', // Adjusted for header
          width: '100%',
          '& .status-cell': {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start'
          }
        }}>
          <DataGrid
            rows={rows}
            columns={columns}
            hideFooter
            disableSelectionOnClick
            sx={{
              '& .MuiDataGrid-cell:focus': {
                outline: 'none'
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: 'var(--background-light)'
              }
            }}
          />
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

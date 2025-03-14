import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, IconButton, Menu, MenuItem, Modal, Button } from '@mui/material';
import { Delete, MoreVert, CheckCircle, Cancel, Visibility, Description, Schedule, Add } from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";
import { DataGrid } from '@mui/x-data-grid';
import Menuselect from "./Menuselect";
import AddJob from "./AddJob";

const Jobs = () => {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState(5);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [logs, setLogs] = useState(null);
  const [openAddJob, setOpenAddJob] = useState(false);
  const userRole = sessionStorage.getItem('user_role');

  useEffect(() => {
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
        console.log('Jobs response:', response.data); // Debug log
        setJobs(response.data);
      } catch (error) {
        setError('Error fetching jobs: ' + (error.response?.data || error.message));
      }
    };
    fetchJobs();
  }, []);

  const handleMenuOpen = (event, job_id) => {
    setAnchorEl(event.currentTarget);
    setSelectedJobId(job_id);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedJobId(null);
  };

  const approveJob = async (job_id) => {
    try {
      await axiosInstance.put(`/jobs/approve/${job_id}?approved=true`, {}, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
      });
      setJobs(jobs.map(job => job.id === job_id ? { ...job, status: 'approved' } : job));
      handleMenuClose();
    } catch (error) {
      setError('Error approving job: ' + (error.response?.data || error.message));
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
      setError('Error declining job: ' + (error.response?.data || error.message));
    }
  };

  const viewLogs = async (job_id, job_status) => {
    if (job_status !== 'running' && job_status !== 'completed' && job_status !== 'failed') {
      setError('Logs are only available for running, completed, or failed jobs.');
      return;
    }
  
    try {
      const response = await axiosInstance.get(`/logs/${job_id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
      });
      // Remove 'data:' prefix from each line
      const cleanedLogs = response.data.replace(/^data:/gm, '').trim();
      setLogs(cleanedLogs);
      handleMenuClose();
    } catch (error) {
      setError('Error fetching logs: ' + (error.response?.data || error.message));
    }
  };

  const openPlanFile = async (job_id) => {
    try {
      if (!job_id) {
        setError("No job available.");
        return;
      }
      const response = await axiosInstance.get(`/files/${job_id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
        params: { type: "plan" },
        responseType: 'blob',
      });
      const fileURL = window.URL.createObjectURL(new Blob([response.data]));
      window.open(fileURL, "_blank");
    } catch (error) {
      setError("Error opening plan file: " + (error.response?.data || error.message));
    }
  };

  const openReport = async (job_id) => {
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
      const fileURL = window.URL.createObjectURL(new Blob([response.data]));
      window.open(fileURL, "_blank");
    } catch (error) {
      setError("Error opening report: " + (error.response?.data || error.message));
    }
  };

  const downloadArtifacts = async (job_id) => {
    try {
      if (!job_id) {
        setError("No job available.");
        return;
      }
      const response = await axiosInstance.get(`/files/${job_id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
        params: { type: "artifacts" },
        responseType: 'blob',
      });
      const fileURL = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = fileURL;
      link.download = `${job_id}_artifacts.zip`;
      link.click();
    } catch (error) {
      setError("Error downloading artifacts: " + (error.response?.data || error.message));
    }
  };

  const deleteJob = async (job_id) => {
    try {
      await axiosInstance.delete(`/jobs/${job_id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
      });
      setJobs(jobs.filter(job => job.id !== job_id));
    } catch (error) {
      setError('Error deleting job: ' + (error.response?.data || error.message));
    }
  };
  const rescheduleJob = async (job_id) => {
    try {
      const token = sessionStorage.getItem('access_token');
      if (!token) {
        setError('Unauthorized: Please log in');
        return;
      }
  

      const response = await axiosInstance.put(`/jobs/reschedule/${job_id}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      setJobs(jobs.map(job => job.id === job_id ? response.data : job));

      setError('');
    } catch (error) {
      setError('Error rescheduling job: ' + (error.response?.data || error.message));
    }
  };

  const handleAddJob = () => {
    setOpenAddJob(true);
  };

  const handleClose = () => {
    setOpenAddJob(false);
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
        field: "actions",
        headerName: "Actions",
        width: 100,
        flex: 0.5,
        renderCell: (params) => (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton 
              onClick={(event) => handleMenuOpen(event, params.row.id)}
              sx={{ 
                '&:hover': { 
                  backgroundColor: 'var(--background-light)',
                  color: 'var(--primary-color)'
                }
              }}
            >
              <MoreVert />
            </IconButton>
          </Box>
        )
      }
    ];
  }, [userRole]);

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
          <Typography 
            variant="h5" 
            sx={{ 
              fontWeight: 600, 
              color: 'var(--primary-color)',
              '&:hover': { color: 'var(--primary-dark)' }
            }}
          >
            JRunner
          </Typography>
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
        </Box>

        {error && (
          <Box sx={{ mb: 3 }}>
            <Typography 
              color="error" 
              sx={{ 
                p: 2, 
                bgcolor: '#FEE2E2', 
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <Cancel fontSize="small" />
              {error}
            </Typography>
          </Box>
        )}

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

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          PaperProps={{
            sx: {
              mt: 1,
              '& .MuiMenuItem-root': {
                py: 1,
                gap: 1
              }
            }
          }}
        >
          {(userRole === 'admin' || userRole === 'moderator') && jobs.find(j => j.id === selectedJobId)?.status === 'pending' && (
            <>
              <MenuItem 
                onClick={() => approveJob(selectedJobId)}
                sx={{ color: 'var(--success-color)' }}
              >
                <CheckCircle fontSize="small" />
                Approve
              </MenuItem>
              <MenuItem 
                onClick={() => declineJob(selectedJobId)}
                sx={{ color: 'var(--danger-color)' }}
              >
                <Cancel fontSize="small" />
                Decline
              </MenuItem>
            </>
          )}
          <MenuItem onClick={() => viewLogs(selectedJobId, jobs.find(j => j.id === selectedJobId)?.status)}>
            <Visibility fontSize="small" />
            View Logs
          </MenuItem>
          <MenuItem onClick={() => openPlanFile(selectedJobId)}>
            <Description fontSize="small" />
            Open Plan File
          </MenuItem>
          {jobs.find(j => j.id === selectedJobId)?.status === 'completed' && (
            <MenuItem onClick={() => openReport(selectedJobId)}>
              <Description fontSize="small" />
              Open Report
            </MenuItem>
          )}
          {jobs.find(j => j.id === selectedJobId)?.status === 'completed' && (
            <MenuItem onClick={() => downloadArtifacts(selectedJobId)}>
              <Description fontSize="small" />
              Download Artifacts
            </MenuItem>
          )}
          <MenuItem onClick={() => rescheduleJob(selectedJobId)}>
            <Schedule fontSize="small" />
            Reschedule
          </MenuItem>
          <MenuItem 
            onClick={() => deleteJob(selectedJobId)}
            sx={{ color: 'var(--danger-color)' }}
          >
            <Delete fontSize="small" />
            Delete Job
          </MenuItem>
        </Menu>

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
          onClose={handleClose}
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
            <AddJob onClose={handleClose} />
          </Box>
        </Modal>
      </Box>
    </Box>
  );
};

export default Jobs;

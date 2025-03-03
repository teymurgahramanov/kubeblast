import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, IconButton, Menu, MenuItem, Modal, Button } from '@mui/material';
import { Delete, MoreVert, CheckCircle, Cancel, Visibility, Description, Schedule } from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";
import { DataGrid } from '@mui/x-data-grid';
import Menuselect from "./Menuselect";
import AddJob from "./AddJob";
import generatePDF from "./generatePDF";

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
      await axiosInstance.get(`/jobs/approve/${job_id}`, {
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
      await axiosInstance.get(`/jobs/decline/${job_id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
      });
      setJobs(jobs.map(job => job.id === job_id ? { ...job, status: 'declined' } : job));
      handleMenuClose();
    } catch (error) {
      setError('Error declining job: ' + (error.response?.data || error.message));
    }
  };

  const viewLogs = async (job_id) => {
    try {
      const response = await axiosInstance.get(`/logs/${job_id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
      });
      setLogs(response.data);
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
      const fileType = "plan";
      const shouldDownload = true;
      const response = await axiosInstance.get(`/files/${job_id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
        params: { type: fileType, download: shouldDownload },
        responseType: 'blob',
      });
      const fileURL = window.URL.createObjectURL(new Blob([response.data]));
      window.open(fileURL, "_blank");
    } catch (error) {
      setError("Error opening file: " + (error.response?.data || error.message));
    }
  };

  const DownloadFile = async (job_id) => {
    try {
      if (!job_id) {
        setError("No job available.");
        return;
      }
      const fileType = "plan";
      const shouldDownload = true;
      const response = await axiosInstance.get(`/files/${job_id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
        params: { type: fileType, download: shouldDownload },
        responseType: 'blob',
      });
      const fileURL = window.URL.createObjectURL(new Blob([response.data]));
      if (shouldDownload) {
        const link = document.createElement("a");
        link.href = fileURL;
        link.download = `${job_id}_${fileType}.pdf`;
        link.click();
      } else {
        window.open(fileURL, "_blank");
      }
    } catch (error) {
      setError("Error opening or downloading file: " + (error.response?.data || error.message));
    }
  };

  const DownloadReport = async (job_id) => {
    try {
      if (!job_id) {
        setError("No job available.");
        return;
      }
      const fileType = "report";
      const shouldDownload = true;
      const response = await axiosInstance.get(`/files/${job_id}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('access_token')}` },
        params: { type: fileType, download: shouldDownload },
        responseType: 'blob',
      });
      const fileURL = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = fileURL;
      link.download = `${job_id}_${fileType}.pdf`;
      link.click();
    } catch (error) {
      setError("Error downloading report file: " + (error.response?.data || error.message));
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

  const columns = useMemo(() => [
    { field: "id", headerName: "ID", width: 120 },
    { field: "job_name", headerName: "Job Name", width: 200 },
    { field: "owner", headerName: "Owner", width: 200 },
    { field: "description", headerName: "Description", width: 250 },
    { field: "status", headerName: "Status", width: 150 },
    {
      field: "actions",
      headerName: "Actions",
      width: 200,
      renderCell: (params) => (
        <>
          <IconButton onClick={(event) => handleMenuOpen(event, params.row.id)}>
            <MoreVert />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl) && selectedJobId === params.row.id}
            onClose={handleMenuClose}
          >
            {(userRole === 'admin' || userRole === 'moderator') && params.row.status === 'pending' && (
              <>
                <MenuItem onClick={() => approveJob(params.row.id)}>
                  <CheckCircle fontSize="small" /> Approve
                </MenuItem>
                <MenuItem onClick={() => declineJob(params.row.id)}>
                  <Cancel fontSize="small" /> Decline
                </MenuItem>
              </>
            )}
            <MenuItem onClick={() => viewLogs(params.row.id)}>
              <Visibility fontSize="small" /> View Logs
            </MenuItem>
            <MenuItem onClick={() => openPlanFile(params.row.id)}>
              <Description fontSize="small" /> Open Plan File
            </MenuItem>
            <MenuItem onClick={() => DownloadFile(params.row.id)}>
              <Description fontSize="small" /> Download File
            </MenuItem>
            {params.row.status === 'completed' && (
              <MenuItem onClick={() => DownloadReport(params.row.id)}>
                <Description fontSize="small" /> Download Report
              </MenuItem>
            )} 
            <MenuItem onClick={() => rescheduleJob(params.row.id)}>
            <Schedule fontSize="small" />
          </MenuItem>
            
            <MenuItem onClick={() => deleteJob(params.row.id)}>
              <Delete fontSize="small" /> Delete Job
            </MenuItem>
          </Menu>
        </>
      ),
    },
  ], [anchorEl, selectedJobId, jobs, userRole]);

  const rows = useMemo(() => jobs.map((job) => ({
    id: job.id,
    job_name: job.name,
    owner: job.owner,
    description: job.description,
    status: job.status,
  })), [jobs]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#14213D", padding: "20px" }}>
      <div className="container">
        <Menuselect />
        <Typography variant="h3" align="center" color="white">Jobs</Typography>
        {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
        <Box sx={{ height: 400, width: "100%" }}>
          <DataGrid
            sx={{ border: "1px solid", m: 2, boxShadow: 5, backgroundColor: "white" }}
            columns={columns}
            rows={rows}
            rowsPerPageOptions={[5, 10, 20]}
            pageSize={pageSize}
            onPageSizeChange={(newPageSize) => setPageSize(newPageSize)}
          />
        </Box>
        <Box textAlign="center" mt={2}>
          <Link style={{ color: "#fff", fontSize: "18px" }} onClick={(e) => { e.preventDefault(); handleAddJob(); }}>
            Add New Job
          </Link>
        </Box>
        <Box textAlign="center" mt={2}>
          <Button variant="contained" onClick={() => generatePDF(jobs)}>
            Generate PDF Report
          </Button>
        </Box>
      </div>

      <Modal open={openAddJob} onClose={handleClose}>
        <div>
          <AddJob onAddJob={handleClose} />
        </div>
      </Modal>

      {logs && (
        <div>
          <Typography variant="h6" color="white">Job Logs</Typography>
          <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', color: 'white' }}>
            {JSON.stringify(logs, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default Jobs;

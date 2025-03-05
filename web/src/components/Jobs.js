import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, IconButton, Menu, MenuItem, Modal, Button } from '@mui/material';
import { Delete, MoreVert, CheckCircle, Cancel, Visibility, Description, Schedule } from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";
import { DataGrid } from '@mui/x-data-grid';
import Menuselect from "./Menuselect";
import AddJob from "./AddJob";
import generatePDF from './generatePDF';
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

  const viewLogs = async (job_id, job_status) => {
    if (job_status !== 'running' && job_status !== 'completed') {
      setError('Logs are only available for running or completed jobs.');
      return;
    }
  
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

  const DownloadReport = async (job_id, job_status) => {
    try {
      if (job_status !== 'completed') {
        setError("Report is only available for completed jobs.");
        return;
      }
      if (!job_id) {
        setError("No job available.");
        return;
      }

      const job = jobs.find(job => job.id === job_id);
      if (!job) {
        setError("Job not found.");
        return;
      }
  

      const pdfBlob = await generatePDF(job); 
  

      const fileURL = window.URL.createObjectURL(pdfBlob);
  

      const link = document.createElement("a");
      link.href = fileURL;
      link.download = `${job_id}_report.pdf`;
      link.click();
    } catch (error) {
      setError("Error generating or downloading report: " + (error.response?.data || error.message));
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
    { field: "id", headerName: "ID", width: 150 },
    { field: "job_name", headerName: "Job Name", width: 150 },
    { field: "owner", headerName: "Owner", width: 150 },
    { field: "description", headerName: "Description", width: 250 },
    { field: "status", headerName: "Status", width: 100 },
    {
      field: "actions",
      headerName: "Actions",
      width: 100,
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
           <MenuItem onClick={() => viewLogs(params.row.id, params.row.status)}>
  <Visibility fontSize="small" /> View Logs
</MenuItem>
            <MenuItem onClick={() => openPlanFile(params.row.id)}>
              <Description fontSize="small" /> Open Plan File
            </MenuItem>
            <MenuItem onClick={() => DownloadFile(params.row.id)}>
              <Description fontSize="small" /> Download File
            </MenuItem>

            <MenuItem onClick={() => DownloadReport(params.row.id)}>
             <Description fontSize="small" /> Download Report
           </MenuItem>

            <MenuItem onClick={() => rescheduleJob(params.row.id)}>
              <Schedule fontSize="small" /> Reschedule
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
    <div style={{ minHeight: "100vh", backgroundColor: "#0D0630", padding: "20px" }}>
      <div className="container">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Menuselect style={{ backgroundColor: "#E6F9AF", padding: "10px", borderRadius: "5px" }} />
          <Button variant="contained" color="primary" onClick={ handleAddJob}>
            Add New Job
          </Button>
        </Box>
        <Typography variant="h3" align="center" color="white">Jobs</Typography>
        {error && <div style={{ color: 'red', textAlign: 'center' }}>{error}</div>}
        <Box sx={{ height: 400, width:970}}>
          <DataGrid
                 sx={{
                  border: "1px solid", 
                  m: 2, 
                  boxShadow: 5, 
                  backgroundColor: "white",
                  '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: "#18314F", color: "white" },
                  '& .MuiDataGrid-row:nth-of-type(odd)': { backgroundColor: "#384E77", color: "white" },
                }}columns={columns}
            rows={rows}
            pageSize={pageSize}
            onPageSizeChange={(newPageSize) => setPageSize(newPageSize)}
          />
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

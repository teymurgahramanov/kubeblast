import React, { useState } from 'react';
import { Box, Typography, TextField, Button, IconButton } from '@mui/material';
import { Close } from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";

const AddJob = ({ onClose }) => {
  const [jobData, setJobData] = useState({
    description: '',
    file: null
  });
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setJobData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    setJobData(prev => ({
      ...prev,
      file: e.target.files[0]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('description', jobData.description);
    formData.append('file', jobData.file);

    try {
      await axiosInstance.post('/jobs', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${sessionStorage.getItem('access_token')}`
        }
      });
      onClose();
    } catch (error) {
      setError('Error creating job: ' + (error.response?.data || error.message));
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 3
      }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          Add Job
        </Typography>
        <IconButton 
          onClick={onClose}
          sx={{ 
            color: 'var(--text-secondary)',
            '&:hover': { color: 'var(--text-primary)' }
          }}
        >
          <Close />
        </IconButton>
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
            {error}
          </Typography>
        </Box>
      )}

      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            fullWidth
            label="Description (Optional)"
            name="description"
            value={jobData.description}
            onChange={handleInputChange}
            multiline
            rows={4}
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                '&:hover fieldset': {
                  borderColor: 'var(--primary-color)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'var(--primary-color)',
                },
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: 'var(--primary-color)',
              },
            }}
          />

          <Box sx={{ 
            border: '2px dashed var(--border-color)',
            borderRadius: 1,
            p: 3,
            textAlign: 'center',
            cursor: 'pointer',
            '&:hover': {
              borderColor: 'var(--primary-color)',
            }
          }}>
            <input
              type="file"
              required
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="job-file-input"
              accept=".jmx"
            />
            <label htmlFor="job-file-input" style={{ cursor: 'pointer' }}>
              <Typography color="var(--text-secondary)">
                {jobData.file ? jobData.file.name : 'Click to upload JMX file'}
              </Typography>
            </label>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
            <Button
              onClick={onClose}
              variant="outlined"
              sx={{
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-color)',
                '&:hover': {
                  borderColor: 'var(--text-primary)',
                  backgroundColor: 'transparent'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              sx={{
                backgroundColor: 'var(--primary-color)',
                '&:hover': { backgroundColor: 'var(--primary-dark)' },
                textTransform: 'none'
              }}
            >
              Create
            </Button>
          </Box>
        </Box>
      </form>
    </Box>
  );
};

export default AddJob;

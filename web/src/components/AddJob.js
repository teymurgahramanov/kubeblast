import React, { useState } from 'react';
import { Box, Typography, TextField, Button, IconButton, FormControlLabel, Checkbox } from '@mui/material';
import { Close, Star } from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";
import ErrorMessage from './ErrorMessage';

const AddJob = ({ onClose }) => {
  const [jobData, setJobData] = useState({
    description: '',
    file: null,
    distributed: false
  });
  const [error, setError] = useState('');
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
    formData.append('distributed', jobData.distributed);

    try {
      await axiosInstance.post('/jobs', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${sessionStorage.getItem('access_token')}`
        }
      });
      onClose();
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
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

      <ErrorMessage message={error} />

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

          <FormControlLabel
            control={
              <Checkbox
                checked={jobData.distributed}
                onChange={isPro ? (e) => setJobData(prev => ({
                  ...prev,
                  distributed: e.target.checked
                })) : handleProFeature}
                sx={{
                  color: 'var(--text-secondary)',
                  '&.Mui-checked': {
                    color: 'var(--primary-color)',
                  },
                }}
              />
            }
            label={isPro ? "Distributed" : renderProFeature("Distributed")}
            sx={{
              color: 'var(--text-secondary)',
              '& .MuiTypography-root': {
                color: 'var(--text-secondary)',
              },
            }}
          />

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
              Add
            </Button>
          </Box>
        </Box>
      </form>
    </Box>
  );
};

export default AddJob;

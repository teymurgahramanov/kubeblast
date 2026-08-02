import { useRef, useState } from 'react';
import { Box, Typography, TextField, Button, IconButton } from '@mui/material';
import { Close, CloudUpload } from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";
import ErrorMessage from './ErrorMessage';

const AddJob = ({ onClose }) => {
  const [jobData, setJobData] = useState({
    description: '',
    file: null
  });
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragDepth = useRef(0);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setJobData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const selectFile = (file) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.jmx')) {
      setJobData(prev => ({ ...prev, file: null }));
      setFileError('Please select a JMX file.');
      return;
    }

    setJobData(prev => ({ ...prev, file }));
    setFileError('');
  };

  const handleFileChange = (e) => {
    selectFile(e.target.files[0]);
    e.target.value = '';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;

    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    selectFile(e.dataTransfer.files[0]);
  };

  const handleUploadKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!jobData.file) {
      setFileError('Please select a JMX file.');
      return;
    }

    const formData = new FormData();
    formData.append('description', jobData.description);
    formData.append('file', jobData.file);

    try {
      await axiosInstance.post('/jobs', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`
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
            slotProps={{ htmlInput: { maxLength: 20 } }}
            helperText={`${jobData.description.length}/20 characters`}
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

          <Box>
            <Box
              role="button"
              tabIndex={0}
              aria-label="Upload JMX file"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={handleUploadKeyDown}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              sx={{
                border: '2px dashed',
                borderColor: isDragging ? 'var(--primary-color)' : 'var(--border-color)',
                borderRadius: 1,
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: isDragging ? 'action.hover' : 'transparent',
                transition: 'border-color 0.2s ease, background-color 0.2s ease',
                '&:hover, &:focus-visible': {
                  borderColor: 'var(--primary-color)',
                },
                '&:focus-visible': {
                  outline: '2px solid var(--primary-color)',
                  outlineOffset: 2,
                },
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="job-file-input"
                accept=".jmx"
              />
              <CloudUpload
                sx={{
                  mb: 1,
                  fontSize: 40,
                  color: isDragging ? 'var(--primary-color)' : 'var(--text-secondary)',
                }}
              />
              <Typography sx={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {jobData.file ? jobData.file.name : isDragging ? 'Drop JMX file here' : 'Drag and drop a JMX file here'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
                {jobData.file ? 'Drop or click to replace' : 'or click to browse'}
              </Typography>
            </Box>
            {fileError && (
              <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 1 }}>
                {fileError}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
            <Button
              onClick={onClose}
              variant="outlined"
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                px: 2.2,
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              sx={{
                background: 'linear-gradient(135deg, #326CE5 0%, #1e40af 100%)',
                boxShadow: 'none',
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                px: 2.2,
                '&:hover': { background: 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)' },
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

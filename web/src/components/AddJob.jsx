import { useRef, useState } from 'react';
import { Box, Typography, TextField, Button, IconButton, Chip } from '@mui/material';
import { Close, CloudUpload } from '@mui/icons-material';
import axiosInstance from "../utils/axiosInstance";
import ErrorMessage from './ErrorMessage';

const MAX_JMX_SIZE = 900 * 1024;
const MAX_PARAMETER_FILES = 20;
const MAX_PARAMETER_FILES_SIZE = 100 * 1024 * 1024;

const AddJob = ({ onClose }) => {
  const [jobData, setJobData] = useState({
    description: '',
    file: null,
    parameterFiles: []
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

  const selectFiles = (selectedFiles) => {
    const files = Array.from(selectedFiles || []);
    if (!files.length) return;

    const unsupported = files.find(file => !/\.(jmx|csv)$/i.test(file.name));
    if (unsupported) {
      setFileError(`Unsupported file: ${unsupported.name}. Select JMX and CSV files only.`);
      return;
    }

    const plans = files.filter(file => file.name.toLowerCase().endsWith('.jmx'));
    if (plans.length > 1) {
      setFileError('Please select only one JMX file.');
      return;
    }
    if (plans[0]?.size > MAX_JMX_SIZE) {
      setFileError('The JMX plan cannot exceed 900 KB.');
      return;
    }

    const csvByName = new Map(jobData.parameterFiles.map(file => [file.name, file]));
    files
      .filter(file => file.name.toLowerCase().endsWith('.csv'))
      .forEach(file => csvByName.set(file.name, file));
    const nextParameterFiles = Array.from(csvByName.values());
    if (nextParameterFiles.length > MAX_PARAMETER_FILES) {
      setFileError(`A maximum of ${MAX_PARAMETER_FILES} CSV parameter files can be uploaded.`);
      return;
    }
    if (nextParameterFiles.reduce((total, file) => total + file.size, 0) > MAX_PARAMETER_FILES_SIZE) {
      setFileError('CSV parameter files cannot exceed 100 MB in total.');
      return;
    }

    setJobData(prev => {
      return {
        ...prev,
        file: plans[0] || prev.file,
        parameterFiles: nextParameterFiles
      };
    });
    setFileError('');
  };

  const handleFileChange = (e) => {
    selectFiles(e.target.files);
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
    selectFiles(e.dataTransfer.files);
  };

  const handleUploadKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const removeParameterFile = (event, filename) => {
    event.stopPropagation();
    setJobData(prev => ({
      ...prev,
      parameterFiles: prev.parameterFiles.filter(file => file.name !== filename)
    }));
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
    jobData.parameterFiles.forEach(file => formData.append('parameter_files', file));

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
              aria-label="Upload JMX and CSV files"
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
                accept=".jmx,.csv"
                multiple
              />
              <CloudUpload
                sx={{
                  mb: 1,
                  fontSize: 40,
                  color: isDragging ? 'var(--primary-color)' : 'var(--text-secondary)',
                }}
              />
              <Typography sx={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {jobData.file ? jobData.file.name : isDragging ? 'Drop JMX and CSV files here' : 'Drag and drop a JMX plan and optional CSV files here'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
                {jobData.file ? 'Drop or click to replace the plan or add CSV files' : 'or click to browse'}
              </Typography>
              {jobData.parameterFiles.length > 0 && (
                <Box
                  sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.75, mt: 1.5 }}
                  onClick={event => event.stopPropagation()}
                  onKeyDown={event => event.stopPropagation()}
                >
                  {jobData.parameterFiles.map(file => (
                    <Chip
                      key={file.name}
                      size="small"
                      label={`${file.name} (${Math.max(1, Math.ceil(file.size / 1024))} KB)`}
                      onDelete={event => removeParameterFile(event, file.name)}
                    />
                  ))}
                </Box>
              )}
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
                fontSize: '0.875rem',
                px: 2.2,
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

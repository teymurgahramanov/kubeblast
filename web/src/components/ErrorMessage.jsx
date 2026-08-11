
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Cancel } from '@mui/icons-material';

const ErrorMessage = ({ message }) => {
  if (!message) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        sx={{
          color: 'error.main',
          p: 2,
          bgcolor: (theme) => alpha(theme.palette.error.main, 0.12),
          border: '1px solid',
          borderColor: (theme) => alpha(theme.palette.error.main, 0.30),
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <Cancel fontSize="small" />
        {message}
      </Typography>
    </Box>
  );
};

export default ErrorMessage; 
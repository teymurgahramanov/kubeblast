import { createTheme } from '@mui/material/styles';

// Central light theme for a modern, clean look
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#326CE5',
      dark: '#2c5282'
    },
    background: {
      default: '#f5f7fa',
      paper: '#ffffff'
    },
    text: {
      primary: '#2d3748',
      secondary: '#718096'
    },
    success: { main: '#48bb78' },
    warning: { main: '#ecc94b' },
    error: { main: '#e53e3e' }
  },
  shape: {
    borderRadius: 12
  },
  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    h4: {
      fontWeight: 600
    }
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 8 },
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12
        }
      }
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 12
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined'
      }
    }
  }
});

export default theme;



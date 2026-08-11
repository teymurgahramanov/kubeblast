import { createContext, useEffect, useMemo, useState } from 'react';
import { createTheme } from '@mui/material/styles';
import { blue, green, orange, purple, red } from '@mui/material/colors';
import { ThemeProvider, CssBaseline } from '@mui/material';

export const ColorModeContext = createContext({
  mode: 'light',
  toggleColorMode: () => {}
});

const getDesignTokens = (mode) => ({
  palette: {
    mode,
    primary: {
      main: mode === 'light' ? blue[700] : blue[200],
      dark: mode === 'light' ? blue[800] : blue[400]
    },
    secondary: {
      main: mode === 'light' ? purple[500] : purple[200]
    },
    background: mode === 'light'
      ? { default: '#F5F5F5', paper: '#FFFFFF' }
      : { default: '#121212', paper: '#1E1E1E' },
    text: mode === 'light'
      ? { primary: 'rgba(0, 0, 0, 0.87)', secondary: 'rgba(0, 0, 0, 0.60)' }
      : { primary: 'rgba(255, 255, 255, 0.87)', secondary: 'rgba(255, 255, 255, 0.60)' },
    divider: mode === 'light' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)',
    action: mode === 'light'
      ? {
          hover: 'rgba(0, 0, 0, 0.04)',
          selected: 'rgba(25, 118, 210, 0.08)'
        }
      : {
          hover: 'rgba(255, 255, 255, 0.08)',
          selected: 'rgba(144, 202, 249, 0.16)'
        },
    success: { main: mode === 'light' ? green[800] : green[400] },
    warning: { main: mode === 'light' ? orange[800] : orange[400] },
    error: { main: mode === 'light' ? red[700] : red[500] }
  },
  shape: {
    borderRadius: 12
  },
  typography: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    h4: {
      fontWeight: 600
    }
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 10, fontWeight: 600 },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' }
        }
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

export const ColorModeProvider = ({ children }) => {
  const getInitialMode = () => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    if (saved === 'light' || saved === 'dark') return saved;
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  };

  const [mode, setMode] = useState(getInitialMode);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    try {
      localStorage.setItem('theme', mode);
    } catch {}
  }, [mode]);

  const theme = useMemo(() => createTheme(getDesignTokens(mode)), [mode]);

  const toggleColorMode = () => {
    setMode((prev) => (prev === 'light'? 'dark' : 'light'));
  };

  return (
    <ColorModeContext.Provider value={{ mode, toggleColorMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};


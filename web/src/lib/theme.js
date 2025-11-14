import React, { createContext, useEffect, useMemo, useState } from 'react';
import { createTheme } from '@mui/material/styles';
import { ThemeProvider, CssBaseline } from '@mui/material';

export const ColorModeContext = createContext({
  mode: 'light',
  toggleColorMode: () => {}
});

const getDesignTokens = (mode) => ({
  palette: {
    mode,
    primary: {
      main: '#326CE5',
      dark: '#2c5282'
    },
    background: mode === 'light'
      ? { default: '#f5f7fa', paper: '#ffffff' }
      : { default: '#0b1220', paper: '#0f172a' },
    text: mode === 'light'
      ? { primary: '#2d3748', secondary: '#718096' }
      : { primary: '#e5e7eb', secondary: '#94a3b8' },
    success: { main: mode === 'light' ? '#48bb78' : '#10b981' },
    warning: { main: mode === 'light' ? '#ecc94b' : '#f59e0b' },
    error: { main: mode === 'light' ? '#e53e3e' : '#ef4444' }
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
        root: { textTransform: 'none', borderRadius: 8 }
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


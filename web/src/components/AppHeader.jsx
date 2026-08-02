
import { Link } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import Menuselect from './Menuselect';

/**
 * Shared sticky top header used by all authenticated pages.
 * Props:
 *   title  – page name shown in the centre (optional)
 *   left   – custom left-side JSX (overrides the logo link)
 *   right  – custom right-side JSX (appended before Menuselect)
 */
const AppHeader = ({ title, left, right }) => (
  <Box
    component="header"
    sx={{
      borderBottom: '1px solid var(--border-color)',
      backgroundColor: 'background.paper',
      position: 'sticky',
      top: 0,
      zIndex: 1100,
      px: 3,
      py: 1,
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      backdropFilter: 'blur(8px)',
    }}
  >
    {/* Left – logo link or custom slot */}
    {left ?? (
      <Link to="/jobs" style={{ textDecoration: 'none', justifySelf: 'start' }}>
        <Box
          component="img"
          src="/logo.svg"
          alt="KubeBlast"
          sx={{
            height: 34,
            width: 'auto',
            transition: 'opacity 0.18s',
            '&:hover': { opacity: 0.72 },
          }}
        />
      </Link>
    )}

    {/* Centre – page title */}
    {title ? (
      <Typography
        variant="h6"
        sx={{ fontWeight: 600, textAlign: 'center', color: 'text.primary', letterSpacing: '-0.1px' }}
      >
        {title}
      </Typography>
    ) : (
      <Box />
    )}

    {/* Right – extra actions + user menu */}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifySelf: 'end' }}>
      {right}
      <Menuselect />
    </Box>
  </Box>
);

export default AppHeader;

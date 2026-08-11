import { useEffect, useMemo, useState } from 'react';
import {
  Avatar, Box, Button, Chip, IconButton, InputAdornment, Menu, MenuItem,
  Modal, TextField, Tooltip, Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
  Close, Delete, Edit, MoreVert, Person, PersonAdd, Search,
} from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';

import AddUser from './AddUser';
import AppHeader from './AppHeader';
import EditUser from './EditUser';
import ErrorMessage from './ErrorMessage';

const modalSx = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: { xs: 'calc(100% - 24px)', sm: '92%' },
  maxWidth: 680,
  maxHeight: 'calc(100vh - 32px)',
  overflowY: 'auto',
  bgcolor: 'background.paper',
  boxShadow: '0 25px 60px rgba(0,0,0,0.22)',
  borderRadius: { xs: '14px', sm: '18px' },
  outline: 'none',
  border: '1px solid var(--border-color)',
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [addUser, setAddUserState] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [timezone, setTimezone] = useState('UTC');

  const fetchUsers = async () => {
    try {
      const response = await axiosInstance.get('/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      setUsers(response.data);
      setError('');
    } catch (fetchError) {
      setError(fetchError.response?.data?.detail || fetchError.message);
    }
  };

  useEffect(() => {
    fetchUsers();

    const fetchAppStats = async () => {
      try {
        const response = await axiosInstance.get('/stats/app');
        if (response.data?.TIMEZONE) setTimezone(response.data.TIMEZONE);
      } catch {
        // Keep UTC as the display fallback when app settings are unavailable.
      }
    };
    fetchAppStats();
  }, []);

  const handleAddUserClose = () => {
    setAddUserState(false);
    fetchUsers();
  };

  const handleMenuOpen = (event, username) => {
    setAnchorEl(event.currentTarget);
    setSelectedUserId(username);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedUserId(null);
  };

  const handleDeleteUser = async (username) => {
    try {
      await axiosInstance.delete(`/users/${username}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      setUsers((currentUsers) => currentUsers.filter((user) => user.username !== username));
      setError('');
      handleMenuClose();
    } catch (deleteError) {
      setError(deleteError.response?.data?.detail || deleteError.message);
    }
  };

  const handleUserUpdate = () => {
    fetchUsers();
    setSelectedUser(null);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Never';
    const hasTimezone = /Z$/i.test(dateString) || /[+-]\d\d:?\d\d$/.test(dateString);
    const normalized = hasTimezone ? dateString : `${dateString}Z`;

    try {
      const date = new Date(normalized);
      if (Number.isNaN(date.getTime())) return dateString;
      return date.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZone: timezone || 'UTC',
      });
    } catch {
      return dateString;
    }
  };

  const rows = useMemo(() => users.map((user) => ({
    id: user.id,
    username: user.username,
    full_name: user.full_name || '',
    email: user.email || '',
    role: user.role,
    method: user.method ?? user.mehod ?? '',
    enabled: user.enabled,
    last_login: user.last_login || null,
  })), [users]);

  const visibleRows = useMemo(() => {
    const text = searchText.toLowerCase().trim();
    if (!text) return rows;
    return rows.filter((row) => row.username.toLowerCase().includes(text));
  }, [rows, searchText]);

  const getInitial = (value) => String(value || '?').trim().charAt(0).toUpperCase();

  const getRoleColor = (role) => {
    const normalized = String(role || '').toLowerCase();
    if (normalized === 'admin') return { bg: 'rgba(124, 58, 237, 0.14)', text: '#7C3AED' };
    if (normalized === 'moderator') return { bg: 'rgba(217, 119, 6, 0.16)', text: '#B45309' };
    return { bg: 'rgba(25, 118, 210, 0.12)', text: 'var(--primary-color)' };
  };

  const EmptyState = () => (
    <Box sx={{
      minHeight: 360,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      py: 8,
      px: 2,
      textAlign: 'center',
    }}>
      <Box sx={{
        width: 76,
        height: 76,
        borderRadius: '20px',
        backgroundColor: 'background.default',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 2.25,
      }}>
        <Person sx={{ fontSize: 38, color: 'var(--text-secondary)', opacity: 0.65 }} />
      </Box>
      <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700, mb: 0.75 }}>
        {searchText ? 'No matching users' : 'No users yet'}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--text-secondary)', maxWidth: 360 }}>
        {searchText
          ? `No usernames match “${searchText}”. Try a different search.`
          : 'Add a user to start managing access and permissions.'}
      </Typography>
      {searchText && (
        <Button onClick={() => setSearchText('')} sx={{ mt: 1.5 }}>
          Clear search
        </Button>
      )}
    </Box>
  );

  const columns = [
    {
      field: 'username',
      headerName: 'Username',
      minWidth: 240,
      flex: 1.35,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Avatar sx={{
            width: 34,
            height: 34,
            fontSize: '0.82rem',
            fontWeight: 800,
            bgcolor: params.row.enabled ? 'rgba(25, 118, 210, 0.14)' : 'action.hover',
            color: params.row.enabled ? 'var(--primary-color)' : 'text.secondary',
            border: '1px solid var(--border-color)',
          }}>
            {getInitial(params.value)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'text.primary' }} noWrap>
              {params.value}
            </Typography>
            {params.row.email && (
              <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }} noWrap>
                {params.row.email}
              </Typography>
            )}
          </Box>
        </Box>
      ),
    },
    {
      field: 'full_name',
      headerName: 'Full name',
      minWidth: 180,
      flex: 1,
      renderCell: (params) => (
        <Typography sx={{ fontSize: '0.86rem', color: params.value ? 'text.primary' : 'text.secondary' }} noWrap>
          {params.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'role',
      headerName: 'Role',
      minWidth: 128,
      flex: 0.7,
      renderCell: (params) => {
        const roleColors = getRoleColor(params.value);
        return (
          <Chip
            label={params.value || '—'}
            size="small"
            sx={{
              height: 28,
              minWidth: 84,
              borderRadius: '8px',
              bgcolor: roleColors.bg,
              color: roleColors.text,
              fontSize: '0.76rem',
              fontWeight: 700,
              textTransform: 'capitalize',
              '& .MuiChip-label': { px: 1.25 },
            }}
          />
        );
      },
    },
    {
      field: 'method',
      headerName: 'Method',
      minWidth: 118,
      flex: 0.6,
      renderCell: (params) => (
        <Typography sx={{
          px: 1,
          py: 0.45,
          borderRadius: '7px',
          fontSize: '0.78rem',
          fontWeight: 700,
          lineHeight: 1,
          color: 'text.secondary',
          bgcolor: 'action.hover',
          textTransform: 'uppercase',
        }}>
          {params.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'last_login',
      headerName: 'Last login',
      minWidth: 190,
      flex: 1.1,
      renderCell: (params) => (
        <Typography sx={{ fontSize: '0.86rem', color: params.value ? 'text.primary' : 'text.secondary' }} noWrap>
          {formatDateTime(params.value)}
        </Typography>
      ),
    },
    {
      field: 'enabled',
      headerName: 'Status',
      minWidth: 105,
      flex: 0.65,
      renderCell: (params) => {
        const statusColors = params.row.enabled
          ? { bg: '#BBF7D0', text: '#047857' }
          : { bg: '#FCA5A5', text: '#7F1D1D' };

        return (
          <Box sx={{
            backgroundColor: statusColors.bg,
            color: statusColors.text,
            borderRadius: '999px',
            px: 1.25,
            py: 0.55,
            fontSize: '0.75rem',
            lineHeight: 1,
            fontWeight: 700,
            minWidth: 74,
            textAlign: 'center',
          }}>
            {params.row.enabled ? 'Enabled' : 'Disabled'}
          </Box>
        );
      },
    },
    {
      field: 'actions',
      headerName: '',
      sortable: false,
      filterable: false,
      width: 64,
      align: 'center',
      renderCell: (params) => (
        <Tooltip title="User actions" arrow>
          <IconButton
            aria-label={`Actions for ${params.row.username}`}
            onClick={(event) => handleMenuOpen(event, params.row.username)}
            size="small"
            sx={{
              border: '1px solid transparent',
              '&:hover': {
                backgroundColor: 'var(--background-light)',
                color: 'var(--primary-color)',
                borderColor: 'var(--border-color)',
              },
            }}
          >
            <MoreVert fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader title="Users" />

      <Box className="page-container fade-in">
        <Box sx={{
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 2.5,
          flexDirection: { xs: 'column', sm: 'row' },
        }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.5 }}>
              User access
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
              Manage accounts, roles, and sign-in status.
            </Typography>
          </Box>

          <Button
            variant="contained"
            onClick={() => setAddUserState(true)}
            startIcon={<PersonAdd />}
            sx={{ minHeight: 44, px: 2.25, flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' } }}
          >
            Add user
          </Button>
        </Box>

        <ErrorMessage message={error} />

        <Box sx={{
          width: '100%',
          minHeight: 420,
          backgroundColor: 'background.paper',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)',
          overflow: 'hidden',
        }}>
          <Box sx={{
            px: { xs: 1.5, sm: 2 },
            py: 1.5,
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            flexDirection: { xs: 'column', sm: 'row' },
          }}>
            <TextField
              size="small"
              placeholder="Search by username…"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ fontSize: 19, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchText ? (
                    <InputAdornment position="end">
                      <IconButton aria-label="Clear search" size="small" onClick={() => setSearchText('')}>
                        <Close sx={{ fontSize: 17 }} />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                },
              }}
              sx={{
                width: { xs: '100%', sm: 420 },
                '& .MuiOutlinedInput-root': {
                  height: 46,
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  backgroundColor: 'background.paper',
                  '& fieldset': { borderColor: 'var(--border-color)' },
                  '&:hover fieldset': { borderColor: 'text.disabled' },
                },
              }}
            />

            <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
              {visibleRows.length === users.length
                ? `${users.length} ${users.length === 1 ? 'user' : 'users'}`
                : `${visibleRows.length} of ${users.length} users`}
            </Typography>
          </Box>

          {visibleRows.length === 0 ? (
            <EmptyState />
          ) : (
            <Box sx={{ width: '100%', overflowX: 'auto' }}>
              <DataGrid
                rows={visibleRows}
                columns={columns}
                getRowId={(row) => row.username}
                hideFooter
                rowSelection={false}
                disableColumnMenu
                autoHeight
                getRowHeight={() => 68}
                sx={{
                  minWidth: 940,
                  border: 'none',
                  boxShadow: 'none',
                  borderRadius: 0,
                  '& .MuiDataGrid-cell': {
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    py: 1,
                    '&:focus, &:focus-within': { outline: 'none' },
                  },
                  '& .MuiDataGrid-columnHeaders': {
                    backgroundColor: 'var(--background-light)',
                    borderBottom: '1px solid var(--border-color)',
                    minHeight: '46px !important',
                  },
                  '& .MuiDataGrid-columnHeader': {
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    '&:focus, &:focus-within': { outline: 'none' },
                  },
                  '& .MuiDataGrid-columnSeparator': { display: 'none' },
                  '& .MuiDataGrid-row': {
                    '&:hover': { backgroundColor: 'var(--background-light)' },
                    '&:last-child .MuiDataGrid-cell': { borderBottom: 'none' },
                  },
                  '& .MuiDataGrid-row.Mui-selected': { backgroundColor: 'transparent !important' },
                  '& .MuiDataGrid-row.Mui-selected:hover': { backgroundColor: 'var(--background-light) !important' },
                }}
              />
            </Box>
          )}
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          slotProps={{
            paper: {
              sx: {
                mt: 1,
                minWidth: 150,
                border: '1px solid var(--border-color)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
                '& .MuiMenuItem-root': { py: 1, gap: 1.25, fontSize: '0.875rem' },
              },
            },
          }}
        >
          <MenuItem
            onClick={() => {
              const user = users.find((candidate) => candidate.username === selectedUserId);
              setSelectedUser(user);
              handleMenuClose();
            }}
            sx={{ color: 'var(--primary-color)' }}
          >
            <Edit fontSize="small" />
            Edit
          </MenuItem>
          <MenuItem
            onClick={() => handleDeleteUser(selectedUserId)}
            sx={{ color: 'var(--danger-color)' }}
          >
            <Delete fontSize="small" />
            Delete
          </MenuItem>
        </Menu>

        <Modal
          open={Boolean(selectedUser)}
          onClose={() => setSelectedUser(null)}
          aria-labelledby="edit-user-title"
          slotProps={{ backdrop: { sx: { backdropFilter: 'blur(3px)' } } }}
        >
          <Box sx={modalSx}>
            {selectedUser && (
              <EditUser
                user={selectedUser}
                onClose={() => setSelectedUser(null)}
                onUpdate={handleUserUpdate}
              />
            )}
          </Box>
        </Modal>

        <Modal
          open={addUser}
          onClose={handleAddUserClose}
          aria-labelledby="add-user-title"
          slotProps={{ backdrop: { sx: { backdropFilter: 'blur(3px)' } } }}
        >
          <Box sx={modalSx}>
            <AddUser onClose={handleAddUserClose} />
          </Box>
        </Modal>
      </Box>
    </Box>
  );
};

export default Users;
